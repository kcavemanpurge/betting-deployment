// netlify/functions/sports-catalog.ts
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
  const topLimit = Math.min(10, Math.max(1, Number(event.queryStringParameters?.top || 10)));

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
        error: 'SPORTS_CATALOG_FETCH_FAILED',
        status: response.status,
        settlementWallet,
      }),
    };
  }

  const rawEvents = await response.json();
  const items = Array.isArray(rawEvents) ? rawEvents : [];

  const enriched = items.map((ev, idx) => {
    const markets = buildEventMarkets(ev, ev.bookmakers);
    return {
      eventId: ev.id,
      sportKey: ev.sport_key || sport,
      sportTitle: ev.sport_title || sport,
      category: 'SPORTS',
      homeTeam: ev.home_team,
      awayTeam: ev.away_team,
      commenceTime: ev.commence_time,
      isLive: false,
      status: 'SCHEDULED',
      topPickRank: idx < topLimit ? idx + 1 : null,
      settlementWallet,
      markets,
    };
  });

  const pool = getPool();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ev of enriched) {
        await client.query(
          `INSERT INTO sports_events
             (event_id, sport_key, sport_title, category, home_team, away_team, commence_time, is_live, status, top_pick_rank, settlement_wallet, raw_payload, updated_at)
           VALUES ($1,$2,$3,'SPORTS',$4,$5,$6::timestamptz,false,'SCHEDULED',$7,$8,$9::jsonb,NOW())
           ON CONFLICT (event_id) DO UPDATE SET
             sport_title = EXCLUDED.sport_title,
             commence_time = EXCLUDED.commence_time,
             top_pick_rank = EXCLUDED.top_pick_rank,
             raw_payload = EXCLUDED.raw_payload,
             updated_at = NOW()`,
          [
            ev.eventId,
            ev.sportKey,
            ev.sportTitle,
            ev.homeTeam,
            ev.awayTeam,
            ev.commenceTime,
            ev.topPickRank,
            settlementWallet,
            JSON.stringify(ev),
          ]
        );

        for (const mkt of ev.markets) {
          const marketRowId = `${ev.eventId}::${mkt.marketKey}`;
          await client.query(
            `INSERT INTO event_markets (id, event_id, market_key, market_label, line_value, outcomes, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())
             ON CONFLICT (id) DO UPDATE SET
               market_label = EXCLUDED.market_label,
               line_value = EXCLUDED.line_value,
               outcomes = EXCLUDED.outcomes,
               updated_at = NOW()`,
            [
              marketRowId,
              ev.eventId,
              mkt.marketKey,
              mkt.marketLabel,
              mkt.lineValue,
              JSON.stringify(mkt.outcomes),
            ]
          );
        }

        await client.query(
          `INSERT INTO event_history_daily
             (id, archive_date, event_id, sport_key, home_team, away_team, markets_snapshot, settlement_wallet)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6::jsonb, $7)
           ON CONFLICT (id) DO UPDATE SET
             markets_snapshot = EXCLUDED.markets_snapshot,
             recorded_at = NOW()`,
          [
            `hist_${new Date().toISOString().slice(0, 10)}_${ev.eventId}`,
            ev.eventId,
            ev.sportKey,
            ev.homeTeam,
            ev.awayTeam,
            JSON.stringify(ev.markets),
            settlementWallet,
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
      sport,
      settlementWallet,
      topPicks: enriched.slice(0, topLimit),
      events: enriched,
      quotaRemaining: response.headers.get('x-requests-remaining'),
      fetchedAt: new Date().toISOString(),
    }),
  };
};
