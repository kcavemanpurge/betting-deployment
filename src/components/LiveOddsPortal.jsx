import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, RefreshCw, ExternalLink, ShieldCheck, Trash2, Layers, History } from 'lucide-react';

const WALLET_ANCHOR = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const STORAGE_KEY = 'sovereign_sports_slip_history_v1';

function loadPersistedRecords() {
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

export function LiveOddsPortal({ userId = '', onAccumulatorOddsChange, onTogglePick, picks = [] }) {
  const initialPersisted = useMemo(() => loadPersistedRecords(), []);

  const [sport, setSport] = useState('soccer_epl');
  const [loading, setLoading] = useState(false);
  const [oddsData, setOddsData] = useState(null);
  const [error, setError] = useState(null);

  const [featuredEventId, setFeaturedEventId] = useState(null);
  const [slip, setSlip] = useState(initialPersisted.slip);
  const [history, setHistory] = useState(initialPersisted.history);
  const [stakeAmount, setStakeAmount] = useState('10.00');
  const [activeDrawerTab, setActiveDrawerTab] = useState('slip'); // 'slip' | 'history'
  const [orderFeedback, setOrderFeedback] = useState('');

  useEffect(() => {
    const payload = JSON.stringify({ slip, history });
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  }, [slip, history]);

  const combinedOdds = useMemo(() => {
    if (!slip.length) return 1.0;
    const prod = slip.reduce((acc, item) => acc * Number(item.price || 1), 1);
    return Number(prod.toFixed(2));
  }, [slip]);

  useEffect(() => {
    if (typeof onAccumulatorOddsChange === 'function') {
      onAccumulatorOddsChange(combinedOdds > 1 ? combinedOdds : null);
    }
  }, [combinedOdds, onAccumulatorOddsChange]);

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOrderFeedback('');

    try {
      const res = await fetch(`/.netlify/functions/live-odds?sport=${encodeURIComponent(sport)}`);
      const data = await res.json();

      if (!res.ok && !Array.isArray(data.events)) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setOddsData(data);
        if (Array.isArray(data.events) && data.events.length > 0) {
          setFeaturedEventId((prev) => prev || data.events[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  const addSelectionToSlip = (ev, outcomeName, rawPrice) => {
    const numericPrice = Number(rawPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 1) return;

    if (onTogglePick) {
      onTogglePick({
        id: `${ev.id}_${outcomeName}`,
        matchId: ev.id,
        match: `${ev.home_team} vs ${ev.away_team}`,
        league: ev.sport_title || sport,
        selection: outcomeName,
        selectionName: outcomeName,
        price: numericPrice,
        odds: numericPrice,
      });
    }

    const legId = `${ev.id}::${outcomeName}`;
    setFeaturedEventId(ev.id);
    setActiveDrawerTab('slip');
    setOrderFeedback('');

    setSlip((prev) => {
      const filtered = prev.filter((item) => item.eventId !== ev.id);
      return [
        ...filtered,
        {
          id: legId,
          eventId: ev.id,
          match: `${ev.home_team} vs ${ev.away_team}`,
          league: ev.sport_title || sport,
          outcome: outcomeName,
          price: numericPrice,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const removeLeg = (legId) => {
    setSlip((prev) => prev.filter((item) => item.id !== legId));
  };

  const handleConfirmBetSlip = async () => {
    const stake = Number(stakeAmount);
    if (!slip.length || !Number.isFinite(stake) || stake <= 0) return;

    const marketType = slip.length > 1 ? 'SPORTS_ACCUMULATOR' : 'SPORTS_SINGLE';
    const record = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      marketType,
      stakeAmount: stake.toFixed(2),
      odds: combinedOdds.toFixed(2),
      potentialReturn: (stake * combinedOdds).toFixed(2),
      status: 'CONFIRMED',
      legs: slip,
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => [record, ...prev]);
    setSlip([]);
    setActiveDrawerTab('history');
    setOrderFeedback(`Confirmed ${slip.length}-leg slip @ ${combinedOdds.toFixed(2)}x for $${stake.toFixed(2)}.`);

    if (userId) {
      try {
        await fetch('/.netlify/functions/wager-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            marketType,
            stakeAmount: stake,
            oddsOrMultiplier: combinedOdds,
            selections: slip,
          }),
        });
      } catch {
        // Local/session persistent history remains intact
      }
    }
  };

  const events = Array.isArray(oddsData?.events) ? oddsData.events : [];
  const spotlightEvent = events.find((e) => e.id === featuredEventId) || events[0] || null;
  const parsedStake = Math.max(0, Number(stakeAmount) || 0);

  return (
    <div className="space-y-6 font-mono">
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
              Live Sports &amp; Odds
            </h2>
          </div>
          <a
            href="/sports.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Sports Page
          </a>
        </div>

        <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-slate-400">SETTLEMENT WALLET: </span>
            <code className="text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {oddsData?.oddsWallet || WALLET_ANCHOR}
            </code>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> /.netlify/functions/live-odds
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-300" htmlFor="league-select">
            LEAGUE:
          </label>
          <select
            id="league-select"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs rounded px-3 py-2 outline-none focus:border-cyan-400 cursor-pointer font-bold"
          >
            <option value="soccer_epl">Premier League (EPL)</option>
            <option value="soccer_spain_la_liga">La Liga</option>
            <option value="soccer_italy_serie_a">Serie A</option>
            <option value="soccer_germany_bundesliga">Bundesliga</option>
            <option value="soccer_france_ligue_one">Ligue 1</option>
            <option value="soccer_uefa_champs_league">UEFA Champions League</option>
          </select>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-black font-bold text-xs uppercase rounded transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH ODDS
          </button>
        </div>

        {/* Display Mode 2: Live / Ongoing Scores Strip */}
        {events.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Live &amp; Active Scores
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {events.slice(0, 8).map((ev) => {
                const isSelected = spotlightEvent?.id === ev.id;
                const homeScore = ev.scores?.find((s) => s.name === ev.home_team)?.score ?? ev.home_score ?? '0';
                const awayScore = ev.scores?.find((s) => s.name === ev.away_team)?.score ?? ev.away_score ?? '0';
                return (
                  <button
                    key={ev.id}
                    onClick={() => setFeaturedEventId(ev.id)}
                    className={`shrink-0 px-3 py-2 rounded border text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/70 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                      {ev.sport_title || sport}
                    </div>
                    <div className="flex items-center justify-between gap-3 font-bold mt-0.5">
                      <span className="truncate max-w-[110px]">{ev.home_team}</span>
                      <span className="text-emerald-400">{homeScore}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 font-bold">
                      <span className="truncate max-w-[110px]">{ev.away_team}</span>
                      <span className="text-emerald-400">{awayScore}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Display Mode 1: Featured Spotlight Match */}
        {spotlightEvent && (
          <div className="bg-slate-900 border border-cyan-500/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                Featured Match — {spotlightEvent.sport_title || sport}
              </div>
              <div className="text-lg font-extrabold text-white mt-1">
                {spotlightEvent.home_team} vs {spotlightEvent.away_team}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {spotlightEvent.commence_time
                  ? new Date(spotlightEvent.commence_time).toLocaleString()
                  : 'Scheduled'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400">SCORE</div>
              <div className="text-2xl font-black text-emerald-400">
                {(spotlightEvent.scores?.find((s) => s.name === spotlightEvent.home_team)?.score ??
                  spotlightEvent.home_score ??
                  0)}{' '}
                -{' '}
                {(spotlightEvent.scores?.find((s) => s.name === spotlightEvent.away_team)?.score ??
                  spotlightEvent.away_score ??
                  0)}
              </div>
            </div>
          </div>
        )}

        {orderFeedback && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded text-emerald-300 text-xs">
            {orderFeedback}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Main Two-Column Layout: Fixtures on Left, Persistent Side Bet Slip & History on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1 items-start">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.length === 0 && !loading && (
              <div className="col-span-full p-8 text-center text-slate-500 text-xs border border-slate-800 rounded bg-slate-900/40">
                No fixtures available right now. Use REFRESH ODDS to query live markets.
              </div>
            )}

            {events.slice(0, 12).map((ev) => {
              let homeOdds = null;
              let drawOdds = null;
              let awayOdds = null;

              if (Array.isArray(ev.bookmakers) && ev.bookmakers.length > 0) {
                const h2h = ev.bookmakers[0].markets?.find((m) => m.key === 'h2h');
                if (h2h && Array.isArray(h2h.outcomes)) {
                  const hOut = h2h.outcomes.find((o) => o.name === ev.home_team);
                  const aOut = h2h.outcomes.find((o) => o.name === ev.away_team);
                  const dOut = h2h.outcomes.find((o) => o.name.toLowerCase().includes('draw'));
                  if (hOut) homeOdds = hOut.price;
                  if (dOut) drawOdds = dOut.price;
                  if (aOut) awayOdds = aOut.price;
                }
              }

              const commenceTime = ev.commence_time
                ? new Date(ev.commence_time).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'SCHEDULED';

              return (
                <div
                  key={ev.id}
                  onClick={() => setFeaturedEventId(ev.id)}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="uppercase tracking-wider font-semibold text-cyan-400">
                      {ev.sport_title || sport}
                    </span>
                    <span>{commenceTime}</span>
                  </div>

                  <div className="text-sm font-bold text-slate-100 leading-tight">
                    <div>{ev.home_team}</div>
                    <div className="text-xs text-slate-500 font-normal">vs</div>
                    <div>{ev.away_team}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={!homeOdds}
                      onClick={(e) => {
                        e.stopPropagation();
                        addSelectionToSlip(ev, ev.home_team, homeOdds);
                      }}
                      className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 disabled:opacity-40 transition text-center cursor-pointer"
                    >
                      <span className="block text-[10px] text-slate-400 truncate">
                        1 ({ev.home_team.slice(0, 6)})
                      </span>
                      <span className="font-extrabold text-cyan-300 text-xs">
                        {homeOdds ?? 'N/A'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!drawOdds}
                      onClick={(e) => {
                        e.stopPropagation();
                        addSelectionToSlip(ev, 'Draw', drawOdds);
                      }}
                      className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 disabled:opacity-40 transition text-center cursor-pointer"
                    >
                      <span className="block text-[10px] text-slate-400">Draw</span>
                      <span className="font-extrabold text-amber-300 text-xs">
                        {drawOdds ?? 'N/A'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!awayOdds}
                      onClick={(e) => {
                        e.stopPropagation();
                        addSelectionToSlip(ev, ev.away_team, awayOdds);
                      }}
                      className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 disabled:opacity-40 transition text-center cursor-pointer"
                    >
                      <span className="block text-[10px] text-slate-400 truncate">
                        2 ({ev.away_team.slice(0, 6)})
                      </span>
                      <span className="font-extrabold text-cyan-300 text-xs">
                        {awayOdds ?? 'N/A'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side Accumulator Slip & Persistent History */}
          <aside className="lg:col-span-4 lg:sticky lg:top-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setActiveDrawerTab('slip')}
                className={`flex-1 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDrawerTab === 'slip'
                    ? 'bg-cyan-600 text-black'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Bet Slip ({slip.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerTab('history')}
                className={`flex-1 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDrawerTab === 'history'
                    ? 'bg-cyan-600 text-black'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" /> History ({history.length})
              </button>
            </div>

            {activeDrawerTab === 'slip' ? (
              <div className="space-y-3">
                {slip.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center bg-slate-950 rounded border border-slate-800/80">
                    Select match odds to build a single or accumulator slip.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {slip.map((leg) => (
                      <div
                        key={leg.id}
                        className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-100">{leg.match}</div>
                          <div className="text-cyan-300 mt-0.5">
                            Pick: {leg.outcome} @ <strong>{leg.price}x</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLeg(leg.id)}
                          aria-label="Remove selection"
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Accumulator Odds:</span>
                    <strong className="text-cyan-300">{slip.length ? `${combinedOdds}x` : '0.00x'}</strong>
                  </div>

                  <div>
                    <label htmlFor="slip-stake" className="block text-slate-400 mb-1">
                      Stake ($)
                    </label>
                    <input
                      id="slip-stake"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-bold"
                    />
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Estimated Return:</span>
                    <strong className="text-emerald-400">
                      ${slip.length ? (parsedStake * combinedOdds).toFixed(2) : '0.00'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={!slip.length || parsedStake <= 0}
                    onClick={handleConfirmBetSlip}
                    className="w-full py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-black disabled:text-slate-500 font-extrabold uppercase tracking-wider cursor-pointer transition"
                  >
                    Place {slip.length > 1 ? 'Accumulator' : 'Bet'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
                {history.length === 0 ? (
                  <div className="text-slate-400 py-6 text-center bg-slate-950 rounded border border-slate-800/80">
                    No recorded bets or transactions yet.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-cyan-300">{item.marketType}</span>
                        <span className="text-emerald-400">{item.status}</span>
                      </div>
                      <div className="text-slate-200">
                        Stake: <strong>${item.stakeAmount}</strong> @ <strong>{item.odds}x</strong> → Return:{' '}
                        <strong className="text-emerald-400">${item.potentialReturn}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Array.isArray(item.legs)
                          ? item.legs.map((l) => `${l.outcome} (${l.price}x)`).join(' • ')
                          : ''}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="pt-3 border-t border-slate-900 text-[11px] text-slate-500 text-center">
          Verified Netlify Serverless Head-to-Head Odds Routing &amp; Multi-Market Telemetry.
        </div>
      </div>
    </div>
  );
}
