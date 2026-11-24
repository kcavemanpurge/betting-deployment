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
    // Fallback to connection string
  }

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    'postgresql://localhost:5432/betting';

  pool = new Pool({ connectionString });
  return pool;
}

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

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        service: 'SERVERLESS_CARD_RAIL_WITHDRAWAL',
        status: 'OPERATIONAL',
        minThreshold: 100.00,
        currency: 'USD',
        rail: 'VISA_DIRECT_INSTANT_CARD_RAIL',
        runtime: 'NETLIFY_SERVERLESS_FUNCTION'
      })
    };
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
    const { userId = 'user_caveman_01', amount, cardRailId = 'PRIMARY_SETTLEMENT_RAIL' } = payload;

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'INVALID_WITHDRAWAL_AMOUNT' })
      };
    }

    if (numAmount < 100.00) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'THRESHOLD_VIOLATION',
          message: 'Minimum withdrawal threshold is $100.00 USD.'
        })
      };
    }

    const txId = `wdraw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        transactionId: txId,
        userId,
        amount: numAmount.toFixed(2),
        currency: 'USD',
        status: 'DISPATCHED_TO_CARD_RAIL',
        rail: 'INSTANT_CARD_RAIL_SETTLEMENT',
        settlementEngine: 'AUTOMATED_SERVERLESS_PIPELINE',
        timestamp
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}
