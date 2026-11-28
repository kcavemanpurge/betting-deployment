import crypto from 'node:crypto';
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

function buildChainRef(rail, withdrawalId, explicitTxHash) {
  if (explicitTxHash && explicitTxHash.trim()) return explicitTxHash.trim();
  const digest = crypto.randomBytes(16).toString('hex');
  if (rail === 'SOLANA') return `sol_${withdrawalId}_${digest}`;
  if (rail === 'SMART_CHAIN') return `0x${digest}${crypto.randomBytes(16).toString('hex')}`;
  return `hw_${withdrawalId}_${digest}`;
}

export async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }),
    };
  }

  const requiredAdminSecret = (process.env.WITHDRAWAL_APPROVAL_SECRET || '').trim();
  if (!requiredAdminSecret) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'APPROVAL_SECRET_NOT_CONFIGURED' }),
    };
  }

  const providedSecret = (
    event.headers?.['x-admin-key'] ||
    event.headers?.['X-Admin-Key'] ||
    ''
  ).trim();

  if (providedSecret !== requiredAdminSecret) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'UNAUTHORIZED_APPROVER' }),
    };
  }

  const settlementWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_SOLANA_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_SETTLEMENT_WALLET
  ).trim();

  try {
    const payload = JSON.parse(event.body || '{}');
    const withdrawalId = Number(payload.withdrawalId);
    const decision =
      typeof payload.decision === 'string' ? payload.decision.trim().toUpperCase() : 'APPROVE';
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'VALID_WITHDRAWAL_ID_REQUIRED' }),
      };
    }

    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_DECISION' }),
      };
    }

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        `SELECT id, user_id, amount, rail, user_wallet, settlement_wallet, contract_or_program_ref, status
         FROM withdrawal_requests WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (reqRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: 'WITHDRAWAL_NOT_FOUND' }),
        };
      }

      const row = reqRes.rows[0];
      if (row.status !== 'PENDING_MANUAL_APPROVAL') {
        await client.query('ROLLBACK');
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({
            ok: false,
            error: 'WITHDRAWAL_ALREADY_FINALIZED',
            currentStatus: row.status,
          }),
        };
      }

      const amountNum = Number(row.amount);
      const rail = String(row.rail || 'SOLANA').toUpperCase();

      if (decision === 'REJECT') {
        await client.query(
          `UPDATE user_balances
           SET profit_balance = profit_balance + $2, updated_at = NOW()
           WHERE user_id = $1`,
          [row.user_id, amountNum.toFixed(4)]
        );

        await client.query(
          `UPDATE withdrawal_requests
           SET status = 'REJECTED', approved_at = NOW()
           WHERE id = $1`,
          [withdrawalId]
        );

        await client.query(
          `INSERT INTO financial_ledger
             (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
           VALUES ($1, 'WITHDRAWAL_REJECTED_REFUND', $2, $3, 0, $4, 'REFUNDED', $5::jsonb)`,
          [
            row.user_id,
            amountNum.toFixed(4),
            row.settlement_wallet || settlementWallet,
            `reject_${withdrawalId}_${Date.now()}`,
            JSON.stringify({ withdrawalId, rail, reason }),
          ]
        );

        await client.query('COMMIT');

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            ok: true,
            withdrawalId,
            status: 'REJECTED',
            refundedProfitAmount: amountNum.toFixed(2),
          }),
        };
      }

      const hasExplicitTx = typeof payload.txHash === 'string' && Boolean(payload.txHash.trim());
      const txHash = buildChainRef(rail, withdrawalId, payload.txHash);
      const ledgerStatus = hasExplicitTx ? 'CONFIRMED' : 'APPROVED_PENDING_DISPATCH';
      const contractRef =
        rail === 'SOLANA'
          ? (process.env.SOLANA_PROGRAM_ID || row.contract_or_program_ref || settlementWallet).trim()
          : rail === 'SMART_CHAIN'
            ? (process.env.SMART_CHAIN_CONTRACT_ADDRESS || row.contract_or_program_ref || '').trim() || null
            : (row.settlement_wallet || settlementWallet);

      await client.query(
        `UPDATE withdrawal_requests
         SET status = 'APPROVED',
             contract_or_program_ref = COALESCE($2, contract_or_program_ref),
             tx_ref = $3,
             approved_at = NOW()
         WHERE id = $1`,
        [withdrawalId, contractRef, txHash]
      );

      await client.query(
        `INSERT INTO financial_ledger
           (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
         VALUES ($1, 'WITHDRAWAL_APPROVED_DISPATCH', $2, $3, 0, $4, $5, $6::jsonb)`,
        [
          row.user_id,
          amountNum.toFixed(4),
          row.settlement_wallet || settlementWallet,
          txHash,
          ledgerStatus,
          JSON.stringify({
            withdrawalId,
            rail,
            userWallet: row.user_wallet,
            settlementWallet: row.settlement_wallet || settlementWallet,
            contractOrProgramRef: contractRef,
            solanaRpcUrl: rail === 'SOLANA' ? process.env.SOLANA_RPC_URL || null : undefined,
            smartChainRpcUrl: rail === 'SMART_CHAIN' ? process.env.SMART_CHAIN_RPC_URL || null : undefined,
          }),
        ]
      );

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          withdrawalId,
          status: 'APPROVED',
          ledgerStatus,
          rail,
          amount: amountNum.toFixed(2),
          userWallet: row.user_wallet,
          settlementWallet: row.settlement_wallet || settlementWallet,
          contractOrProgramRef: contractRef,
          txHash,
          approvedAt: new Date().toISOString(),
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
        error: 'WITHDRAWAL_APPROVAL_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}