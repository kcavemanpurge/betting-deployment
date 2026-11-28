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

function buildUserId(email) {
  return `usr_${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`;
}

function buildKycHash(kycId) {
  return crypto.createHash('sha256').update(kycId.trim().toUpperCase()).digest('hex');
}

function sanitizeProfile(row) {
  if (!row) return null;
  const { kyc_hash: _omittedKycHash, ...safeProfile } = row;
  return {
    ...safeProfile,
    kycVerified: Boolean(row.kyc_hash),
  };
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
    const email = (event.queryStringParameters?.email || '').trim().toLowerCase();
    const userId =
      (event.queryStringParameters?.userId || '').trim() || (email ? buildUserId(email) : '');

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'USER_ID_OR_EMAIL_REQUIRED' }),
      };
    }

    const client = await getPool().connect();
    try {
      const profileRes = await client.query(
        `SELECT user_id, email, full_name, kyc_hash, withdrawal_wallet, kyc_locked, metadata
         FROM user_profiles WHERE user_id = $1`,
        [userId]
      );
      const balRes = await client.query(
        `SELECT promo_balance, profit_balance, daily_spend_used, spend_date
         FROM user_balances WHERE user_id = $1`,
        [userId]
      );

      const profile = sanitizeProfile(profileRes.rows[0] || null);
      const bal = balRes.rows[0] || {
        promo_balance: '0',
        profit_balance: '0',
        daily_spend_used: '0',
        spend_date: new Date().toISOString().slice(0, 10),
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          userId,
          profile,
          promoBalance: Number(bal.promo_balance),
          profitBalance: Number(bal.profit_balance),
          dailySpendUsed: Number(bal.daily_spend_used),
          settlementWallet,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'ACCOUNT_LOOKUP_FAILED',
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
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
    const kycId = typeof payload.kycId === 'string' ? payload.kycId.trim() : '';
    const userWallet =
      typeof payload.userWallet === 'string'
        ? payload.userWallet.trim()
        : typeof payload.withdrawalWallet === 'string'
          ? payload.withdrawalWallet.trim()
          : '';

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'VALID_EMAIL_REQUIRED' }),
      };
    }

    const userId = buildUserId(email);
    const incomingKycHash = kycId ? buildKycHash(kycId) : '';
    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        `SELECT user_id, email, full_name, kyc_hash, withdrawal_wallet, kyc_locked, metadata
         FROM user_profiles WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      let resolvedProfile;

      if (existingRes.rows.length === 0) {
        if (!fullName || !incomingKycHash || !userWallet) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ ok: false, error: 'FULL_NAME_KYC_AND_WALLET_REQUIRED' }),
          };
        }

        const insertRes = await client.query(
          `INSERT INTO user_profiles
             (user_id, email, full_name, kyc_hash, withdrawal_wallet, kyc_locked, metadata)
           VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)
           RETURNING user_id, email, full_name, kyc_hash, withdrawal_wallet, kyc_locked, metadata`,
          [
            userId,
            email,
            fullName,
            incomingKycHash,
            userWallet,
            JSON.stringify({ settlementWallet, lockedAt: new Date().toISOString() }),
          ]
        );
        resolvedProfile = sanitizeProfile(insertRes.rows[0]);

        await client.query(
          `INSERT INTO user_balances (user_id, promo_balance, profit_balance, daily_spend_used, spend_date)
           VALUES ($1, 0, 0, 0, CURRENT_DATE)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      } else {
        const current = existingRes.rows[0];
        if (current.kyc_locked) {
          if (fullName && fullName.toLowerCase() !== current.full_name.trim().toLowerCase()) {
            await client.query('ROLLBACK');
            return {
              statusCode: 409,
              headers: corsHeaders,
              body: JSON.stringify({ ok: false, error: 'KYC_NAME_LOCKED' }),
            };
          }
          if (incomingKycHash && incomingKycHash !== current.kyc_hash) {
            await client.query('ROLLBACK');
            return {
              statusCode: 409,
              headers: corsHeaders,
              body: JSON.stringify({ ok: false, error: 'KYC_IDENTITY_LOCKED' }),
            };
          }
        }

        const nextWallet = userWallet || current.withdrawal_wallet;
        const updateRes = await client.query(
          `UPDATE user_profiles
           SET withdrawal_wallet = $2,
               metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
           WHERE user_id = $1
           RETURNING user_id, email, full_name, kyc_hash, withdrawal_wallet, kyc_locked, metadata`,
          [
            userId,
            nextWallet,
            JSON.stringify({ lastSyncedAt: new Date().toISOString(), settlementWallet }),
          ]
        );
        resolvedProfile = sanitizeProfile(updateRes.rows[0]);
      }

      const balRes = await client.query(
        `SELECT promo_balance, profit_balance, daily_spend_used, spend_date
         FROM user_balances WHERE user_id = $1`,
        [userId]
      );
      const bal = balRes.rows[0] || {
        promo_balance: '0',
        profit_balance: '0',
        daily_spend_used: '0',
        spend_date: new Date().toISOString().slice(0, 10),
      };

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          userId,
          profile: resolvedProfile,
          promoBalance: Number(bal.promo_balance),
          profitBalance: Number(bal.profit_balance),
          dailySpendUsed: Number(bal.daily_spend_used),
          settlementWallet,
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
        error: 'ACCOUNT_SYNC_FAILED',
        detail: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    };
  }
}