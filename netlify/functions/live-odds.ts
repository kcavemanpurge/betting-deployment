// netlify/functions/live-odds.ts
import type { Handler, HandlerEvent } from '@netlify/functions';

const DEFAULT_ODDS_API_KEY = '8a34fc6b3d3ef305027d6679d1e68f12';
const DEFAULT_ODDS_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const DEFAULT_ODDS_BASE_URL = 'https://api.the-odds-api.com/v4';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function resolveSportKey(rawSport?: string): string {
  const normalized = (rawSport || 'soccer_epl').trim().toLowerCase();
  const map: Record<string, string> = {
    epl: 'soccer_epl',
    premier_league: 'soccer_epl',
    soccer_epl: 'soccer_epl',
    laliga: 'soccer_spain_la_liga',
    la_liga: 'soccer_spain_la_liga',
    soccer_spain_la_liga: 'soccer_spain_la_liga',
    seriea: 'soccer_italy_serie_a',
    serie_a: 'soccer_italy_serie_a',
    soccer_italy_serie_a: 'soccer_italy_serie_a',
    bundesliga: 'soccer_germany_bundesliga',
    soccer_germany_bundesliga: 'soccer_germany_bundesliga',
    ligue1: 'soccer_france_ligue_one',
    ligue_1: 'soccer_france_ligue_one',
    soccer_france_ligue_one: 'soccer_france_ligue_one',
    nba: 'basketball_nba',
    basketball_nba: 'basketball_nba',
    ncaab: 'basketball_ncaab',
    basketball_ncaab: 'basketball_ncaab',
    nfl: 'americanfootball_nfl',
    americanfootball_nfl: 'americanfootball_nfl',
  };
  return map[normalized] || normalized;
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  const apiKey = (process.env.ODDS_API_KEY || DEFAULT_ODDS_API_KEY).trim();
  const oddsWallet = (
    process.env.NETLIFY_ODDS_WALLET_ADDRESS ||
    process.env.HOT_WALLET_ADDRESS ||
    DEFAULT_ODDS_WALLET
  ).trim();
  const baseUrl = (process.env.ODDS_API_BASE_URL || DEFAULT_ODDS_BASE_URL).replace(/\/+$/, '');

  const sport = resolveSportKey(event.queryStringParameters?.sport);
  const regions = (event.queryStringParameters?.regions || 'uk,eu,us').trim();
  const markets = (event.queryStringParameters?.markets || 'h2h,spreads,totals').trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url =
      `${baseUrl}/sports/${encodeURIComponent(sport)}/odds/` +
      `?apiKey=${encodeURIComponent(apiKey)}` +
      `&regions=${encodeURIComponent(regions)}` +
      `&markets=${encodeURIComponent(markets)}`;

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: false,
          error: 'Odds API fetch failed',
          status: response.status,
          detail: errorText || response.statusText,
          sport,
          oddsWallet,
        }),
      };
    }

    const events = await response.json();
    const list = Array.isArray(events) ? events : [];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        sport,
        count: list.length,
        oddsWallet,
        quota: {
          remaining: remainingRequests ? Number(remainingRequests) : null,
          used: usedRequests ? Number(usedRequests) : null,
        },
        fetchedAt: new Date().toISOString(),
        events: list,
      }),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'Live odds upstream request failed',
        detail: message,
        sport,
        oddsWallet,
      }),
    };
  }
};
