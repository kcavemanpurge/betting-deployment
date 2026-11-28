import { Pool } from '@neondatabase/serverless';
import { getDatabase } from '@netlify/database';

const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';

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

  const startTime = Date.now();
  const settlementWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_SETTLEMENT_WALLET
  ).trim();

  try {
    let command = 'status';

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      command = (body.command || 'status').toString().toLowerCase().trim();
    } else if (event.httpMethod === 'GET') {
      command = (event.queryStringParameters?.command || 'status').toString().toLowerCase().trim();
    } else {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }),
      };
    }

    if (command === 'ping') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          pong: true,
          settlementWallet,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    if (command === 'deploy' || command === 'deploy-check') {
      let dbStatus = 'CONNECTED';
      let dbLatencyMs = 0;
      let totalSettlements = 0;

      try {
        const dbStart = Date.now();
        const activePool = getPool();
        const client = await activePool.connect();
        try {
          const res = await client.query('SELECT count(*) AS count FROM bet_settlements');
          totalSettlements = Number.parseInt(res.rows[0]?.count || '0', 10);
          dbLatencyMs = Date.now() - dbStart;
        } finally {
          client.release();
        }
      } catch (e) {
        dbStatus = `ERROR (${e instanceof Error ? e.message : 'DB_UNREACHABLE'})`;
      }

      const functions = [
        { name: 'settle', path: '/.netlify/functions/settle', status: 'ACTIVE' },
        { name: 'withdraw', path: '/.netlify/functions/withdraw', status: 'ACTIVE' },
        { name: 'approve-withdrawal', path: '/.netlify/functions/approve-withdrawal', status: 'ACTIVE' },
        { name: 'account-sync', path: '/.netlify/functions/account-sync', status: 'ACTIVE' },
        { name: 'round', path: '/.netlify/functions/round', status: 'ACTIVE' },
        { name: 'live-odds', path: '/.netlify/functions/live-odds', status: 'ACTIVE' },
        { name: 'live-events', path: '/.netlify/functions/live-events', status: 'ACTIVE' },
        { name: 'sports-catalog', path: '/.netlify/functions/sports-catalog', status: 'ACTIVE' },
        { name: 'system', path: '/.netlify/functions/system', status: 'ACTIVE' },
      ];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          command: 'deploy',
          runtime: 'NETLIFY_SERVERLESS_FUNCTIONS',
          settlementWallet,
          oddsFeedConfigured: Boolean(process.env.ODDS_API_KEY),
          functions,
          database: {
            provider: 'POSTGRESQL',
            status: dbStatus,
            latencyMs: dbLatencyMs,
            totalSettlements,
          },
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    let dbStatus = 'CONNECTED';
    let dbLatencyMs = 0;

    try {
      const dbStart = Date.now();
      const activePool = getPool();
      const client = await activePool.connect();
      try {
        await client.query('SELECT 1');
        dbLatencyMs = Date.now() - dbStart;
      } finally {
        client.release();
      }
    } catch (e) {
      dbStatus = `ERROR (${e instanceof Error ? e.message : 'DB_UNREACHABLE'})`;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        command: 'status',
        runtime: 'NETLIFY_SERVERLESS_FUNCTIONS',
        settlementWallet,
        oddsFeedConfigured: Boolean(process.env.ODDS_API_KEY),
        databaseStatus: dbStatus,
        databaseLatencyMs: dbLatencyMs,
        functionsCount: 9,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: 'SYSTEM_DIAGNOSTIC_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}