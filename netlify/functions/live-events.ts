// netlify/functions/live-events.ts
import type { Handler } from '@netlify/functions';
import { Pool } from '@neondatabase/serverless';
import { buildEventMarkets } from '../../src/utils/marketBuilder.js';

const DEFAULT_API_KEY = '8a34fc6b3d3ef305027d6679d1e68f12';
const DEFAULT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getPool() {
  const conn = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  return conn ? new Pool({ connectionString: conn }) : null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  const apiKey = (process.env.ODDS_API_KEY || DEFAULT_API_KEY).trim();
  const settlementWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_WALLET
  ).trim();

  const sport = (event.queryStringParameters?.sport || 'soccer_epl').trim();
  const nowMs = Date.now();

  const url =
    `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/odds/` +
    `?apiKey=${encodeURIComponent(apiKey)}&regions=uk,eu,us&markets=h2h,totals`;

  const response = await fetch(url);
  if (!response.ok) {
    return {
      statusCode: response.status,
      headers: HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'LIVE_EVENTS_FETCH_FAILED',
        status: response.status,
        settlementWallet,
      }),
    };
  }

  const rawEvents = await response.json();
  const all = Array.isArray(rawEvents) ? rawEvents : [];

  const ongoing = all
    .filter((ev) => {
      const startMs = ev.commence_time ? new Date(ev.commence_time).getTime() : 0;
      return startMs > 0 && startMs <= nowMs;
    })
    .map((ev) => ({
      eventId: ev.id,
      sportKey: ev.sport_key || sport,
      sportTitle: ev.sport_title || sport,
      category: 'LIVE',
      homeTeam: ev.home_team,
      awayTeam: ev.away_team,
      commenceTime: ev.commence_time,
      isLive: true,
      status: 'LIVE',
      settlementWallet,
      markets: buildEventMarkets(ev, ev.bookmakers),
    }));

  const pool = getPool();
  if (pool && ongoing.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ev of ongoing) {
        await client.query(
          `INSERT INTO sports_events
             (event_id, sport_key, sport_title, category, home_team, away_team, commence_time, is_live, status, settlement_wallet, raw_payload, updated_at)
           VALUES ($1,$2,$3,'LIVE',$4,$5,$6::timestamptz,true,'LIVE',$7,$8::jsonb,NOW())
           ON CONFLICT (event_id) DO UPDATE SET
             category = 'LIVE',
             is_live = true,
             status = 'LIVE',
             raw_payload = EXCLUDED.raw_payload,
             updated_at = NOW()`,
          [
            ev.eventId,
            ev.sportKey,
            ev.sportTitle,
            ev.homeTeam,
            ev.awayTeam,
            ev.commenceTime,
            settlementWallet,
            JSON.stringify(ev),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      ok: true,
      category: 'LIVE',
      sport,
      settlementWallet,
      liveEvents: ongoing,
      fetchedAt: new Date().toISOString(),
    }),
  };
};
