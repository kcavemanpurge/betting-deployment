import { Pool } from '@neondatabase/serverless';
import { getDatabase } from '@netlify/database';

const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';[span_4](start_span)[span_4](end_span)

let pool;

function getPool() {
  if (pool) return pool;

  try {
    const db = getDatabase();
    if (db && db.pool) {
      pool = db.pool;
      return pool;
    }
  } catch {
    // Fall back to explicit environment connection string
  }

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL_NOT_CONFIGURED');
  }

  pool = new Pool({ connectionString });
  return pool;
}

export async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  const settlementWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_SETTLEMENT_WALLET
  ).trim();[span_5](start_span)[span_5](end_span)

  if (event.httpMethod === 'GET') {
    const targetUserId = event.queryStringParameters?.userId?.trim();
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
          ok: true,
          settlements: res.rows,
          settlementWallet,
          source: 'POSTGRES_LEDGER',
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'LEDGER_QUERY_FAILED',
          detail: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
        }),
      };
    } finally {
      client.release();
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    const numWager = Number(payload.wagerAmount);
    const numMultiplier = Number(payload.multiplier);
    const rail = typeof payload.rail === 'string' ? payload.rail.trim().toUpperCase() : 'HOT_WALLET';
    const txRef =
      typeof payload.txHash === 'string' && payload.txHash.trim()
        ? payload.txHash.trim()
        : `settle_${sessionId}`;

    if (!sessionId || !userId || payload.wagerAmount === undefined || payload.multiplier === undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'MISSING_REQUIRED_PAYLOAD_FIELDS' }),
      };
    }

    if (!Number.isFinite(numWager) || numWager <= 0 || !Number.isFinite(numMultiplier) || numMultiplier < 1.0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_NUMERIC_PARAMETERS' }),
      };
    }

    const activePool = getPool();
    const client = await activePool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query(
        'SELECT id FROM bet_settlements WHERE session_id = $1 FOR UPDATE',
        [sessionId]
      );

      if (checkRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: 'SESSION_ALREADY_SETTLED' }),
        };
      }

      const insertRes = await client.query(
        `INSERT INTO bet_settlements (session_id, user_id, wager_amount, multiplier, status)
         VALUES ($1, $2, $3, $4, 'SETTLED')
         RETURNING id, payout_amount, created_at`,
        [sessionId, userId, numWager.toFixed(2), numMultiplier.toFixed(4)]
      );

      const record = insertRes.rows[0];
      const payoutNum = Number(record.payout_amount);

      await client.query(
        `INSERT INTO user_balances (user_id, available_balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           available_balance = user_balances.available_balance + EXCLUDED.available_balance,
           updated_at = NOW()`,
        [userId, payoutNum.toFixed(2)]
      );

      await client.query(
        `INSERT INTO financial_ledger
           (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
         VALUES ($1, 'WIN_SETTLEMENT', $2, $3, 0, $4, 'CONFIRMED', $5::jsonb)`,
        [
          userId,
          payoutNum.toFixed(4),
          settlementWallet,
          txRef,
          JSON.stringify({
            sessionId,
            wagerAmount: numWager,
            multiplier: numMultiplier,
            rail,
            settlementWallet,
          }),
        ]
      );

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          settlementId: record.id,
          payoutAmount: payoutNum.toFixed(2),
          settlementWallet,
          timestamp: record.created_at,
          ledger: 'POSTGRES_LEDGER',
        }),
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: 'SETTLEMENT_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}
