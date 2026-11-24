export function buildEventMarkets(event, bookmakers = []) {
  const home = event.home_team || event.homeTeam || 'Home';
  const away = event.away_team || event.awayTeam || 'Away';

  let h2hHome = null;
  let h2hDraw = null;
  let h2hAway = null;
  let over25 = null;
  let under25 = null;

  for (const bm of Array.isArray(bookmakers) ? bookmakers : []) {
    for (const mkt of Array.isArray(bm.markets) ? bm.markets : []) {
      if (mkt.key === 'h2h' && Array.isArray(mkt.outcomes)) {
        const h = mkt.outcomes.find((o) => o.name === home);
        const a = mkt.outcomes.find((o) => o.name === away);
        const d = mkt.outcomes.find((o) => String(o.name).toLowerCase().includes('draw'));
        if (h && !h2hHome) h2hHome = Number(h.price);
        if (a && !h2hAway) h2hAway = Number(a.price);
        if (d && !h2hDraw) h2hDraw = Number(d.price);
      }
      if (mkt.key === 'totals' && Array.isArray(mkt.outcomes)) {
        const ov = mkt.outcomes.find((o) => String(o.name).toLowerCase() === 'over' && Number(o.point) === 2.5);
        const un = mkt.outcomes.find((o) => String(o.name).toLowerCase() === 'under' && Number(o.point) === 2.5);
        if (ov && !over25) over25 = Number(ov.price);
        if (un && !under25) under25 = Number(un.price);
      }
    }
  }

  const markets = [];

  const h2hOutcomes = [
    h2hHome ? { code: '1', label: `1 (${home})`, odds: h2hHome } : null,
    h2hDraw ? { code: 'X', label: 'Draw (X)', odds: h2hDraw } : null,
    h2hAway ? { code: '2', label: `2 (${away})`, odds: h2hAway } : null,
  ].filter(Boolean);

  if (h2hOutcomes.length > 0) {
    markets.push({
      marketKey: 'H2H',
      marketLabel: 'Match Result (1X2)',
      lineValue: null,
      outcomes: h2hOutcomes,
    });
  }

  if (h2hHome && h2hDraw && h2hAway) {
    const p1 = 1 / h2hHome;
    const px = 1 / h2hDraw;
    const p2 = 1 / h2hAway;
    const dc1X = Number(Math.max(1.05, 0.94 / (p1 + px)).toFixed(2));
    const dc12 = Number(Math.max(1.05, 0.94 / (p1 + p2)).toFixed(2));
    const dcX2 = Number(Math.max(1.05, 0.94 / (px + p2)).toFixed(2));

    markets.push({
      marketKey: 'DOUBLE_CHANCE',
      marketLabel: 'Double Chance',
      lineValue: null,
      outcomes: [
        { code: '1X', label: `1X (${home} or Draw)`, odds: dc1X },
        { code: '12', label: `12 (${home} or ${away})`, odds: dc12 },
        { code: 'X2', label: `X2 (Draw or ${away})`, odds: dcX2 },
      ],
    });
  }

  if (over25 || under25) {
    markets.push({
      marketKey: 'OVER_UNDER',
      marketLabel: 'Total Goals (Over / Under 2.5)',
      lineValue: 2.5,
      outcomes: [
        over25 ? { code: 'OVER_2_5', label: 'Over 2.5 Goals', odds: over25 } : null,
        under25 ? { code: 'UNDER_2_5', label: 'Under 2.5 Goals', odds: under25 } : null,
      ].filter(Boolean),
    });
  }

  if (h2hHome && h2hAway) {
    const bttsYes = Number(Math.max(1.25, ((h2hHome + h2hAway) / 2) * 0.88).toFixed(2));
    const bttsNo = Number(Math.max(1.25, ((h2hHome + h2hAway) / 2) * 0.96).toFixed(2));
    markets.push({
      marketKey: 'BTTS',
      marketLabel: 'Both Teams to Score',
      lineValue: null,
      outcomes: [
        { code: 'BTTS_YES', label: 'Yes', odds: bttsYes },
        { code: 'BTTS_NO', label: 'No', odds: bttsNo },
      ],
    });
  }

  return markets;
}
