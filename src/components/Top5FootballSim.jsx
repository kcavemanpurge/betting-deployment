import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Trophy,
  RefreshCw,
  Play,
  Pause,
  FastForward,
  ExternalLink,
  Radio,
  Activity,
  List,
  Tv,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const LEAGUE_META = {
  EPL: { name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', count: 20 },
  LALIGA: { name: 'La Liga', country: 'Spain', flag: '🇪🇸', count: 20 },
  SERIEA: { name: 'Serie A', country: 'Italy', flag: '🇮🇹', count: 20 },
  BUNDESLIGA: { name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', count: 18 },
  LIGUE1: { name: 'Ligue 1', country: 'France', flag: '🇫🇷', count: 18 },
};

const LEAGUE_TEAMS = {
  EPL: [
    'Arsenal', 'Aston Villa', 'AFC Bournemouth', 'Brentford', 'Brighton & Hove Albion',
    'Chelsea', 'Coventry City', 'Crystal Palace', 'Everton', 'Fulham',
    'Hull City', 'Ipswich Town', 'Leeds United', 'Liverpool', 'Manchester City',
    'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur',
  ],
  LALIGA: [
    'Alaves', 'Ath Bilbao', 'Atl. Madrid', 'Barcelona', 'Betis',
    'Celta Vigo', 'Dep. A Coruna', 'Elche', 'Espanyol', 'Getafe',
    'Levante', 'Malaga', 'Osasuna', 'Racing Santander', 'Rayo Vallecano',
    'Real Madrid', 'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal',
  ],
  SERIEA: [
    'AC Milan', 'AC Monza', 'ACF Fiorentina', 'AS Roma', 'Atalanta BC',
    'Bologna FC 1909', 'Cagliari Calcio', 'Como 1907', 'Frosinone Calcio', 'Genoa CFC',
    'Inter Milan', 'Juventus FC', 'Parma Calcio 1913', 'S.S. Lazio', 'SSC Napoli',
    'Torino FC', 'U.S. Lecce', 'U.S. Sassuolo Calcio', 'Udinese Calcio', 'Venezia FC',
  ],
  BUNDESLIGA: [
    '1. FC Köln', '1. FC Union Berlin', '1. FSV Mainz 05', 'Bayer 04 Leverkusen', 'Borussia Dortmund',
    'Borussia Mönchengladbach', 'Eintracht Frankfurt', 'FC Augsburg', 'FC Bayern München', 'FC Schalke 04',
    'Hamburger SV', 'RB Leipzig', 'SC Freiburg', 'SC Paderborn 07', 'SV Elversberg',
    'SV Werder Bremen', 'TSG Hoffenheim', 'VfB Stuttgart',
  ],
  LIGUE1: [
    'AJ Auxerre', 'Angers SCO', 'AS Monaco', 'ES Troyes AC', 'FC Lorient',
    'Le Havre AC', 'Le Mans FC', 'LOSC Lille', 'OGC Nice', 'Olympique de Marseille',
    'Olympique Lyonnais', 'Paris FC', 'Paris Saint-Germain', 'RC Lens', 'RC Strasbourg',
    'Stade Brestois 29', 'Stade Rennais', 'Toulouse FC',
  ],
};

const STORAGE_KEY = 'top5_2627_sim_state_v2';
const NEXT_MATCH_COUNTDOWN_SEC = 6;
const SPEED_OPTIONS = [1, 2, 4, 8];

function buildFixturesForLeague(leagueCode) {
  const teams = LEAGUE_TEAMS[leagueCode] || [];
  const pairs = [];
  for (let i = 0; i + 1 < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];
    const hHash = (home.length * 13 + 7) % 15;
    const aHash = (away.length * 17 + 11) % 15;
    const homePrice = (1.55 + hHash * 0.12).toFixed(2);
    const drawPrice = (3.1 + ((hHash + aHash) % 5) * 0.1).toFixed(2);
    const awayPrice = (1.8 + aHash * 0.14).toFixed(2);

    pairs.push({
      id: `${leagueCode}_${home}_vs_${away}`,
      league: leagueCode,
      home,
      away,
      homePrice,
      drawPrice,
      awayPrice,
    });
  }
  return pairs;
}

function createInitialState() {
  const table = {};
  for (const [code, teams] of Object.entries(LEAGUE_TEAMS)) {
    table[code] = teams.map((name) => ({ name, p: 0, w: 0, d: 0, l: 0, pts: 0 }));
  }
  return { table, logs: [] };
}

export function Top5FootballSim({ picks = [], onTogglePick = () => {} }) {
  const [selectedLeague, setSelectedLeague] = useState('EPL');
  // 'pitch' = single-match animated play view | 'stream' = all ongoing league fixtures/list
  const [displayMode, setDisplayMode] = useState('pitch');
  const [activeSubTab, setActiveSubTab] = useState('fixtures'); // 'fixtures' | 'standings'

  const [simState, setSimState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore storage read errors
    }
    return createInitialState();
  });

  const saveState = useCallback((nextState) => {
    setSimState(nextState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const leagueFixtures = useMemo(() => buildFixturesForLeague(selectedLeague), [selectedLeague]);

  // Selected match in current league for single-match animated pitch simulation
  const [selectedMatchId, setSelectedMatchId] = useState(() => {
    const first = buildFixturesForLeague('EPL')[0];
    return first ? first.id : '';
  });

  // Keep selectedMatchId valid when user switches leagues
  useEffect(() => {
    if (!leagueFixtures.some((f) => f.id === selectedMatchId) && leagueFixtures[0]) {
      setSelectedMatchId(leagueFixtures[0].id);
    }
  }, [selectedLeague, leagueFixtures, selectedMatchId]);

  const watchedMatch = useMemo(
    () => leagueFixtures.find((f) => f.id === selectedMatchId) || leagueFixtures[0] || null,
    [leagueFixtures, selectedMatchId]
  );

  // Independent match simulation clock & phase ('PLAYING' | 'RESULT_HOLD')
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 4x, 8x fast-forward
  const [matchPhase, setMatchPhase] = useState('PLAYING'); // 'PLAYING' | 'RESULT_HOLD'
  const [simMinute, setSimMinute] = useState(1);
  const [nextCountdown, setNextCountdown] = useState(0);

  // Live scores for all fixtures in the current league
  const [liveScores, setLiveScores] = useState({});
  const [ballPos, setBallPos] = useState({ x: 50, y: 50, possession: 'HOME', eventText: 'Kickoff underway' });

  const pitchCanvasRef = useRef(null);
  const ballRef = useRef({ x: 50, y: 50, vx: 1.4, vy: 0.9 });

  // Initialize live scores for league fixtures when league changes
  useEffect(() => {
    const initialScores = {};
    leagueFixtures.forEach((fix, idx) => {
      initialScores[fix.id] = {
        hg: idx === 0 ? 1 : 0,
        ag: 0,
        minute: Math.min(88, 12 + idx * 9),
        status: 'LIVE',
      };
    });
    setLiveScores(initialScores);
    setSimMinute(1);
    setMatchPhase('PLAYING');
    setNextCountdown(0);
    setIsPaused(false);
  }, [selectedLeague, leagueFixtures]);

  const recordCompletedMatch = useCallback(
    (match, hg, ag) => {
      if (!match) return;
      const teams = simState.table[selectedLeague].map((t) => ({ ...t }));
      const homeRow = teams.find((t) => t.name === match.home);
      const awayRow = teams.find((t) => t.name === match.away);

      if (homeRow && awayRow) {
        homeRow.p += 1;
        awayRow.p += 1;
        if (hg > ag) {
          homeRow.w += 1;
          homeRow.pts += 3;
          awayRow.l += 1;
        } else if (ag > hg) {
          awayRow.w += 1;
          awayRow.pts += 3;
          homeRow.l += 1;
        } else {
          homeRow.d += 1;
          awayRow.d += 1;
          homeRow.pts += 1;
          awayRow.pts += 1;
        }
      }

      const nextLogs = [
        {
          id: `${match.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          code: selectedLeague,
          home: match.home,
          away: match.away,
          hg,
          ag,
          ts: Date.now(),
        },
        ...simState.logs,
      ].slice(0, 80);

      saveState({
        table: {
          ...simState.table,
          [selectedLeague]: teams,
        },
        logs: nextLogs,
      });
    },
    [selectedLeague, simState, saveState]
  );

  // Independent fast-forwardable match clock & post-match result -> next countdown sequence
  useEffect(() => {
    if (isPaused || !watchedMatch) return;

    if (matchPhase === 'RESULT_HOLD') {
      if (nextCountdown <= 0) {
        // Rotate to next fixture in the league and start fresh
        const currentIdx = leagueFixtures.findIndex((f) => f.id === watchedMatch.id);
        const nextIdx = (currentIdx + 1) % Math.max(1, leagueFixtures.length);
        const nextMatch = leagueFixtures[nextIdx];
        if (nextMatch) {
          setSelectedMatchId(nextMatch.id);
          setLiveScores((prev) => ({
            ...prev,
            [nextMatch.id]: { hg: 0, ag: 0, minute: 1, status: 'LIVE' },
          }));
        }
        setSimMinute(1);
        setMatchPhase('PLAYING');
        setBallPos({ x: 50, y: 50, possession: 'HOME', eventText: 'Next fixture kicked off' });
        return;
      }

      const holdTimer = setTimeout(() => {
        setNextCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(holdTimer);
    }

    // PLAYING phase: tick minute faster at higher speedMultiplier (1x, 2x, 4x, 8x)
    const tickIntervalMs = Math.max(140, Math.round(900 / speedMultiplier));
    const clockTimer = setInterval(() => {
      setSimMinute((prevMin) => {
        const nextMin = prevMin + 1;

        // Occasional goal event during play
        const roll = Math.random();
        let goalScoredBy = null;
        if (roll < 0.045) goalScoredBy = 'HOME';
        else if (roll > 0.955) goalScoredBy = 'AWAY';

        setLiveScores((prevScores) => {
          const cur = prevScores[watchedMatch.id] || { hg: 0, ag: 0, minute: 1, status: 'LIVE' };
          const updatedHg = cur.hg + (goalScoredBy === 'HOME' ? 1 : 0);
          const updatedAg = cur.ag + (goalScoredBy === 'AWAY' ? 1 : 0);

          if (goalScoredBy) {
            setBallPos((b) => ({
              ...b,
              x: goalScoredBy === 'HOME' ? 92 : 8,
              y: 50,
              possession: goalScoredBy,
              eventText: `GOAL! ${goalScoredBy === 'HOME' ? watchedMatch.home : watchedMatch.away} (${nextMin}')`,
            }));
          }

          if (nextMin >= 90) {
            recordCompletedMatch(watchedMatch, updatedHg, updatedAg);
            setMatchPhase('RESULT_HOLD');
            setNextCountdown(NEXT_MATCH_COUNTDOWN_SEC);
            return {
              ...prevScores,
              [watchedMatch.id]: { hg: updatedHg, ag: updatedAg, minute: 90, status: 'FT' },
            };
          }

          return {
            ...prevScores,
            [watchedMatch.id]: { hg: updatedHg, ag: updatedAg, minute: nextMin, status: 'LIVE' },
          };
        });

        return Math.min(90, nextMin);
      });
    }, tickIntervalMs);

    return () => clearInterval(clockTimer);
  }, [
    isPaused,
    speedMultiplier,
    matchPhase,
    nextCountdown,
    watchedMatch,
    leagueFixtures,
    recordCompletedMatch,
  ]);

  // Smooth HTML5 Canvas football pitch animation for the selected match
  useEffect(() => {
    if (displayMode !== 'pitch') return;
    const canvas = pitchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;

    const drawPitch = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Pitch turf
      ctx.fillStyle = '#071811';
      ctx.fillRect(0, 0, w, h);

      // Pitch markings
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 14, w - 32, h - 28);

      // Halfway line & center circle
      ctx.beginPath();
      ctx.moveTo(w / 2, 14);
      ctx.lineTo(w / 2, h - 14);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.16, 0, Math.PI * 2);
      ctx.stroke();

      // Penalty boxes
      const boxW = w * 0.14;
      const boxH = h * 0.46;
      ctx.strokeRect(16, (h - boxH) / 2, boxW, boxH);
      ctx.strokeRect(w - 16 - boxW, (h - boxH) / 2, boxW, boxH);

      // Move ball smoothly when playing
      if (!isPaused && matchPhase === 'PLAYING') {
        const speedFactor = 0.7 + speedMultiplier * 0.35;
        ballRef.current.x += ballRef.current.vx * speedFactor;
        ballRef.current.y += ballRef.current.vy * speedFactor;

        if (ballRef.current.x < 24 || ballRef.current.x > w - 24) {
          ballRef.current.vx *= -1;
          ballRef.current.x = Math.max(24, Math.min(w - 24, ballRef.current.x));
        }
        if (ballRef.current.y < 22 || ballRef.current.y > h - 22) {
          ballRef.current.vy *= -1;
          ballRef.current.y = Math.max(22, Math.min(h - 22, ballRef.current.y));
        }
      }

      // Draw ball + glow
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.arc(ballRef.current.x, ballRef.current.y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(ballRef.current.x, ballRef.current.y, 5.5, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(drawPitch);
    };

    drawPitch();
    return () => cancelAnimationFrame(rafId);
  }, [displayMode, isPaused, matchPhase, speedMultiplier]);

  const resetLeague = () => {
    const fresh = createInitialState();
    saveState(fresh);
    setSimMinute(1);
    setMatchPhase('PLAYING');
    setNextCountdown(0);
  };

  const isSelected = (matchId, selection) =>
    picks.some((p) => p.matchId === matchId && p.selection === selection);

  const currentTeams = simState.table[selectedLeague] || [];
  const sortedStandings = [...currentTeams].sort(
    (a, b) => b.pts - a.pts || b.w - a.w || a.name.localeCompare(b.name)
  );

  // Scoped strictly to the selected league for the running results ticker
  const leagueResultsTicker = simState.logs.filter((item) => item.code === selectedLeague).slice(0, 20);
  const watchedScore = watchedMatch
    ? liveScores[watchedMatch.id] || { hg: 0, ag: 0, minute: simMinute, status: 'LIVE' }
    : { hg: 0, ag: 0, minute: 1, status: 'LIVE' };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="bg-gray-950 p-5 sm:p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Top 5 Football Simulation (2026/2027)
              </h2>
              <p className="text-[11px] text-slate-400">
                {LEAGUE_META[selectedLeague].flag} {LEAGUE_META[selectedLeague].name} • Scoped Live Stream &amp; Pitch Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/top5-football.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/30 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Standalone Sim
            </a>
            <button
              type="button"
              onClick={resetLeague}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded border border-slate-800 transition cursor-pointer"
              title="Reset simulation data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* League Selector (Switching league shows only that league's matches, scores & results) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(LEAGUE_META).map(([code, meta]) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedLeague(code)}
              className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                selectedLeague === code
                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-sm">{meta.flag}</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">{code}</div>
              <div className="text-[10px] text-slate-500 truncate">{meta.name}</div>
            </button>
          ))}
        </div>

        {/* Simulation Display Mode Switcher: Match Pitch View vs. League Live Stream/List */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDisplayMode('pitch');
                setActiveSubTab('fixtures');
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                displayMode === 'pitch' && activeSubTab === 'fixtures'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5" /> MATCH PLAY VIEW
            </button>

            <button
              type="button"
              onClick={() => {
                setDisplayMode('stream');
                setActiveSubTab('fixtures');
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                displayMode === 'stream' && activeSubTab === 'fixtures'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <List className="w-3.5 h-3.5" /> LEAGUE STREAM LIST ({leagueFixtures.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('standings')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'standings'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              STANDINGS
            </button>
          </div>

          {/* Independent Clock & Fast-Forward Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              title={isPaused ? 'Resume Simulation Clock' : 'Pause Simulation Clock'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <FastForward className="w-3.5 h-3.5 text-cyan-400 ml-1" />
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  speedMultiplier === spd
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* MODE 1: SINGLE-MATCH ANIMATED PITCH VIEW */}
        {activeSubTab === 'fixtures' && displayMode === 'pitch' && watchedMatch && (
          <div className="space-y-4 pt-1">
            {/* Match Selector Strip for Current League */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] text-slate-400 shrink-0">WATCH MATCH:</span>
              {leagueFixtures.map((fix) => {
                const sc = liveScores[fix.id] || { hg: 0, ag: 0 };
                const active = fix.id === watchedMatch.id;
                return (
                  <button
                    key={fix.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatchId(fix.id);
                      setMatchPhase('PLAYING');
                      setSimMinute(1);
                    }}
                    className={`px-2.5 py-1 rounded border text-[11px] shrink-0 transition cursor-pointer ${
                      active
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fix.home} {sc.hg}-{sc.ag} {fix.away}
                  </button>
                );
              })}
            </div>

            {/* Scoreboard + Post-Match Result Hold / Next Countdown */}
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm font-bold text-white">
                <span>{watchedMatch.home}</span>
                <span className="px-2.5 py-1 rounded bg-slate-950 border border-emerald-500/40 text-emerald-400 font-black">
                  {watchedScore.hg} - {watchedScore.ag}
                </span>
                <span>{watchedMatch.away}</span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {matchPhase === 'RESULT_HOLD' ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    FT RESULT • NEXT MATCH IN {nextCountdown}s
                  </span>
                ) : (
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {watchedScore.minute}&apos; ({speedMultiplier}x)
                  </span>
                )}
              </div>
            </div>

            {/* Pitch Canvas */}
            <div className="relative rounded-lg overflow-hidden border border-slate-800">
              <canvas
                ref={pitchCanvasRef}
                width={640}
                height={280}
                className="w-full h-56 sm:h-64 block"
              />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800/80">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> {ballPos.eventText}
                </span>
                <span className="text-slate-400">
                  {matchPhase === 'RESULT_HOLD'
                    ? `Sequencing next fixture in ${nextCountdown}s...`
                    : `Clock: ${watchedScore.minute}'`}
                </span>
              </div>
            </div>

            {/* 1 / X / 2 Odds for Selected Match */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { sel: '1', label: `1 (${watchedMatch.home})`, price: watchedMatch.homePrice },
                { sel: 'X', label: 'X (Draw)', price: watchedMatch.drawPrice },
                { sel: '2', label: `2 (${watchedMatch.away})`, price: watchedMatch.awayPrice },
              ].map((opt) => {
                const picked = isSelected(watchedMatch.id, opt.sel);
                return (
                  <button
                    key={opt.sel}
                    type="button"
                    onClick={() =>
                      onTogglePick({
                        id: `${watchedMatch.id}_${opt.sel}`,
                        matchId: watchedMatch.id,
                        match: `${watchedMatch.home} vs ${watchedMatch.away}`,
                        league: selectedLeague,
                        selection: opt.sel,
                        selectionName: opt.label,
                        price: opt.price,
                      })
                    }
                    className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                      picked
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-black'
                        : 'bg-slate-900 border-slate-800 hover:border-cyan-500/50 text-slate-200'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400 truncate">{opt.label}</div>
                    <div className="text-xs font-extrabold mt-0.5">{opt.price}x</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 2: ALL ONGOING LEAGUE FIXTURES & STREAM LIST */}
        {activeSubTab === 'fixtures' && displayMode === 'stream' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {leagueFixtures.map((fix) => {
              const sc = liveScores[fix.id] || { hg: 0, ag: 0, minute: 15, status: 'LIVE' };
              const homePicked = isSelected(fix.id, '1');
              const drawPicked = isSelected(fix.id, 'X');
              const awayPicked = isSelected(fix.id, '2');

              return (
                <div
                  key={fix.id}
                  className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Radio className="w-3 h-3" /> {sc.status} {sc.minute}&apos;
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMatchId(fix.id);
                        setDisplayMode('pitch');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Watch Pitch →
                    </button>
                  </div>

                  <div className="text-xs font-bold text-white flex items-center justify-between gap-2">
                    <span className="truncate flex-1">{fix.home}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                      {sc.hg} - {sc.ag}
                    </span>
                    <span className="truncate flex-1 text-right">{fix.away}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { sel: '1', label: '1 (Home)', price: fix.homePrice, picked: homePicked },
                      { sel: 'X', label: 'X (Draw)', price: fix.drawPrice, picked: drawPicked },
                      { sel: '2', label: '2 (Away)', price: fix.awayPrice, picked: awayPicked },
                    ].map((btn) => (
                      <button
                        key={btn.sel}
                        type="button"
                        onClick={() =>
                          onTogglePick({
                            id: `${fix.id}_${btn.sel}`,
                            matchId: fix.id,
                            match: `${fix.home} vs ${fix.away}`,
                            league: selectedLeague,
                            selection: btn.sel,
                            selectionName: `${fix.home} vs ${fix.away} (${btn.sel})`,
                            price: btn.price,
                          })
                        }
                        className={`p-1.5 rounded text-center transition cursor-pointer border ${
                          btn.picked
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-black'
                            : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">{btn.label}</div>
                        <div className="font-extrabold text-xs">{btn.price}x</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STANDINGS TAB */}
        {activeSubTab === 'standings' && (
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 mt-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Club</th>
                  <th className="py-2 px-3 text-center">P</th>
                  <th className="py-2 px-3 text-center">W</th>
                  <th className="py-2 px-3 text-center">D</th>
                  <th className="py-2 px-3 text-center">L</th>
                  <th className="py-2 px-3 text-right">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {sortedStandings.map((t, idx) => (
                  <tr key={t.name} className="hover:bg-slate-900/40">
                    <td className="py-2 px-3 text-slate-500 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200">{t.name}</td>
                    <td className="py-2 px-3 text-center text-slate-400">{t.p}</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">{t.w}</td>
                    <td className="py-2 px-3 text-center text-amber-400">{t.d}</td>
                    <td className="py-2 px-3 text-center text-rose-400">{t.l}</td>
                    <td className="py-2 px-3 text-right font-extrabold text-cyan-300">{t.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Continuous Running Results Line Underneath (Scoped to Selected League) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 overflow-hidden flex items-center gap-3">
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
          {selectedLeague} RESULTS
        </span>
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-[11px] text-slate-300">
          {leagueResultsTicker.length === 0 ? (
            <span className="text-slate-500">
              Completed {selectedLeague} match scores will stream here as matches finish.
            </span>
          ) : (
            leagueResultsTicker.map((res) => (
              <span key={res.id} className="inline-flex items-center gap-1.5 shrink-0">
                <span className="text-slate-200 font-semibold">{res.home}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold">
                  {res.hg} - {res.ag}
                </span>
                <span className="text-slate-200 font-semibold">{res.away}</span>
                <span className="text-slate-600">•</span>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}