import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flame, Radio, Trophy, Layers, History, Trash2, ChevronRight, RefreshCw } from 'lucide-react';

const WALLET_ANCHOR = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const STORAGE_KEY = 'sovereign_sports_hub_v1';

const CATEGORIES = [
  { key: 'soccer_epl', group: 'Football', label: 'Premier League' },
  { key: 'soccer_spain_la_liga', group: 'Football', label: 'La Liga' },
  { key: 'soccer_italy_serie_a', group: 'Football', label: 'Serie A' },
  { key: 'soccer_germany_bundesliga', group: 'Football', label: 'Bundesliga' },
  { key: 'soccer_france_ligue_one', group: 'Football', label: 'Ligue 1' },
  { key: 'basketball_nba', group: 'Basketball', label: 'NBA' },
  { key: 'americanfootball_nfl', group: 'American Football', label: 'NFL' },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { slip: [], history: [] };
    const parsed = JSON.parse(raw);
    return {
      slip: Array.isArray(parsed.slip) ? parsed.slip : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { slip: [], history: [] };
  }
}

export function SportsHub({ userId = '' }) {
  const persisted = useMemo(() => loadState(), []);

  const [section, setSection] = useState('hub'); // 'hub' | 'sports' | 'live'
  const [sport, setSport] = useState('soccer_epl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [topPicks, setTopPicks] = useState([]);
  const [events, setEvents] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);

  const [slip, setSlip] = useState(persisted.slip);
  const [history, setHistory] = useState(persisted.history);
  const [stake, setStake] = useState('10.00');
  const [sideTab, setSideTab] = useState('slip');

  useEffect(() => {
    const raw = JSON.stringify({ slip, history });
    localStorage.setItem(STORAGE_KEY, raw);
    sessionStorage.setItem(STORAGE_KEY, raw);
  }, [slip, history]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, liveRes] = await Promise.all([
        fetch(`/.netlify/functions/sports-catalog?sport=${encodeURIComponent(sport)}&top=10`),
        fetch(`/.netlify/functions/live-events?sport=${encodeURIComponent(sport)}`),
      ]);
      const catJson = await catRes.json();
      const liveJson = await liveRes.json();

      if (Array.isArray(catJson.events)) {
        setEvents(catJson.events);
        setTopPicks(Array.isArray(catJson.topPicks) ? catJson.topPicks.slice(0, 10) : catJson.events.slice(0, 10));
        if (!activeMatch && catJson.events.length > 0) {
          setActiveMatch(catJson.events[0]);
        }
      } else if (!catRes.ok) {
        setError(catJson.error || `Catalog error ${catRes.status}`);
      }

      if (Array.isArray(liveJson.liveEvents)) {
        setLiveEvents(liveJson.liveEvents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sports data');
    } finally {
      setLoading(false);
    }
  }, [sport, activeMatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectMarketOption = (match, market, outcome) => {
    const oddsVal = Number(outcome.odds);
    if (!Number.isFinite(oddsVal) || oddsVal <= 1) return;

    const legId = `${match.eventId}::${market.marketKey}::${outcome.code}`;
    setActiveMatch(match);
    setSideTab('slip');

    setSlip((prev) => {
      const withoutSameEvent = prev.filter((item) => item.eventId !== match.eventId);
      return [
        ...withoutSameEvent,
        {
          id: legId,
          eventId: match.eventId,
          match: `${match.homeTeam} vs ${match.awayTeam}`,
          market: market.marketLabel,
          outcome: outcome.label,
          price: oddsVal,
        },
      ];
    });
  };

  const totalOdds = useMemo(() => {
    if (!slip.length) return 0;
    return Number(slip.reduce((acc, l) => acc * l.price, 1).toFixed(2));
  }, [slip]);

  const submitSlip = async () => {
    const amount = Number(stake);
    if (!slip.length || !Number.isFinite(amount) || amount <= 0) return;

    const entry = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      marketType: slip.length > 1 ? 'ACCUMULATOR' : 'SINGLE',
      stake: amount.toFixed(2),
      odds: totalOdds.toFixed(2),
      potentialReturn: (amount * totalOdds).toFixed(2),
      status: 'CONFIRMED',
      legs: slip,
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => [entry, ...prev]);
    setSlip([]);
    setSideTab('history');

    if (userId) {
      try {
        await fetch('/.netlify/functions/wager-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            marketType: slip.length > 1 ? 'SPORTS_ACCUMULATOR' : 'SPORTS_SINGLE',
            stakeAmount: amount,
            oddsOrMultiplier: totalOdds,
            selections: slip,
          }),
        });
      } catch {
        // Local/session history preserved
      }
    }
  };

  const displayedList = section === 'live' ? liveEvents : section === 'hub' ? topPicks : events;

  return (
    <div className="space-y-6 font-mono text-slate-100">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection('hub')}
              className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                section === 'hub' ? 'bg-cyan-600 text-black' : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Main Hub (Top 10 Picks)
            </button>
            <button
              type="button"
              onClick={() => setSection('sports')}
              className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                section === 'sports' ? 'bg-cyan-600 text-black' : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Sports &amp; Categories
            </button>
            <button
              type="button"
              onClick={() => setSection('live')}
              className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                section === 'live' ? 'bg-emerald-500 text-black' : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" /> Live Events ({liveEvents.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-cyan-300 font-bold"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.group} — {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex flex-wrap justify-between gap-2">
          <span>
            WALLET: <code className="text-cyan-300">{WALLET_ANCHOR}</code>
          </span>
          <span>
            {section === 'hub'
              ? 'Top 10 Daily Picks'
              : section === 'live'
                ? 'Active Live Events'
                : 'Sports Events & Categories'}
          </span>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Event Cards + Selected Match Market Inspector */}
          <div className="lg:col-span-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedList.map((ev, index) => {
                const isSelected = activeMatch?.eventId === ev.eventId;
                const primaryMarket = ev.markets?.[0];
                return (
                  <div
                    key={ev.eventId}
                    onClick={() => setActiveMatch(ev)}
                    className={`p-4 rounded-lg border transition cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-400'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="text-cyan-400 font-bold">
                        {section === 'hub' ? `#${index + 1} TOP PICK • ${ev.sportTitle}` : ev.sportTitle}
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-300">
                        Markets <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="font-bold text-sm text-white">
                      {ev.homeTeam} vs {ev.awayTeam}
                    </div>

                    {primaryMarket && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {primaryMarket.outcomes.map((out) => (
                          <button
                            key={out.code}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectMarketOption(ev, primaryMarket, out);
                            }}
                            className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-center cursor-pointer"
                          >
                            <span className="block text-[10px] text-slate-400 truncate">{out.code}</span>
                            <span className="text-xs font-extrabold text-cyan-300">{out.odds}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {displayedList.length === 0 && !loading && (
                <div className="col-span-full p-6 text-center text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg">
                  No events available in this view right now.
                </div>
              )}
            </div>

            {/* Selected Game Full Market Options (1X2, Double Chance, Over/Under 2.5, BTTS) */}
            {activeMatch && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-[11px] uppercase text-cyan-400 font-bold">
                      Match Markets — {activeMatch.sportTitle}
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {activeMatch.homeTeam} vs {activeMatch.awayTeam}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {activeMatch.commenceTime ? new Date(activeMatch.commenceTime).toLocaleString() : ''}
                  </div>
                </div>

                <div className="space-y-4">
                  {(activeMatch.markets || []).map((mkt) => (
                    <div key={mkt.marketKey} className="space-y-2">
                      <div className="text-xs font-bold text-slate-200">{mkt.marketLabel}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {mkt.outcomes.map((out) => (
                          <button
                            key={out.code}
                            type="button"
                            onClick={() => selectMarketOption(activeMatch, mkt, out)}
                            className="p-2.5 rounded bg-slate-950 border border-slate-800 hover:border-emerald-400/70 flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span className="text-slate-200 truncate pr-2">{out.label}</span>
                            <span className="font-extrabold text-emerald-400">{out.odds}x</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 4 Columns: Pinned Side Slip & Persistent History */}
          <aside className="lg:col-span-4 lg:sticky lg:top-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setSideTab('slip')}
                className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  sideTab === 'slip' ? 'bg-cyan-600 text-black' : 'bg-slate-950 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Slip ({slip.length})
              </button>
              <button
                type="button"
                onClick={() => setSideTab('history')}
                className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  sideTab === 'history' ? 'bg-cyan-600 text-black' : 'bg-slate-950 text-slate-300'
                }`}
              >
                <History className="w-3.5 h-3.5" /> History ({history.length})
              </button>
            </div>

            {sideTab === 'slip' ? (
              <div className="space-y-3 text-xs">
                {slip.length === 0 ? (
                  <div className="text-slate-400 py-6 text-center bg-slate-950 rounded border border-slate-800">
                    Click any odds option to add to your slip.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {slip.map((leg) => (
                      <div
                        key={leg.id}
                        className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-white">{leg.match}</div>
                          <div className="text-[11px] text-slate-400">{leg.market}</div>
                          <div className="text-cyan-300 mt-0.5">
                            {leg.outcome} @ <strong>{leg.price}x</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSlip((prev) => prev.filter((x) => x.id !== leg.id))}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Odds:</span>
                    <strong className="text-cyan-300">{slip.length ? `${totalOdds}x` : '0.00x'}</strong>
                  </div>

                  <div>
                    <label htmlFor="hub-stake" className="block text-slate-400 mb-1">
                      Stake ($)
                    </label>
                    <input
                      id="hub-stake"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-bold"
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Return:</span>
                    <strong className="text-emerald-400">
                      ${slip.length ? ((Number(stake) || 0) * totalOdds).toFixed(2) : '0.00'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={!slip.length || (Number(stake) || 0) <= 0}
                    onClick={submitSlip}
                    className="w-full py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-black disabled:text-slate-500 font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Place {slip.length > 1 ? 'Accumulator' : 'Bet'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
                {history.length === 0 ? (
                  <div className="text-slate-400 py-6 text-center bg-slate-950 rounded border border-slate-800">
                    No bets or transactions saved yet.
                  </div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span className="text-cyan-300">{h.marketType}</span>
                        <span className="text-emerald-400">{h.status}</span>
                      </div>
                      <div className="text-slate-200">
                        ${h.stake} @ {h.odds}x → <strong className="text-emerald-400">${h.potentialReturn}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Array.isArray(h.legs) ? h.legs.map((l) => `${l.outcome} (${l.price}x)`).join(' • ') : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="pt-3 border-t border-slate-900 text-[11px] text-slate-500 text-center">
          Verified Netlify Serverless Multi-Sport Catalog &amp; Live Telemetry Feeds.
        </div>
      </div>
    </div>
  );
}
