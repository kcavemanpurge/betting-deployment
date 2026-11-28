export interface SimTeam {
  id: number;
  league_code: string;
  team_name: string;
  sim_rating: number;
}

export interface SimulatedMatchResult {
  league_code: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  outcome: 'HOME' | 'DRAW' | 'AWAY';
  sequence_index: number;
}

function nextSeededInt(seed: number, maxExclusive: number): { value: number; nextSeed: number } {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  const value = maxExclusive > 0 ? nextSeed % maxExclusive : 0;
  return { value, nextSeed };
}

export function simulateFiveLeagueSequence(
  teamsByLeague: Record<string, SimTeam[]>,
  leagueSequence: string[],
  initialSeed = 20261128
): { matches: SimulatedMatchResult[]; finalSeed: number } {
  let seed = initialSeed >>> 0;
  let seqIndex = 0;
  const matches: SimulatedMatchResult[] = [];

  for (const leagueCode of leagueSequence.slice(0, 5)) {
    const roster = teamsByLeague[leagueCode] ?? [];
    if (roster.length < 2) continue;

    for (let i = 0; i + 1 < roster.length; i += 2) {
      const home = roster[i];
      const away = roster[i + 1];

      const ratingDiff = (home.sim_rating - away.sim_rating) / 25;
      const r1 = nextSeededInt(seed, 4);
      seed = r1.nextSeed;
      const r2 = nextSeededInt(seed, 4);
      seed = r2.nextSeed;

      const homeGoals = Math.max(0, Math.min(5, Math.round(r1.value * 0.6 + Math.max(0, ratingDiff))));
      const awayGoals = Math.max(0, Math.min(5, Math.round(r2.value * 0.6 + Math.max(0, -ratingDiff))));

      const outcome: SimulatedMatchResult['outcome'] =
        homeGoals > awayGoals ? 'HOME' : awayGoals > homeGoals ? 'AWAY' : 'DRAW';

      matches.push({
        league_code: leagueCode,
        home_team: home.team_name,
        away_team: away.team_name,
        home_goals: homeGoals,
        away_goals: awayGoals,
        outcome,
        sequence_index: seqIndex++,
      });
    }
  }

  return { matches, finalSeed: seed };
}