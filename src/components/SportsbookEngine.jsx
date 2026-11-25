import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Flame,
  Search,
  Check,
  Plus,
  Clock,
  Radio,
  ChevronRight,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';

const TOP_10_GAMES = [
  {
    id: 'top_1',
    league: 'La Liga',
    country: 'Spain',
    flag: '🇪🇸',
    home: 'Real Madrid',
    away: 'Barcelona',
    time: 'LIVE 74\'',
    isLive: true,
    score: '2 - 1',
    stadium: 'Santiago Bernabéu',
    odds: { home: 1.95, draw: 3.40, away: 3.60, over25: 1.65, under25: 2.20 },
    stats: { attacks: '68 - 61', possession: '52% - 48%' },
  },
  {
    id: 'top_2',
    league: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    home: 'Arsenal',
    away: 'Manchester City',
    time: 'LIVE 58\'',
    isLive: true,
    score: '1 - 1',
    stadium: 'Emirates Stadium',
    odds: { home: 2.40, draw: 3.30, away: 2.85, over25: 1.75, under25: 2.05 },
    stats: { attacks: '54 - 59', possession: '47% - 53%' },
  },
  {
    id: 'top_3',
    league: 'Bundesliga',
    country: 'Germany',
    flag: '🇩🇪',
    home: 'Bayern München',
    away: 'Borussia Dortmund',
    time: 'LIVE 38\'',
    isLive: true,
    score: '3 - 1',
    stadium: 'Allianz Arena',
    odds: { home: 1.60, draw: 4.20, away: 4.80, over25: 1.45, under25: 2.70 },
    stats: { attacks: '42 - 28', possession: '64% - 36%' },
  },
  {
    id: 'top_4',
    league: 'Ligue 1',
    country: 'France',
    flag: '🇫🇷',
    home: 'Paris Saint-Germain',
    away: 'Olympique de Marseille',
    time: 'Today 20:00',
    isLive: false,
    score: 'vs',
    stadium: 'Parc des Princes',
    odds: { home: 1.55, draw: 4.10, away: 5.20, over25: 1.50, under25: 2.55 },
    stats: { attacks: 'Pre-Match', possession: 'H2H: 4W-1D' },
  },
  {
    id: 'top_5',
    league: 'Serie A',
    country: 'Italy',
    flag: '🇮🇹',
    home: 'Inter Milan',
    away: 'AC Milan',
    time: 'Today 19:45',
    isLive: false,
    score: 'vs',
    stadium: 'San Siro',
    odds: { home: 2.10, draw: 3.25, away: 3.50, over25: 1.85, under25: 1.95 },
    stats: { attacks: 'Pre-Match', possession: 'Derby della Madonnina' },
  },
  {
    id: 'top_6',
    league: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    home: 'Liverpool',
    away: 'Chelsea',
    time: 'Tomorrow 17:30',
    isLive: false,
    score: 'vs',
    stadium: 'Anfield',
    odds: { home: 1.80, draw: 3.60, away: 4.20, over25: 1.60, under25: 2.30 },
    stats: { attacks: 'Pre-Match', possession: 'Round 14' },
  },
  {
    id: 'top_7',
    league: 'Serie A',
    country: 'Italy',
    flag: '🇮🇹',
    home: 'Juventus FC',
    away: 'SSC Napoli',
    time: 'Tomorrow 19:45',
    isLive: false,
    score: 'vs',
    stadium: 'Allianz Stadium Turin',
    odds: { home: 2.30, draw: 3.10, away: 3.15, over25: 1.95, under25: 1.85 },
    stats: { attacks: 'Pre-Match', possession: 'Top 4 Battle' },
  },
  {
    id: 'top_8',
    league: 'La Liga',
    country: 'Spain',
    flag: '🇪🇸',
    home: 'Atlético Madrid',
    away: 'Sevilla FC',
    time: 'Tomorrow 20:00',
    isLive: false,
    score: 'vs',
    stadium: 'Metropolitano',
    odds: { home: 1.70, draw: 3.50, away: 4.90, over25: 1.80, under25: 2.00 },
    stats: { attacks: 'Pre-Match', possession: 'Matchday 12' },
  },
  {
    id: 'top_9',
    league: 'Bundesliga',
    country: 'Germany',
    flag: '🇩🇪',
    home: 'Bayer Leverkusen',
    away: 'RB Leipzig',
    time: 'Saturday 15:30',
    isLive: false,
    score: 'vs',
    stadium: 'BayArena',
    odds: { home: 2.05, draw: 3.40, away: 3.35, over25: 1.62, under25: 2.25 },
    stats: { attacks: 'Pre-Match', possession: 'Top Table Clash' },
  },
  {
    id: 'top_10',
    league: 'Ligue 1',
    country: 'France',
    flag: '🇫🇷',
    home: 'AS Monaco',
    away: 'Olympique Lyonnais',
    time: 'Saturday 21:00',
    isLive: false,
    score: 'vs',
    stadium: 'Stade Louis II',
    odds: { home: 2.15, draw: 3.45, away: 3.10, over25: 1.68, under25: 2.15 },
    stats: { attacks: 'Pre-Match', possession: 'European Spot Chase' },
  },
];

