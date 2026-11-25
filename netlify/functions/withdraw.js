import crypto from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { getDatabase } from '@netlify/database';

const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const SUPPORTED_RAILS = new Set(['SOLANA', 'SMART_CHAIN', 'HOT_WALLET']);

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
    process.env.HOT_WALLET_SOLANA_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_SETTLEMENT_WALLET
  ).trim();

  if (event.httpMethod === 'GET') {
    const targetUserId = event.queryStringParameters?.userId?.trim();
    const targetStatus = event.queryStringParameters?.status?.trim().toUpperCase();
    const activePool = getPool();
    const client = await activePool.connect();

    try {
      const clauses = [];
      const params = [];

      if (targetUserId) {
        params.push(targetUserId);
        clauses.push(`user_id = $${params.length}`);
      }
      if (targetStatus) {
        params.push(targetStatus);
        clauses.push(`status = $${params.length}`);
      }

      let query = `
        SELECT id, user_id, amount, rail, user_wallet, settlement_wallet,
               contract_or_program_ref, status, tx_ref, created_at, approved_at
        FROM withdrawal_requests
      `;
      if (clauses.length > 0) {
        query += ` WHERE ${clauses.join(' AND ')}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 50`;

      const res = await client.query(query, params);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          approvalMode: 'MANUAL_BACKEND_APPROVAL',
          settlementWallet,
          withdrawals: res.rows,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'WITHDRAWAL_QUERY_FAILED',
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
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    const userWallet =
      typeof payload.userWallet === 'string'
        ? payload.userWallet.trim()
        : typeof payload.destinationWallet === 'string'
          ? payload.destinationWallet.trim()
          : '';
    const rawRail = typeof payload.rail === 'string' ? payload.rail.trim().toUpperCase() : 'SOLANA';
    const numAmount = Number(payload.amount);

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'USER_ID_REQUIRED' }),
      };
    }

    if (!userWallet) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'DESTINATION_WALLET_REQUIRED' }),
      };
    }

    if (!SUPPORTED_RAILS.has(rawRail)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'UNSUPPORTED_RAIL',
          supportedRails: Array.from(SUPPORTED_RAILS),
        }),
      };
    }

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_WITHDRAWAL_AMOUNT' }),
      };
    }

    const contractOrProgramRef =
      rawRail === 'SOLANA'
        ? (process.env.SOLANA_PROGRAM_ID || settlementWallet).trim()
        : rawRail === 'SMART_CHAIN'
          ? (process.env.SMART_CHAIN_CONTRACT_ADDRESS || '').trim() || null
          : settlementWallet;

    const txRef = `wdraw_req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const activePool = getPool();
    const client = await activePool.connect();

    try {
      await client.query('BEGIN');

      const balRes = await client.query(
        'SELECT available_balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      const currentBalance = Number(balRes.rows[0]?.available_balance ?? 0);
      if (currentBalance < numAmount) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            ok: false,
            error: 'INSUFFICIENT_BALANCE',
            availableBalance: currentBalance.toFixed(2),
          }),
        };
      }

      await client.query(
        `UPDATE user_balances
         SET available_balance = available_balance - $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, numAmount.toFixed(2)]
      );

      const insertReq = await client.query(
        `INSERT INTO withdrawal_requests
           (user_id, amount, rail, user_wallet, settlement_wallet, contract_or_program_ref, status, tx_ref)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_MANUAL_APPROVAL', $7)
         RETURNING id, status, created_at`,
        [
          userId,
          numAmount.toFixed(4),
          rawRail,
          userWallet,
          settlementWallet,
          contractOrProgramRef,
          txRef,
        ]
      );

      await client.query(
        `INSERT INTO financial_ledger
           (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
         VALUES ($1, 'WITHDRAWAL_REQUEST', $2, $3, 0, $4, 'PENDING_MANUAL_APPROVAL', $5::jsonb)`,
        [
          userId,
          numAmount.toFixed(4),
          settlementWallet,
          txRef,
          JSON.stringify({
            withdrawalId: insertReq.rows[0].id,
            rail: rawRail,
            userWallet,
            settlementWallet,
            contractOrProgramRef,
          }),
        ]
      );

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          withdrawalId: insertReq.rows[0].id,
          txRef,
          userId,
          amount: numAmount.toFixed(2),
          rail: rawRail,
          userWallet,
          settlementWallet,
          status: 'PENDING_MANUAL_APPROVAL',
          timestamp: insertReq.rows[0].created_at,
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
        error: 'WITHDRAWAL_REQUEST_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}
