import { Pool } from "pg";

export interface FlashscoreEventRecord {
  externalId: string;
  sportKey: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  commenceTimeIso: string;
  status: "scheduled" | "live" | "finished" | "postponed";
  homeScore?: number | null;
  awayScore?: number | null;
  flashscoreOdds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
}

export interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Array<{
    key: string;
    outcomes: OddsApiOutcome[];
  }>;
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface OddsComparisonResult {
  eventId: string;
  matchup: string;
  commenceTime: string;
  flashscoreOdds: { home: number | null; draw: number | null; away: number | null };
  oddsApiConsensus: { home: number | null; draw: number | null; away: number | null };
  oddsMatchStatus: "ALIGNED" | "DIVERGENT" | "PARTIAL";
  maxSpreadPct: number | null;
  impliedProbabilities: {
    homeRaw: number | null;
    drawRaw: number | null;
    awayRaw: number | null;
    homeFair: number | null;
    drawFair: number | null;
    awayFair: number | null;
    overroundPct: number | null;
  };
  projectedSelection: {
    outcome: "HOME" | "DRAW" | "AWAY" | "NO_EDGE";
    fairProbability: number;
    referenceOdds: number | null;
    rationale: string;
  };
}

export class SovereignFootballAudit {
  private readonly pool: Pool;
  private readonly oddsApiKey: string;
  private readonly baseUrl = "https://api.the-odds-api.com/v4";
  private lastRemainingCredits: string | null = null;
  private lastUsedCredits: string | null = null;

  constructor(databaseUrl: string, oddsApiKey?: string) {
    const key = oddsApiKey || process.env.ODDS_API_KEY;
    if (!key) {
      throw new Error("Missing required ODDS_API_KEY in environment or constructor");
    }
    this.pool = new Pool({ connectionString: databaseUrl });
    this.oddsApiKey = key;
  }

  async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS football_events (
        external_id TEXT PRIMARY KEY,
        sport_key TEXT NOT NULL,
        league_name TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        commence_time TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        home_score INTEGER,
        away_score INTEGER,
        fs_home_odds NUMERIC(8, 3),
        fs_draw_odds NUMERIC(8, 3),
        fs_away_odds NUMERIC(8, 3),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS odds_audits (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES football_events(external_id) ON DELETE CASCADE,
        audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        match_status TEXT NOT NULL,
        max_spread_pct NUMERIC(8, 4),
        api_home_odds NUMERIC(8, 3),
        api_draw_odds NUMERIC(8, 3),
        api_away_odds NUMERIC(8, 3),
        fair_prob_home NUMERIC(6, 4),
        fair_prob_draw NUMERIC(6, 4),
        fair_prob_away NUMERIC(6, 4),
        selection TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_odds_audits_event_id ON odds_audits(event_id);
      CREATE INDEX IF NOT EXISTS idx_football_events_commence ON football_events(commence_time);
    `);
  }

  async syncFlashscoreEventsToSql(events: FlashscoreEventRecord[]): Promise<number> {
    if (!events.length) return 0;

    const query = `
      INSERT INTO football_events (
        external_id, sport_key, league_name, home_team, away_team,
        commence_time, status, home_score, away_score,
        fs_home_odds, fs_draw_odds, fs_away_odds, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6::timestamptz, $7, $8, $9,
        $10, $11, $12, NOW()
      )
      ON CONFLICT (external_id) DO UPDATE SET
        sport_key = EXCLUDED.sport_key,
        league_name = EXCLUDED.league_name,
        home_team = EXCLUDED.home_team,
        away_team = EXCLUDED.away_team,
        commence_time = EXCLUDED.commence_time,
        status = EXCLUDED.status,
        home_score = COALESCE(EXCLUDED.home_score, football_events.home_score),
        away_score = COALESCE(EXCLUDED.away_score, football_events.away_score),
        fs_home_odds = COALESCE(EXCLUDED.fs_home_odds, football_events.fs_home_odds),
        fs_draw_odds = COALESCE(EXCLUDED.fs_draw_odds, football_events.fs_draw_odds),
        fs_away_odds = COALESCE(EXCLUDED.fs_away_odds, football_events.fs_away_odds),
        updated_at = NOW();
    `;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const ev of events) {
        await client.query(query, [
          ev.externalId,
          ev.sportKey,
          ev.leagueName,
          ev.homeTeam,
          ev.awayTeam,
          ev.commenceTimeIso,
          ev.status,
          ev.homeScore ?? null,
          ev.awayScore ?? null,
          ev.flashscoreOdds?.home ?? null,
          ev.flashscoreOdds?.draw ?? null,
          ev.flashscoreOdds?.away ?? null,
        ]);
      }
      await client.query("COMMIT");
      return events.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async fetchOddsApiFootball(
    sportKey: string,
    regions: string = "uk,eu",
    markets: string = "h2h"
  ): Promise<OddsApiEvent[]> {
    const url = new URL(`${this.baseUrl}/sports/${encodeURIComponent(sportKey)}/odds`);
    url.searchParams.set("apiKey", this.oddsApiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString());
    this.lastRemainingCredits = res.headers.get("x-requests-remaining");
    this.lastUsedCredits = res.headers.get("x-requests-used");

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Odds API error (${res.status}): ${errText}`);
    }

