import { Pool } from '@neondatabase/serverless';
import { getDatabase } from '@netlify/database';

let pool;

function getPool() {
  if (pool) return pool;
  try {
    const db = getDatabase();
    if (db && db.pool) {
      pool = db.pool;
      return pool;
    }
  } catch (err) {
    // Ignore and fallback to direct connection string
  }

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    'postgresql://localhost:5432/betting';

  pool = new Pool({ connectionString });
  return pool;
}

// Fallback in-memory ledger if database is still provisioning on initial cold start
const inMemoryFallbackLedger = [];

export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // GET: Fetch recent settlement ledger records
  if (event.httpMethod === 'GET') {
    const targetUserId = event.queryStringParameters?.userId;
    try {
      const activePool = getPool();
      const client = await activePool.connect();
      try {
        let query = `
          SELECT id, session_id, user_id, wager_amount, multiplier, payout_amount, status, created_at 
          FROM bet_settlements 
        `;
        const params = [];
        if (targetUserId) {
          query += ` WHERE user_id = $1`;
          params.push(targetUserId);
        }
        query += ` ORDER BY created_at DESC LIMIT 50`;

        const res = await client.query(query, params);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            settlements: res.rows,
            source: 'POSTGRES_IMMUTABLE_LEDGER'
          })
        };
      } finally {
        client.release();
      }
    } catch (err) {
      // Fallback for cold start or pending migration
      const filtered = targetUserId
        ? inMemoryFallbackLedger.filter((item) => item.user_id === targetUserId)
        : inMemoryFallbackLedger;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          settlements: filtered,
          source: 'SESSION_LEDGER_BUFFER',
          note: err.message
        })
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'METHOD_NOT_ALLOWED' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { sessionId, userId, wagerAmount, multiplier } = payload;

    if (!sessionId || !userId || wagerAmount === undefined || multiplier === undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'MISSING_REQUIRED_PAYLOAD_FIELDS' })
      };
    }

    const numWager = parseFloat(wagerAmount);
    const numMultiplier = parseFloat(multiplier);

    if (isNaN(numWager) || numWager <= 0 || isNaN(numMultiplier) || numMultiplier < 1.0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'INVALID_NUMERIC_PARAMETERS' })
      };
    }

    // Try PostgreSQL atomic execution block
    try {
      const activePool = getPool();
      const client = await activePool.connect();

      try {
        await client.query('BEGIN');

        // Ensure table exists defensively
        await client.query(`
          CREATE TABLE IF NOT EXISTS bet_settlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id VARCHAR(64) UNIQUE NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            wager_amount NUMERIC(12, 2) NOT NULL CHECK (wager_amount >= 0),
            multiplier NUMERIC(8, 4) NOT NULL CHECK (multiplier >= 1.0000),
            payout_amount NUMERIC(12, 2) GENERATED ALWAYS AS (wager_amount * multiplier) STORED,
            status VARCHAR(20) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'REJECTED')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_user_settlements ON bet_settlements(user_id, status);
        `);

        // Duplicate session check
        const checkRes = await client.query(
          'SELECT id FROM bet_settlements WHERE session_id = $1 FOR UPDATE',
          [sessionId]
        );

        if (checkRes.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'SESSION_ALREADY_SETTLED' })
          };
        }

        // Record settlement
        const insertRes = await client.query(
          `INSERT INTO bet_settlements (session_id, user_id, wager_amount, multiplier, status)
           VALUES ($1, $2, $3, $4, 'SETTLED')
           RETURNING id, payout_amount, created_at`,
          [sessionId, userId, numWager, numMultiplier]
        );

        await client.query('COMMIT');

        const record = insertRes.rows[0];
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            settlementId: record.id,
            payoutAmount: parseFloat(record.payout_amount).toFixed(2),
            timestamp: record.created_at,
            ledger: 'POSTGRES_IMMUTABLE_CHAIN'
          })
        };
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.warn('Database settlement encountered issue, using fast failover buffer:', dbError.message);

      // Verify no duplicate in fallback
      const exists = inMemoryFallbackLedger.find((item) => item.session_id === sessionId);
      if (exists) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'SESSION_ALREADY_SETTLED' })
        };
      }

      const calculatedPayout = (numWager * numMultiplier).toFixed(2);
      const fallbackRecord = {
        id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        session_id: sessionId,
        user_id: userId,
        wager_amount: numWager.toFixed(2),
        multiplier: numMultiplier.toFixed(4),
        payout_amount: calculatedPayout,
        status: 'SETTLED',
        created_at: new Date().toISOString()
      };

      inMemoryFallbackLedger.unshift(fallbackRecord);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          settlementId: fallbackRecord.id,
          payoutAmount: calculatedPayout,
          timestamp: fallbackRecord.created_at,
          ledger: 'EDGE_BUFFER_FALLBACK',
          warning: dbError.message
        })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}
