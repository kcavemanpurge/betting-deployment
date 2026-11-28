import crypto from 'node:crypto';

const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';

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

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        engine: 'SERVERLESS_PROVABLY_FAIR_ROUND_GENERATOR',
        rtp: '96.00%',
        hashAlgorithm: 'HMAC_SHA256',
        runtime: 'NETLIFY_SERVERLESS_FUNCTION',
        settlementWallet:
          process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
          process.env.HOT_WALLET_ADDRESS ||
          DEFAULT_SETTLEMENT_WALLET,
      }),
    };
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
    const wagerAmount = Number(payload.wagerAmount);
    const targetOdds = Number(payload.targetOdds ?? 2.0);

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'USER_ID_REQUIRED' }),
      };
    }

    if (!Number.isFinite(wagerAmount) || wagerAmount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_WAGER_AMOUNT' }),
      };
    }

    if (!Number.isFinite(targetOdds) || targetOdds < 1.01) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'INVALID_TARGET_ODDS' }),
      };
    }

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = `${userId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const roundId = `rnd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const hmac = crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    const subHash = hmac.substring(0, 13);
    const intVal = Number.parseInt(subHash, 16);
    const uniform = intVal / 2 ** 52;

    let crashMultiplier;
    if (uniform < 0.04) {
      crashMultiplier = 1.0;
    } else {
      const calculated = (100 * 0.96) / (100 * (1 - uniform));
      crashMultiplier = Math.min(100.0, Number(Math.max(1.01, calculated).toFixed(2)));
    }

    const isAutoWin = targetOdds <= crashMultiplier;
    const settlementMultiplier = isAutoWin ? Number(targetOdds.toFixed(2)) : 0.0;
    const estimatedPayout = isAutoWin
      ? Number((wagerAmount * settlementMultiplier).toFixed(2))
      : 0.0;

    const settlementWallet = (
      process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
      process.env.HOT_WALLET_ADDRESS ||
      DEFAULT_SETTLEMENT_WALLET
    ).trim();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        roundId,
        userId,
        wagerAmount: Number(wagerAmount.toFixed(2)),
        targetOdds: Number(targetOdds.toFixed(2)),
        crashMultiplier: Number(crashMultiplier.toFixed(2)),
        isAutoWin,
        settlementMultiplier,
        estimatedPayout,
        clientSeed,
        serverSeedHash,
        serverSeed,
        settlementWallet,
        timestamp: new Date().toISOString(),
        engine: 'NETLIFY_SERVERLESS_PROVABLY_FAIR',
      }),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'ROUND_GENERATION_FAILED';
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: 'INTERNAL_ROUND_ERROR',
        detail,
      }),
    };
  }
}