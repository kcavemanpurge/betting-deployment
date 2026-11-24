import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Play, ShieldCheck, ExternalLink } from 'lucide-react';

const LEAGUES = {
  EPL: ['Arsenal','Aston Villa','AFC Bournemouth','Brentford','Brighton & Hove Albion','Chelsea','Coventry City','Crystal Palace','Everton','Fulham','Hull City','Ipswich Town','Leeds United','Liverpool','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Sunderland','Tottenham Hotspur'],
  LALIGA: ['Alaves','Ath Bilbao','Atl. Madrid','Barcelona','Betis','Celta Vigo','Dep. A Coruna','Elche','Espanyol','Getafe','Levante','Malaga','Osasuna','Racing Santander','Rayo Vallecano','Real Madrid','Real Sociedad','Sevilla','Valencia','Villarreal'],
  SERIEA: ['AC Milan','AC Monza','ACF Fiorentina','AS Roma','Atalanta BC','Bologna FC 1909','Cagliari Calcio','Como 1907','Frosinone Calcio','Genoa CFC','Inter Milan','Juventus FC','Parma Calcio 1913','S.S. Lazio','SSC Napoli','Torino FC','U.S. Lecce','U.S. Sassuolo Calcio','Udinese Calcio','Venezia FC'],
  BUNDESLIGA: ['1. FC Köln','1. FC Union Berlin','1. FSV Mainz 05','Bayer 04 Leverkusen','Borussia Dortmund','Borussia Mönchengladbach','Eintracht Frankfurt','FC Augsburg','FC Bayern München','FC Schalke 04','Hamburger SV','RB Leipzig','SC Freiburg','SC Paderborn 07','SV Elversberg','SV Werder Bremen','TSG Hoffenheim','VfB Stuttgart'],
  LIGUE1: ['AJ Auxerre','Angers SCO','AS Monaco','ES Troyes AC','FC Lorient','Le Havre AC','Le Mans FC','LOSC Lille','OGC Nice','Olympique de Marseille','Olympique Lyonnais','Paris FC','Paris Saint-Germain','RC Lens','RC Strasbourg','Stade Brestois 29','Stade Rennais','Toulouse FC']
};

const STORAGE_KEY = 'top5_2627_sim_state_v1';

export function Top5FootballSim() {
  const [selectedLeague, setSelectedLeague] = useState('EPL');
  const [simState, setSimState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const table = {};
    for (const [code, teams] of Object.entries(LEAGUES)) {
      table[code] = teams.map((name) => ({ name, p: 0, w: 0, d: 0, l: 0, pts: 0 }));
    }
    return { table, logs: [] };
  });

  const saveState = (newState) => {
    setSimState(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {}
  };

  const simulateRound = () => {
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
  };

  const resetSim = () => {
    localStorage.removeItem(STORAGE_KEY);
    const table = {};
    for (const [code, teams] of Object.entries(LEAGUES)) {
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
    .slice(0, 25);

  return (
    <div className="space-y-6">
      <div className="bg-gray-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
              Top 5 European Football Leagues (2026/2027) — Simulation Engine
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/top5-football.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/30 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Standalone HTML Sim
            </a>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-slate-400">ODDS SETTLEMENT WALLET: </span>
            <code className="text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
              4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m
            </code>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> DDL & SEED: top5_2026_27_football.sql READY
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-300">LEAGUE:</label>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs rounded px-3 py-2 outline-none focus:border-cyan-400 cursor-pointer font-bold"
          >
            <option value="EPL">Premier League (England - 20 Clubs)</option>
            <option value="LALIGA">La Liga (Spain - 20 Clubs)</option>
            <option value="SERIEA">Serie A (Italy - 20 Clubs)</option>
            <option value="BUNDESLIGA">Bundesliga (Germany - 18 Clubs)</option>
            <option value="LIGUE1">Ligue 1 (France - 18 Clubs)</option>
          </select>

          <button
            onClick={simulateRound}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase rounded transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            SIMULATE LEAGUE ROUND
          </button>

          <button
            onClick={resetSim}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            RESET SIMULATION
          </button>
        </div>

        {/* Standings Table */}
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
            Live Browser Match Log ({selectedLeague})
          </h3>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-4">
                No simulated matches yet for this league. Click "SIMULATE LEAGUE ROUND".
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
    </div>
  );
}
export default Top5FootballSim;
