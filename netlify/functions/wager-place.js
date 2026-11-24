import { Pool } from '@neondatabase/serverless';
import { getDatabase } from '@netlify/database';

const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const VALID_MARKETS = new Set(['AVIATOR', 'SPORTS_SINGLE', 'SPORTS_ACCUMULATOR', 'TOP5_SIM']);

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
    // Fall back to explicit connection string
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
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const settlementWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_SETTLEMENT_WALLET
  ).trim();

  if (event.httpMethod === 'GET') {
    const targetUserId = (event.queryStringParameters?.userId || '').trim();
    if (!targetUserId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'USER_ID_REQUIRED' }),
      };
    }

    const client = await getPool().connect();
    try {
      const res = await client.query(
        `SELECT id, user_id, market_type, stake_amount, used_promo, used_profit,
                odds_or_multiplier, payout_amount, outcome, selections, created_at
         FROM bet_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [targetUserId]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          userId: targetUserId,
          settlementWallet,
          history: res.rows,
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
    const marketType =
      typeof payload.marketType === 'string' ? payload.marketType.trim().toUpperCase() : 'AVIATOR';
    const stakeAmount = Number(payload.stakeAmount);
    const oddsOrMultiplier = Number(payload.oddsOrMultiplier ?? 1);
    const selections = Array.isArray(payload.selections) ? payload.selections : [];

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'USER_ID_REQUIRED' }),
      };
    }

    if (!VALID_MARKETS.has(marketType)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_MARKET_TYPE' }),
      };
    }

    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0 || !Number.isFinite(oddsOrMultiplier) || oddsOrMultiplier < 1) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_WAGER_PARAMETERS' }),
      };
    }

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      const balRes = await client.query(
        `SELECT promo_balance, profit_balance, daily_spend_used, spend_date
         FROM user_balances WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (balRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: 'USER_BALANCE_NOT_FOUND' }),
        };
      }

      const bal = balRes.rows[0];
      const promoAvail = Number(bal.promo_balance || 0);
      const profitAvail = Number(bal.profit_balance || 0);
      const totalAvail = promoAvail + profitAvail;

      if (stakeAmount > totalAvail) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            ok: false,
            error: 'INSUFFICIENT_BALANCE',
            availableTotal: totalAvail.toFixed(4),
          }),
        };
      }

      const usedPromo = Math.min(promoAvail, stakeAmount);
      const usedProfit = Number((stakeAmount - usedPromo).toFixed(4));
      const nextPromo = Number((promoAvail - usedPromo).toFixed(4));
      const nextProfit = Number((profitAvail - usedProfit).toFixed(4));

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentDay =
        bal.spend_date instanceof Date
          ? bal.spend_date.toISOString().slice(0, 10)
          : String(bal.spend_date || todayStr).slice(0, 10);
      const baseDailySpend = currentDay === todayStr ? Number(bal.daily_spend_used || 0) : 0;
      const nextDailySpend = Number((baseDailySpend + stakeAmount).toFixed(4));

      await client.query(
        `UPDATE user_balances
         SET promo_balance = $2,
             profit_balance = $3,
             daily_spend_used = $4,
             spend_date = CURRENT_DATE,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, nextPromo.toFixed(4), nextProfit.toFixed(4), nextDailySpend.toFixed(4)]
      );

      const histRes = await client.query(
        `INSERT INTO bet_history
           (user_id, market_type, stake_amount, used_promo, used_profit, odds_or_multiplier, payout_amount, outcome, selections)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'PENDING', $7::jsonb)
         RETURNING id, created_at`,
        [
          userId,
          marketType,
          stakeAmount.toFixed(4),
          usedPromo.toFixed(4),
          usedProfit.toFixed(4),
          oddsOrMultiplier.toFixed(4),
          JSON.stringify(selections),
        ]
      );

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          betId: histRes.rows[0].id,
          userId,
          marketType,
          stakeAmount: stakeAmount.toFixed(2),
          usedPromo: usedPromo.toFixed(2),
          usedProfit: usedProfit.toFixed(2),
          promoBalance: nextPromo,
          profitBalance: nextProfit,
          dailySpendUsed: nextDailySpend,
          settlementWallet,
          createdAt: histRes.rows[0].created_at,
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
        error: 'WAGER_PLACEMENT_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}