const LEAGUES = [
  { id: 'ALL', name: '🔥 Top 10 Featured Games', count: 10 },
  { id: 'Premier League', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', count: 20 },
  { id: 'La Liga', name: '🇪🇸 La Liga', count: 20 },
  { id: 'Serie A', name: '🇮🇹 Serie A', count: 20 },
  { id: 'Bundesliga', name: '🇩🇪 Bundesliga', count: 18 },
  { id: 'Ligue 1', name: '🇫🇷 Ligue 1', count: 18 },
];

export function SportsbookEngine({ picks = [], onTogglePick = () => {} }) {
  const [selectedLeague, setSelectedLeague] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMatches = useMemo(() => {
    return TOP_10_GAMES.filter((m) => {
      const matchLeague = selectedLeague === 'ALL' || m.league === selectedLeague;
      const matchSearch =
        !searchQuery ||
        m.home.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.away.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.league.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLeague && matchSearch;
    });
  }, [selectedLeague, searchQuery]);

  const isPickSelected = (matchId, selection) => {
    return picks.some((p) => p.matchId === matchId && p.selection === selection);
  };

  const handleOddsClick = (match, selection, selectionName, price) => {
    onTogglePick({
      id: `${match.id}_${selection}`,
      matchId: match.id,
      match: `${match.home} vs ${match.away}`,
      league: match.league,
      selection,
      selectionName,
      price,
      odds: price,
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Hero / Header banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400">
              Live Verified Odds Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Top European Sportsbook &amp; Accumulator Exchange
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Accumulate games seamlessly across Top 10 European fixtures and leagues. Select multiple match outcomes to multiply your accumulator odds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-[120px]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Active Selections
            </span>
            <span className="text-xl font-black text-cyan-400 font-mono">
              {picks.length} {picks.length === 1 ? 'Leg' : 'Legs'}
            </span>
          </div>
        </div>
      </div>

      {/* League Filter Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {LEAGUES.map((lg) => (
          <button
            key={lg.id}
            onClick={() => setSelectedLeague(lg.id)}
            className={`px-4 py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-2 font-bold ${
              selectedLeague === lg.id
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <span>{lg.name}</span>
          </button>
        ))}
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team or match (e.g. Arsenal, Real Madrid, Bayern)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <strong className="text-white">{filteredMatches.length}</strong> Matches
        </div>
      </div>

      {/* Matches Grid / List */}
      <div className="space-y-3">
        {filteredMatches.map((m) => (
          <div
            key={m.id}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-lg space-y-3"
          >
            {/* Match Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-sm">{m.flag}</span>
                <span className="font-extrabold text-cyan-400 uppercase tracking-wider text-[11px]">
                  {m.league}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{m.stadium}</span>
              </div>

              <div className="flex items-center gap-2">
                {m.isLive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-950/80 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    {m.time}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {m.time}
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400">{m.stats.possession}</span>
              </div>
            </div>

            {/* Teams & Score Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-4 flex-1">
                {/* Home team */}
                <div className="flex-1 text-right sm:text-left">
                  <div className="text-base font-black text-white tracking-tight">{m.home}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Home</div>
                </div>

                {/* Live Score */}
                <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono font-black text-sm text-cyan-300">
                  {m.score}
                </div>

                {/* Away team */}
                <div className="flex-1">
                  <div className="text-base font-black text-white tracking-tight">{m.away}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Away</div>
                </div>
              </div>
            </div>

            {/* Odds Market Buttons Row: 1, X, 2, Over 2.5, Under 2.5 */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              {/* Home Win (1) */}
              <button
                type="button"
                onClick={() => handleOddsClick(m, '1', `${m.home} (Home Win)`, m.odds.home)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isPickSelected(m.id, '1')
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80 uppercase">1 (Home)</div>
                <div className="text-sm font-black font-mono mt-0.5">{m.odds.home.toFixed(2)}x</div>
              </button>

              {/* Draw (X) */}
              <button
                type="button"
                onClick={() => handleOddsClick(m, 'X', `Draw (${m.home} vs ${m.away})`, m.odds.draw)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isPickSelected(m.id, 'X')
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80 uppercase">X (Draw)</div>
                <div className="text-sm font-black font-mono mt-0.5">{m.odds.draw.toFixed(2)}x</div>
              </button>

              {/* Away Win (2) */}
              <button
                type="button"
                onClick={() => handleOddsClick(m, '2', `${m.away} (Away Win)`, m.odds.away)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isPickSelected(m.id, '2')
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80 uppercase">2 (Away)</div>
                <div className="text-sm font-black font-mono mt-0.5">{m.odds.away.toFixed(2)}x</div>
              </button>

              {/* Over 2.5 Goals */}
              <button
                type="button"
                onClick={() => handleOddsClick(m, 'O2.5', `Over 2.5 Goals (${m.home} vs ${m.away})`, m.odds.over25)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isPickSelected(m.id, 'O2.5')
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80 uppercase">Over 2.5</div>
                <div className="text-sm font-black font-mono mt-0.5">{m.odds.over25.toFixed(2)}x</div>
              </button>

              {/* Under 2.5 Goals */}
              <button
                type="button"
                onClick={() => handleOddsClick(m, 'U2.5', `Under 2.5 Goals (${m.home} vs ${m.away})`, m.odds.under25)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  isPickSelected(m.id, 'U2.5')
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold opacity-80 uppercase">Under 2.5</div>
                <div className="text-sm font-black font-mono mt-0.5">{m.odds.under25.toFixed(2)}x</div>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SportsbookEngine;
