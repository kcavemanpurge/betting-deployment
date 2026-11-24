import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, 
  RefreshCw, 
  Play, 
  ShieldCheck, 
  ExternalLink, 
  Flame, 
  Plus, 
  Check, 
  Layers, 
  Radio, 
  Activity, 
  ChevronRight,
  TrendingUp,
  Sliders
} from 'lucide-react';

const LEAGUE_META = {
  EPL: { name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', count: 20 },
  LALIGA: { name: 'La Liga', country: 'Spain', flag: '🇪🇸', count: 20 },
  SERIEA: { name: 'Serie A (Syria)', country: 'Italy', flag: '🇮🇹', count: 20 },
  BUNDESLIGA: { name: 'Bundesliga (Ambulance)', country: 'Germany', flag: '🇩🇪', count: 18 },
  LIGUE1: { name: 'Ligue 1', country: 'France', flag: '🇫🇷', count: 18 }
};

const LEAGUE_TEAMS = {
  EPL: ['Arsenal','Aston Villa','AFC Bournemouth','Brentford','Brighton & Hove Albion','Chelsea','Coventry City','Crystal Palace','Everton','Fulham','Hull City','Ipswich Town','Leeds United','Liverpool','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Sunderland','Tottenham Hotspur'],
  LALIGA: ['Alaves','Ath Bilbao','Atl. Madrid','Barcelona','Betis','Celta Vigo','Dep. A Coruna','Elche','Espanyol','Getafe','Levante','Malaga','Osasuna','Racing Santander','Rayo Vallecano','Real Madrid','Real Sociedad','Sevilla','Valencia','Villarreal'],
  SERIEA: ['AC Milan','AC Monza','ACF Fiorentina','AS Roma','Atalanta BC','Bologna FC 1909','Cagliari Calcio','Como 1907','Frosinone Calcio','Genoa CFC','Inter Milan','Juventus FC','Parma Calcio 1913','S.S. Lazio','SSC Napoli','Torino FC','U.S. Lecce','U.S. Sassuolo Calcio','Udinese Calcio','Venezia FC'],
  BUNDESLIGA: ['1. FC Köln','1. FC Union Berlin','1. FSV Mainz 05','Bayer 04 Leverkusen','Borussia Dortmund','Borussia Mönchengladbach','Eintracht Frankfurt','FC Augsburg','FC Bayern München','FC Schalke 04','Hamburger SV','RB Leipzig','SC Freiburg','SC Paderborn 07','SV Elversberg','SV Werder Bremen','TSG Hoffenheim','VfB Stuttgart'],
  LIGUE1: ['AJ Auxerre','Angers SCO','AS Monaco','ES Troyes AC','FC Lorient','Le Havre AC','Le Mans FC','LOSC Lille','OGC Nice','Olympique de Marseille','Olympique Lyonnais','Paris FC','Paris Saint-Germain','RC Lens','RC Strasbourg','Stade Brestois 29','Stade Rennais','Toulouse FC']
};

const STORAGE_KEY = 'top5_2627_sim_state_v1';

export function Top5FootballSim({
  picks = [],
  onTogglePick = () => {}
}) {
  const [selectedLeague, setSelectedLeague] = useState('EPL');
  const [activeSubTab, setActiveSubTab] = useState('fixtures'); // 'fixtures' | 'board' | 'standings'
  
  // Live Automated Simulation Engine (Auto-Generation without depending solely on manual clicks)
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [activeLiveEvent, setActiveLiveEvent] = useState(null);
  const autoSimTimerRef = useRef(null);

  // Simulation State
  const [simState, setSimState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const table = {};
    for (const [code, teams] of Object.entries(LEAGUE_TEAMS)) {
      table[code] = teams.map((name) => ({ name, p: 0, w: 0, d: 0, l: 0, pts: 0 }));
    }
    return { table, logs: [] };
  });

  const saveState = useCallback((newState) => {
    setSimState(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {}
  }, []);

  // Generate Match Pairings for the current league
  const generateFixtures = useCallback((leagueCode) => {
    const teams = LEAGUE_TEAMS[leagueCode] || [];
    const pairs = [];
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const home = teams[i];
      const away = teams[i + 1];
      // Deterministic pseudo odds based on team name hash
      const hHash = (home.length * 13 + 7) % 15;
      const aHash = (away.length * 17 + 11) % 15;
      const homePrice = (1.55 + hHash * 0.12).toFixed(2);
      const drawPrice = (3.10 + ((hHash + aHash) % 5) * 0.10).toFixed(2);
      const awayPrice = (1.80 + aHash * 0.14).toFixed(2);

      pairs.push({
        id: `${leagueCode}_${home}_vs_${away}`,
        league: leagueCode,
        home,
        away,
        homePrice,
        drawPrice,
        awayPrice
      });
    }
    return pairs;
  }, []);

  const currentFixtures = generateFixtures(selectedLeague);

  // Execute a Simulation Round
  const simulateRound = useCallback(() => {
    const teams = [...simState.table[selectedLeague]];
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const newLogs = [...simState.logs];

    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const home = shuffled[i];
      const away = shuffled[i + 1];
      const hg = Math.floor(Math.random() * 4);
      const ag = Math.floor(Math.random() * 4);

      home.p += 1;
      away.p += 1;
      if (hg > ag) {
        home.w += 1;
        home.pts += 3;
        away.l += 1;
      } else if (ag > hg) {
        away.w += 1;
        away.pts += 3;
        home.l += 1;
      } else {
        home.d += 1;
        away.d += 1;
        home.pts += 1;
        away.pts += 1;
      }

      newLogs.unshift({
        code: selectedLeague,
        home: home.name,
        away: away.name,
        hg,
        ag,
        ts: Date.now()
      });
    }

    const updatedTable = {
      ...simState.table,
      [selectedLeague]: teams
    };

    saveState({ table: updatedTable, logs: newLogs });

    if (shuffled[0] && shuffled[1]) {
      setActiveLiveEvent({
        match: `${shuffled[0].name} vs ${shuffled[1].name}`,
        minute: Math.floor(Math.random() * 85) + 5,
        league: selectedLeague
      });
    }
  }, [selectedLeague, simState, saveState]);

  // Automated Live Simulation Loop
  useEffect(() => {
    if (autoSimulate) {
      autoSimTimerRef.current = setInterval(() => {
        simulateRound();
      }, 5000);
    } else {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    }
    return () => {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    };
  }, [autoSimulate, simulateRound]);

  const resetSim = () => {
    localStorage.removeItem(STORAGE_KEY);
    const table = {};
    for (const [code, teams] of Object.entries(LEAGUE_TEAMS)) {
      table[code] = teams.map((name) => ({ name, p: 0, w: 0, d: 0, l: 0, pts: 0 }));
    }
    saveState({ table, logs: [] });
  };

  const currentTeams = simState.table[selectedLeague] || [];
  const sortedRows = [...currentTeams].sort(
    (a, b) => b.pts - a.pts || b.w - a.w || a.name.localeCompare(b.name)
  );

  const filteredLogs = simState.logs
    .filter((item) => item.code === selectedLeague)
    .slice(0, 15);

  // Check if a pick is selected in the bet slip
  const isSelected = (matchId, selection) => {
    return picks.some((p) => p.matchId === matchId && p.selection === selection);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="bg-gray-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
        {/* Header & Standalone Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Top 5 European Leagues (2026/2027) Engine
              </h2>
              <p className="text-[11px] text-slate-400">
                Premier League • La Liga • Serie A (Syria) • Bundesliga (Ambulance) • Ligue 1
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/top5-football.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/30 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Standalone Sim (/top5-football.html)
            </a>
          </div>
        </div>

        {/* Telemetry info bar */}
        <div className="p-3 bg-slate-900/80 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-slate-400">ODDS SETTLEMENT WALLET: </span>
            <code className="text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
              4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m
            </code>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-2.5 py-1 rounded border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
              <input
                type="checkbox"
                checked={autoSimulate}
                onChange={(e) => setAutoSimulate(e.target.checked)}
                className="accent-cyan-500 cursor-pointer"
              />
              <Radio className={`w-3 h-3 ${autoSimulate ? 'text-emerald-400 animate-ping' : 'text-slate-500'}`} />
              AUTO-SIMULATION LIVE ENGINE
            </label>
          </div>
        </div>

        {/* Active Event Banner (Live Generated) */}
        {activeLiveEvent && (
          <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded flex items-center justify-between text-xs animate-pulse">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>
                ACTIVE LIVE SPOT: <strong className="text-white">{activeLiveEvent.match}</strong> ({activeLiveEvent.minute}') // {activeLiveEvent.league} Live Generation
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">AUTO-GENERATING</span>
          </div>
        )}

        {/* League Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(LEAGUE_META).map(([code, meta]) => (
            <button
              key={code}
              onClick={() => setSelectedLeague(code)}
              className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                selectedLeague === code
                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-sm">{meta.flag}</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">{code}</div>
              <div className="text-[10px] text-slate-500 truncate">{meta.count} Clubs</div>
            </button>
          ))}
        </div>

        {/* View Sub-Tabs (Fixtures & Picks / Team Board / Standings) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('fixtures')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'fixtures'
                  ? 'bg-cyan-500 text-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              FIXTURES & ODDS (TOUCH TO SET SLIP)
            </button>
            <button
              onClick={() => setActiveSubTab('board')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'board'
                  ? 'bg-cyan-500 text-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              VISUAL TEAM BOARD
            </button>
            <button
              onClick={() => setActiveSubTab('standings')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'standings'
                  ? 'bg-cyan-500 text-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              LEAGUE STANDINGS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={simulateRound}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase rounded transition cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              SIMULATE ROUND
            </button>
            <button
              onClick={resetSim}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs rounded border border-slate-800 transition cursor-pointer"
              title="Reset simulation data"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* SUB-TAB 1: FIXTURES WITH 1 / X / 2 AUTOMATIC BET SLIP SELECTION */}
        {activeSubTab === 'fixtures' && (
          <div className="space-y-3 pt-2">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>ACTIVE FIXTURES FOR {LEAGUE_META[selectedLeague].name.toUpperCase()} (TOUCH OUTCOME TO ARM ACCUMULATOR)</span>
              <span className="text-cyan-400">{picks.length} ACCA PICK(S) ARMED</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentFixtures.map((fix) => {
                const homePicked = isSelected(fix.id, '1');
                const drawPicked = isSelected(fix.id, 'X');
                const awayPicked = isSelected(fix.id, '2');

                return (
                  <div
                    key={fix.id}
                    className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-cyan-400 font-bold">{selectedLeague}</span>
                      <span className="text-slate-400">2026/2027 Season</span>
                    </div>

                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span className="truncate flex-1">{fix.home}</span>
                      <span className="text-slate-500 px-2 font-normal">vs</span>
                      <span className="truncate flex-1 text-right">{fix.away}</span>
                    </div>

                    {/* 1 / X / 2 Odds Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() =>
                          onTogglePick({
                            id: `${fix.id}_1`,
                            matchId: fix.id,
                            match: `${fix.home} vs ${fix.away}`,
                            league: selectedLeague,
                            selection: '1',
                            selectionName: `${fix.home} (Home Win)`,
                            price: fix.homePrice
                          })
                        }
                        className={`p-1.5 rounded text-center transition cursor-pointer border ${
                          homePicked
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-black'
                            : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">1 (Home)</div>
                        <div className="font-extrabold text-xs">{fix.homePrice}x</div>
                      </button>

                      <button
                        onClick={() =>
                          onTogglePick({
                            id: `${fix.id}_X`,
                            matchId: fix.id,
                            match: `${fix.home} vs ${fix.away}`,
                            league: selectedLeague,
                            selection: 'X',
                            selectionName: 'Draw (X)',
                            price: fix.drawPrice
                          })
                        }
                        className={`p-1.5 rounded text-center transition cursor-pointer border ${
                          drawPicked
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-black'
                            : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">X (Draw)</div>
                        <div className="font-extrabold text-xs text-amber-300">{fix.drawPrice}x</div>
                      </button>

                      <button
                        onClick={() =>
                          onTogglePick({
                            id: `${fix.id}_2`,
                            matchId: fix.id,
                            match: `${fix.home} vs ${fix.away}`,
                            league: selectedLeague,
                            selection: '2',
                            selectionName: `${fix.away} (Away Win)`,
                            price: fix.awayPrice
                          })
                        }
                        className={`p-1.5 rounded text-center transition cursor-pointer border ${
                          awayPicked
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-black'
                            : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">2 (Away)</div>
                        <div className="font-extrabold text-xs">{fix.awayPrice}x</div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-TAB 2: VISUAL TEAM BOARD FOR ALL LEAGUES */}
        {activeSubTab === 'board' && (
          <div className="space-y-3 pt-2">
            <div className="text-[11px] text-slate-400">
              ALL {LEAGUE_TEAMS[selectedLeague].length} TEAMS IN {LEAGUE_META[selectedLeague].name.toUpperCase()} (CLICK ANY CLUB TO ARM WIN IN ACCUMULATOR)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LEAGUE_TEAMS[selectedLeague].map((teamName, idx) => {
                const teamStat = currentTeams.find((t) => t.name === teamName) || { p: 0, w: 0, d: 0, l: 0, pts: 0 };
                const teamPrice = (1.60 + ((idx * 7) % 11) * 0.15).toFixed(2);
                const teamMatchId = `board_${selectedLeague}_${teamName}`;
                const teamPicked = isSelected(teamMatchId, 'WIN');

                return (
                  <div
                    key={teamName}
                    onClick={() =>
                      onTogglePick({
                        id: `${teamMatchId}_WIN`,
                        matchId: teamMatchId,
                        match: `${teamName} Win Match`,
                        league: selectedLeague,
                        selection: 'WIN',
                        selectionName: `${teamName} to Win`,
                        price: teamPrice
                      })
                    }
                    className={`p-3 rounded-lg border transition cursor-pointer select-none ${
                      teamPicked
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-md'
                        : 'bg-slate-900 border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>#{idx + 1}</span>
                      <span className="text-cyan-400 font-bold">{teamStat.pts} PTS</span>
                    </div>
                    <div className="font-bold text-white text-xs truncate">{teamName}</div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400">ODDS:</span>
                      <span className="text-cyan-300 font-extrabold text-xs">{teamPrice}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-TAB 3: STANDINGS TABLE */}
        {activeSubTab === 'standings' && (
          <div className="space-y-4 pt-2">
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider w-12">#</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Club / Team</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">P</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">W</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">D</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">L</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 font-mono">
                  {sortedRows.map((t, idx) => (
                    <tr key={t.name} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 text-slate-500 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-200">{t.name}</td>
                      <td className="py-2 px-3 text-center text-slate-400">{t.p}</td>
                      <td className="py-2 px-3 text-center text-emerald-400 font-bold">{t.w}</td>
                      <td className="py-2 px-3 text-center text-amber-400">{t.d}</td>
                      <td className="py-2 px-3 text-center text-rose-400">{t.l}</td>
                      <td className="py-2 px-3 text-right font-extrabold text-cyan-300 text-sm">{t.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Match Feed */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Live Match Log ({selectedLeague})
              </h3>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-4">
                    No simulated matches yet for this league.
                  </div>
                ) : (
                  filteredLogs.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-cyan-400">[{item.code}]</span>
                      <span className="text-slate-300">
                        {item.home} <strong className="text-emerald-400 font-bold">{item.hg} - {item.ag}</strong> {item.away}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.ts).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default Top5FootballSim;
