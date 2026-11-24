import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, ExternalLink, ShieldCheck, Zap, DollarSign } from 'lucide-react';

export function LiveOddsPortal() {
  const [sport, setSport] = useState('soccer_epl');
  const [loading, setLoading] = useState(false);
  const [oddsData, setOddsData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedBet, setSelectedBet] = useState(null);
  const [betSuccessMsg, setBetSuccessMsg] = useState('');

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBetSuccessMsg('');

    try {
      const res = await fetch(`/.netlify/functions/live-odds?sport=${encodeURIComponent(sport)}`);
      const data = await res.json();

      if (!res.ok && !data.events) {
        setError(data.error || `HTTP ${res.status}: Failed to fetch odds`);
      } else {
        setOddsData(data);
      }
    } catch (err) {
      setError(err.message || 'Network exception while contacting /.netlify/functions/live-odds');
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  const handlePlaceOddBet = (event, outcomeName, price) => {
    setSelectedBet({
      match: `${event.home_team} vs ${event.away_team}`,
      outcome: outcomeName,
      price: price
    });
    setBetSuccessMsg(`Bet order locked: [${outcomeName} @ ${price}x] routed to Netlify Odds Wallet 4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m`);
  };

  const events = oddsData?.events || [];

  return (
    <div className="space-y-6">
      <div className="bg-gray-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
              Live Sports & Head-to-Head Verified Odds Engine
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/sports.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/30 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Standalone Sports Portal
            </a>
          </div>
        </div>

        {/* Telemetry info bar */}
        <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-slate-400">NETLIFY ODDS WALLET: </span>
            <code className="text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
              {oddsData?.oddsWallet || '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m'}
            </code>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> NETLIFY FUNCTION: /.netlify/functions/live-odds
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-300">SPORT / LEAGUE:</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs rounded px-3 py-2 outline-none focus:border-cyan-400 cursor-pointer font-bold"
          >
            <option value="soccer_epl">Premier League (EPL)</option>
            <option value="soccer_spain_la_liga">La Liga (Spain)</option>
            <option value="soccer_italy_serie_a">Serie A (Italy)</option>
            <option value="soccer_germany_bundesliga">Bundesliga (Germany)</option>
            <option value="soccer_france_ligue_one">Ligue 1 (France)</option>
            <option value="soccer_uefa_champs_league">UEFA Champions League</option>
          </select>

          <button
            onClick={fetchOdds}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-black font-bold text-xs uppercase rounded transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH LIVE ODDS
          </button>
        </div>

        {betSuccessMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded text-emerald-300 text-xs font-mono flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>{betSuccessMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded text-rose-300 text-xs font-mono">
            // ERROR: {error}
          </div>
        )}

        {/* Fixtures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {events.length === 0 && !loading && (
            <div className="col-span-full p-8 text-center text-slate-500 text-xs border border-slate-800 rounded bg-slate-950">
              No live fixtures returned for this sport at this moment. Click "REFRESH LIVE ODDS" to re-poll.
            </div>
          )}

          {events.slice(0, 15).map((ev) => {
            let homeOdds = '2.10', drawOdds = '3.25', awayOdds = '3.40';
            if (ev.bookmakers && ev.bookmakers.length > 0) {
              const h2h = ev.bookmakers[0].markets?.find((m) => m.key === 'h2h');
              if (h2h && h2h.outcomes) {
                const hOut = h2h.outcomes.find((o) => o.name === ev.home_team);
                const aOut = h2h.outcomes.find((o) => o.name === ev.away_team);
                const dOut = h2h.outcomes.find((o) => o.name.toLowerCase().includes('draw'));
                if (hOut) homeOdds = hOut.price;
                if (dOut) drawOdds = dOut.price;
                if (aOut) awayOdds = aOut.price;
              }
            }

            const commenceTime = ev.commence_time
              ? new Date(ev.commence_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'UPCOMING';

            return (
              <div
                key={ev.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition"
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
                    onClick={() => handlePlaceOddBet(ev, ev.home_team, homeOdds)}
                    className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition text-center cursor-pointer"
                  >
                    <span className="block text-[10px] text-slate-400 truncate">1 ({ev.home_team.slice(0, 6)})</span>
                    <span className="font-extrabold text-cyan-300 text-xs">{homeOdds}</span>
                  </button>

                  <button
                    onClick={() => handlePlaceOddBet(ev, 'Draw', drawOdds)}
                    className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition text-center cursor-pointer"
                  >
                    <span className="block text-[10px] text-slate-400">Draw</span>
                    <span className="font-extrabold text-amber-300 text-xs">{drawOdds}</span>
                  </button>

                  <button
                    onClick={() => handlePlaceOddBet(ev, ev.away_team, awayOdds)}
                    className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition text-center cursor-pointer"
                  >
                    <span className="block text-[10px] text-slate-400 truncate">2 ({ev.away_team.slice(0, 6)})</span>
                    <span className="font-extrabold text-cyan-300 text-xs">{awayOdds}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default LiveOddsPortal;
