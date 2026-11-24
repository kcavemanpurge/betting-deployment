// netlify/functions/live-odds.ts
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const apiKey = process.env.ODDS_API_KEY || '8a34fc6b3d3ef305027d6679d1e68f12';
  const oddsWallet =
    process.env.NETLIFY_ODDS_WALLET_ADDRESS || '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
  const sport = event.queryStringParameters?.sport || 'soccer_epl';

  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(
    sport
  )}/odds/?apiKey=${encodeURIComponent(apiKey)}&regions=uk,eu,us&markets=h2h`;

  const response = await fetch(url);
  if (!response.ok) {
    return {
      statusCode: response.status,
      body: JSON.stringify({ error: 'Odds API fetch failed', status: response.status }),
    };
  }

  const events = await response.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sport,
      oddsWallet,
      fetchedAt: new Date().toISOString(),
      events,
    }),
  };
};
