import React, { useState } from 'react';
import {
  Receipt,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plane,
  X,
  RefreshCw,
} from 'lucide-react';

export function BetSlip({
  picks = [],
  onRemovePick,
  onClearPicks,
  balance = 0,
  onDeductStake,
  onApplyAccaToFlight,
  onBetPlaced,
  onRefreshLedger,
}) {
  const [stakeInput, setStakeInput] = useState('25.00');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeBets, setActiveBets] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const numericStake = Number(stakeInput);
  const validStake = Number.isFinite(numericStake) && numericStake > 0 ? numericStake : 0;

  const totalOdds =
    picks.length > 0
      ? Number(
          picks
            .reduce((acc, curr) => acc * (Number(curr.price) || 1), 1)
            .toFixed(2)
        )
      : 1.0;

  const potentialPayout = Number((validStake * totalOdds).toFixed(2));

  const handlePlaceBet = async () => {
    if (picks.length === 0) {
      setStatusMsg('ERROR: Select at least one match outcome to arm the bet slip.');
      return;
    }
    if (validStake <= 0) {
      setStatusMsg('ERROR: Enter a valid positive wager stake.');
      return;
    }
    if (validStake > Number(balance)) {
      setStatusMsg('ERROR: Insufficient available balance.');
      return;
    }

    setIsPlacing(true);
    setStatusMsg('');

    const slipId = `ACCA_${Date.now().toString(36).toUpperCase()}_${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const newBet = {
      id: slipId,
      timestamp: new Date().toLocaleTimeString(),
      picks: [...picks],
      stake: validStake.toFixed(2),
      odds: totalOdds.toFixed(2),
      potentialPayout: potentialPayout.toFixed(2),
      status: 'COMMITTED_LOCAL_STAGE',
    };

    try {
      if (typeof onDeductStake === 'function') {
        await onDeductStake(validStake, { slipId, picks, totalOdds, potentialPayout });
      }
      if (typeof onRefreshLedger === 'function') {
        await onRefreshLedger();
      }

      setActiveBets((prev) => [newBet, ...prev.slice(0, 4)]);
      setStatusMsg(
        `ARMED [${slipId}]: ${picks.length} leg(s) @ ${totalOdds.toFixed(2)}x • Est. Payout: $${potentialPayout.toFixed(2)}`
      );

      if (typeof onBetPlaced === 'function') {
        onBetPlaced(newBet);
      }
      if (typeof onClearPicks === 'function') {
        onClearPicks();
      }
    } catch (err) {
      setStatusMsg(`ERROR: ${err?.message || 'Unable to commit wager stake.'}`);
    } finally {
      setIsPlacing(false);
    }
  };

  const handleSyncToFlight = () => {
    if (totalOdds > 1.0 && typeof onApplyAccaToFlight === 'function') {
      onApplyAccaToFlight(totalOdds);
      setStatusMsg(`FLIGHT BOOST: Target multiplier set to ${totalOdds.toFixed(2)}x.`);
    }
  };

  return (
    <div className="bg-slate-950 border border-cyan-500/40 rounded-xl overflow-hidden shadow-2xl font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <div className="font-extrabold text-white tracking-wider flex items-center gap-1.5">
            BET SLIP &amp; ACCUMULATOR
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px]">
              {picks.length} {picks.length === 1 ? 'LEG' : 'LEGS'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {picks.length > 0 && (
            <span className="text-emerald-400 font-extrabold text-xs">
              {totalOdds.toFixed(2)}x
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {picks.length === 0 ? (
            <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
              <div>Your accumulator slip is empty.</div>
              <div className="text-[10px] text-slate-600">
                Select any match outcome or club across the Top 5 leagues to add a leg.
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="flex justify-between items-center pb-1 text-[11px] text-slate-400">
                <span>SELECTIONS ({picks.length})</span>
                <button
                  type="button"
                  onClick={onClearPicks}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[10px] transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              </div>

              {picks.map((pick) => (
                <div
                  key={pick.id || `${pick.match}_${pick.selection}`}
                  className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1 rounded bg-slate-950 text-cyan-400 font-bold border border-slate-800">
                        {pick.league || 'MATCH'}
                      </span>
                      <span className="text-slate-300 text-[11px] font-semibold truncate">
                        {pick.match}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                      PICK: <span className="text-white">{pick.selectionName || pick.selection}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-cyan-300 text-xs">
                      {Number(pick.price || 1).toFixed(2)}x
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemovePick && onRemovePick(pick.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {picks.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">COMBINED ODDS:</span>
                <span className="text-sm font-extrabold text-cyan-300">
                  {totalOdds.toFixed(2)}x
                </span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-400 font-bold">WAGER STAKE (USD)</label>
                  <div className="flex gap-1">
                    {[10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setStakeInput(amt.toFixed(2))}
                        className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer ${
                          validStake === amt
                            ? 'bg-cyan-500 text-black'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="1"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-6 py-2 text-xs font-bold text-white focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <span className="text-[11px] text-slate-300 font-bold">POTENTIAL PAYOUT:</span>
                <span className="text-sm font-black text-emerald-400">
                  ${potentialPayout.toFixed(2)} USD
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isPlacing}
                  onClick={handlePlaceBet}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-extrabold text-xs uppercase rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isPlacing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      COMMITTING WAGER...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      PLACE ACCUMULATOR (${validStake.toFixed(2)} @ {totalOdds.toFixed(2)}x)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSyncToFlight}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] uppercase rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plane className="w-3.5 h-3.5 transform -rotate-45 text-cyan-400" />
                  APPLY ACCA MULTIPLIER TO FLIGHT ({totalOdds.toFixed(2)}x)
                </button>
              </div>
            </div>
          )}

          {statusMsg && (
            <div
              className={`p-2.5 rounded text-[11px] border font-semibold ${
                statusMsg.startsWith('ERROR')
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {statusMsg}
            </div>
          )}

          {activeBets.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                RECENT PLACED ACCUMULATORS
              </span>
              <div className="space-y-1.5">
                {activeBets.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <div className="text-cyan-400 font-bold">{b.id}</div>
                      <div className="text-[10px] text-slate-400">
                        ${b.stake} @ {b.odds}x ({b.picks.length} legs) • {b.timestamp}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold">+${b.potentialPayout}</div>
                      <div className="text-[9px] text-amber-400">{b.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}