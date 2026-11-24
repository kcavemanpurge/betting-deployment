import React, { useState } from 'react';
import { 
  Receipt, 
  Trash2, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Plane,
  X,
  Plus
} from 'lucide-react';

export function BetSlip({
  picks = [],
  onRemovePick,
  onClearPicks,
  balance,
  onDeductStake,
  onApplyAccaToFlight,
  onBetPlaced
}) {
  const [stake, setStake] = useState(25.00);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeBets, setActiveBets] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');

  // Calculate Accumulator Multiplier
  const totalOdds = picks.length > 0 
    ? parseFloat(picks.reduce((acc, curr) => acc * parseFloat(curr.price || 1), 1).toFixed(2))
    : 1.00;

  const potentialPayout = parseFloat((stake * totalOdds).toFixed(2));

  // Place Bet
  const handlePlaceBet = () => {
    if (picks.length === 0) {
      setStatusMsg('ERROR: Select at least one match outcome to arm the bet slip.');
      return;
    }
    if (stake <= 0) {
      setStatusMsg('ERROR: Enter a valid wager stake.');
      return;
    }
    if (stake > balance) {
      setStatusMsg('ERROR: Insufficient ledger balance. Please deposit or renew funds in profile.');
      return;
    }

    const slipId = `ACCA_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const newBet = {
      id: slipId,
      timestamp: new Date().toLocaleTimeString(),
      picks: [...picks],
      stake: stake.toFixed(2),
      odds: totalOdds.toFixed(2),
      potentialPayout: potentialPayout.toFixed(2),
      status: 'PENDING (AUTO-EVALUATING)'
    };

    onDeductStake(stake);
    setActiveBets((prev) => [newBet, ...prev.slice(0, 4)]);
    setStatusMsg(`SUCCESS: Accumulator [${slipId}] placed! Total Odds: ${totalOdds.toFixed(2)}x (Potential: $${potentialPayout.toFixed(2)})`);

    if (onBetPlaced) {
      onBetPlaced(newBet);
    }
    onClearPicks();
  };

  // Sync Accumulator to Aviator Flight Project
  const handleSyncToFlight = () => {
    if (totalOdds > 1.0 && onApplyAccaToFlight) {
      onApplyAccaToFlight(totalOdds);
      setStatusMsg(`ACCUMULATOR BOOST: Target flight multiplier set to ${totalOdds.toFixed(2)}x in Aviator Engine!`);
    }
  };

  return (
    <div className="bg-slate-950 border border-cyan-500/40 rounded-xl overflow-hidden shadow-2xl font-mono text-xs">
      {/* Bet Slip Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-extrabold text-white tracking-wider flex items-center gap-1.5">
              FOOTBALL BET SLIP & ACCUMULATOR
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px]">
                {picks.length} {picks.length === 1 ? 'LEG' : 'LEGS'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {picks.length > 0 && (
            <span className="text-emerald-400 font-extrabold text-xs">
              TOTAL: {totalOdds.toFixed(2)}x
            </span>
          )}
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Picks List */}
          {picks.length === 0 ? (
            <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
              <div>Your accumulator slip is empty.</div>
              <div className="text-[10px] text-slate-600">
                Touch or click any team or 1 / X / 2 match outcome in EPL, La Liga, Serie A, Bundesliga, or Ligue 1 to add.
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="flex justify-between items-center pb-1 text-[11px] text-slate-400">
                <span>SELECTIONS ({picks.length})</span>
                <button
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
                      {parseFloat(pick.price || 1).toFixed(2)}x
                    </span>
                    <button
                      onClick={() => onRemovePick(pick.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Staking & Accumulator Summary */}
          {picks.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">COMBINED ACCUMULATOR ODDS:</span>
                <span className="text-sm font-extrabold text-cyan-300">
                  {totalOdds.toFixed(2)}x
                </span>
              </div>

              {/* Stake input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-400 font-bold">WAGER STAKE (USD)</label>
                  <div className="flex gap-1">
                    {[10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setStake(amt)}
                        className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer ${
                          stake === amt ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-400 hover:text-white'
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
                    min="1"
                    step="5"
                    value={stake}
                    onChange={(e) => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-6 py-2 text-xs font-bold text-white focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              {/* Payout calculation */}
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <span className="text-[11px] text-slate-300 font-bold">ESTIMATED POTENTIAL PAYOUT:</span>
                <span className="text-sm font-black text-emerald-400">
                  ${potentialPayout.toFixed(2)} USD
                </span>
              </div>

              {/* Actions: Place Bet & Sync to Aviator */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handlePlaceBet}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase rounded transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                >
                  <Receipt className="w-4 h-4" />
                  PLACE ACCUMULATOR BET (${stake.toFixed(2)} @ {totalOdds.toFixed(2)}x)
                </button>

                <button
                  onClick={handleSyncToFlight}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] uppercase rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                  title="Bridge accumulator multiplier directly to Aviator flight project"
                >
                  <Plane className="w-3.5 h-3.5 transform -rotate-45 text-cyan-400" />
                  ⚡ APPLY ACCA MULTIPLIER TO FLIGHT PROJECT ({totalOdds.toFixed(2)}x)
                </button>
              </div>
            </div>
          )}

          {statusMsg && (
            <div className={`p-2.5 rounded text-[11px] border font-semibold ${
              statusMsg.startsWith('ERROR') 
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-300' 
                : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
            }`}>
              // {statusMsg}
            </div>
          )}

          {/* Active Placed Bets */}
          {activeBets.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                RECENT PLACED ACCUMULATORS
              </span>
              <div className="space-y-1.5">
                {activeBets.map((b) => (
                  <div key={b.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                    <div>
                      <div className="text-cyan-400 font-bold">{b.id}</div>
                      <div className="text-[10px] text-slate-400">
                        ${b.stake} @ {b.odds}x ({b.picks.length} legs)
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
export default BetSlip;
