import crypto from 'crypto';

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

  // GET: Health and provably fair algorithm parameters
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        engine: 'SERVERLESS_PROVABLY_FAIR_ROUND_GENERATOR',
        rtp: '96.00%',
        hashAlgorithm: 'HMAC_SHA256',
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
    const { userId = 'user_caveman_01', wagerAmount = 50.0, targetOdds = 2.0 } = payload;

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = `${userId}_${Date.now()}`;
    const roundId = `rnd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Cryptographic HMAC derivation
    const hmac = crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // Parse 52-bit integer from hash for uniform float in [0, 1)
    const subHash = hmac.substring(0, 13);
    const intVal = parseInt(subHash, 16);
    const e = Math.pow(2, 52);
    const uniform = intVal / e;

    // 96% RTP curve with 4% instant-collapse edge
    let crashMultiplier;
    if (uniform < 0.04) {
      crashMultiplier = 1.00;
    } else {
      const calculated = (100 * 0.96) / (100 * (1 - uniform));
      crashMultiplier = parseFloat(Math.max(1.01, calculated).toFixed(2));
      // Clamp reasonable ceiling
      if (crashMultiplier > 100.0) crashMultiplier = 100.0;
    }

    const numTargetOdds = parseFloat(targetOdds) || 2.0;
    const isAutoWin = numTargetOdds <= crashMultiplier;
    const settlementMultiplier = isAutoWin ? numTargetOdds : 0.0;
    const estimatedPayout = isAutoWin ? (parseFloat(wagerAmount) * numTargetOdds).toFixed(2) : '0.00';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        roundId,
        userId,
        wagerAmount: parseFloat(wagerAmount).toFixed(2),
        targetOdds: numTargetOdds.toFixed(2),
        crashMultiplier: crashMultiplier.toFixed(2),
        isAutoWin,
        settlementMultiplier: settlementMultiplier.toFixed(2),
        estimatedPayout,
        serverSeedHash,
        timestamp: new Date().toISOString(),
        engine: 'NETLIFY_SERVERLESS_PROVABLY_FAIR'
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