    return (await res.json()) as OddsApiEvent[];
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\b(fc|cf|sc|afc|ac|united|city|town|rover|rovers|albion|athletic)\b/g, "")
      .trim();
  }

  private computeConsensusH2H(
    apiEvent: OddsApiEvent
  ): { home: number | null; draw: number | null; away: number | null } {
    const homePrices: number[] = [];
    const drawPrices: number[] = [];
    const awayPrices: number[] = [];

    const normHome = this.normalizeName(apiEvent.home_team);
    const normAway = this.normalizeName(apiEvent.away_team);

    for (const book of apiEvent.bookmakers || []) {
      const h2h = book.markets.find((m) => m.key === "h2h");
      if (!h2h) continue;

      for (const out of h2h.outcomes) {
        if (typeof out.price !== "number" || out.price <= 1) continue;
        const normOut = this.normalizeName(out.name);
        if (normOut === "draw" || normOut.includes("draw")) {
          drawPrices.push(out.price);
        } else if (normOut === normHome || normHome.includes(normOut) || normOut.includes(normHome)) {
          homePrices.push(out.price);
        } else if (normOut === normAway || normAway.includes(normOut) || normOut.includes(normAway)) {
          awayPrices.push(out.price);
        }
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : null;

    return {
      home: avg(homePrices),
      draw: avg(drawPrices),
      away: avg(awayPrices),
    };
  }

  async scanAndPredictWindow(
    startTimeIso: string,
    endTimeIso: string,
    sportKey: string = "soccer_epl",
    tolerancePct: number = 6.0
  ): Promise<{
    credits: { used: string | null; remaining: string | null };
    results: OddsComparisonResult[];
  }> {
    const dbRes = await this.pool.query(
      `
      SELECT external_id, home_team, away_team, commence_time, status,
             fs_home_odds, fs_draw_odds, fs_away_odds
      FROM football_events
      WHERE commence_time >= $1 AND commence_time <= $2
      ORDER BY commence_time ASC;
      `,
      [startTimeIso, endTimeIso]
    );

    const apiEvents = await this.fetchOddsApiFootball(sportKey, "uk,eu", "h2h");
    const results: OddsComparisonResult[] = [];

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const row of dbRes.rows) {
        const rowHome = this.normalizeName(row.home_team);
        const rowAway = this.normalizeName(row.away_team);

        const matchedApi = apiEvents.find((ev) => {
          const apiHome = this.normalizeName(ev.home_team);
          const apiAway = this.normalizeName(ev.away_team);
          return (
            (apiHome.includes(rowHome) || rowHome.includes(apiHome)) &&
            (apiAway.includes(rowAway) || rowAway.includes(apiAway))
          );
        });

        const fsOdds = {
          home: row.fs_home_odds !== null ? Number(row.fs_home_odds) : null,
          draw: row.fs_draw_odds !== null ? Number(row.fs_draw_odds) : null,
          away: row.fs_away_odds !== null ? Number(row.fs_away_odds) : null,
        };

        const apiOdds = matchedApi
          ? this.computeConsensusH2H(matchedApi)
          : { home: null, draw: null, away: null };

        const spreads: number[] = [];
        for (const k of ["home", "draw", "away"] as const) {
          const a = fsOdds[k];
          const b = apiOdds[k];
          if (a && b && a > 1 && b > 1) {
            spreads.push((Math.abs(a - b) / Math.min(a, b)) * 100);
          }
        }

        const maxSpreadPct = spreads.length ? Number(Math.max(...spreads).toFixed(2)) : null;

        let oddsMatchStatus: OddsComparisonResult["oddsMatchStatus"] = "PARTIAL";
        if (maxSpreadPct !== null) {
          oddsMatchStatus = maxSpreadPct <= tolerancePct ? "ALIGNED" : "DIVERGENT";
        }

        const refHome = apiOdds.home ?? fsOdds.home;
        const refDraw = apiOdds.draw ?? fsOdds.draw;
        const refAway = apiOdds.away ?? fsOdds.away;

        const pHomeRaw = refHome && refHome > 1 ? 1 / refHome : null;
        const pDrawRaw = refDraw && refDraw > 1 ? 1 / refDraw : null;
        const pAwayRaw = refAway && refAway > 1 ? 1 / refAway : null;

        const rawSum = [pHomeRaw, pDrawRaw, pAwayRaw]
          .filter((x): x is number => x !== null)
          .reduce((acc, v) => acc + v, 0);

        const overroundPct = rawSum > 0 ? Number(((rawSum - 1) * 100).toFixed(2)) : null;

        const fair = (p: number | null) =>
          p !== null && rawSum > 0 ? Number((p / rawSum).toFixed(4)) : null;

        const pHomeFair = fair(pHomeRaw);
        const pDrawFair = fair(pDrawRaw);
        const pAwayFair = fair(pAwayRaw);

        const candidates: Array<{
          outcome: "HOME" | "DRAW" | "AWAY";
          prob: number;
          odds: number | null;
        }> = [];
        if (pHomeFair !== null) candidates.push({ outcome: "HOME", prob: pHomeFair, odds: refHome });
        if (pDrawFair !== null) candidates.push({ outcome: "DRAW", prob: pDrawFair, odds: refDraw });
        if (pAwayFair !== null) candidates.push({ outcome: "AWAY", prob: pAwayFair, odds: refAway });

        candidates.sort((a, b) => b.prob - a.prob);
        const top = candidates[0];

        const projectedSelection =
          top && top.prob >= 0.52
            ? {
                outcome: top.outcome,
                fairProbability: top.prob,
                referenceOdds: top.odds,
                rationale: `Fair prob ${(top.prob * 100).toFixed(1)}% | Feed status: ${oddsMatchStatus}${
                  maxSpreadPct !== null ? ` (${maxSpreadPct}% max diff)` : ""
                }`,
              }
            : {
                outcome: "NO_EDGE" as const,
                fairProbability: top ? top.prob : 0,
                referenceOdds: top ? top.odds : null,
                rationale: "No high-conviction fair probability threshold (>=52%) met",
              };

        await client.query(
          `
          INSERT INTO odds_audits (
            event_id, match_status, max_spread_pct,
            api_home_odds, api_draw_odds, api_away_odds,
            fair_prob_home, fair_prob_draw, fair_prob_away, selection
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
          `,
          [
            row.external_id,
            oddsMatchStatus,
            maxSpreadPct,
            apiOdds.home,
            apiOdds.draw,
            apiOdds.away,
            pHomeFair,
            pDrawFair,
            pAwayFair,
            projectedSelection.outcome,
          ]
        );

        results.push({
          eventId: row.external_id,
          matchup: `${row.home_team} vs ${row.away_team}`,
          commenceTime: new Date(row.commence_time).toISOString(),
          flashscoreOdds: fsOdds,
          oddsApiConsensus: apiOdds,
          oddsMatchStatus,
          maxSpreadPct,
          impliedProbabilities: {
            homeRaw: pHomeRaw ? Number(pHomeRaw.toFixed(4)) : null,
            drawRaw: pDrawRaw ? Number(pDrawRaw.toFixed(4)) : null,
            awayRaw: pAwayRaw ? Number(pAwayRaw.toFixed(4)) : null,
            homeFair: pHomeFair,
            drawFair: pDrawFair,
            awayFair: pAwayFair,
            overroundPct,
          },
          projectedSelection,
        });
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return {
      credits: {
        used: this.lastUsedCredits,
        remaining: this.lastRemainingCredits,
      },
      results,
    };
  }
}