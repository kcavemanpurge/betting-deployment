import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Trash2,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Plane,
  X,
  ExternalLink,
  History,
  TrendingUp,
  Zap,
} from 'lucide-react';

const STORAGE_TICKETS_KEY = 'sovereign_bet_tickets_v1';

export function BetSlip({
  picks = [],
  onRemovePick = () => {},
  onClearPicks = () => {},
  balance = 1000,
  onDeductStake = () => {},
  onApplyAccaToFlight,
  onBetPlaced,
  onAddWinnings,
  tickets = [],
  onTicketsChange,
}) {
  const [stake, setStake] = useState(25.0);
  const [activeTab, setActiveTab] = useState('slip'); // 'slip' | 'tickets'
  const [isExpanded, setIsExpanded] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Calculate Accumulator Combined Odds
  const totalOdds =
    picks.length > 0
      ? parseFloat(
          picks.reduce((acc, curr) => acc * parseFloat(curr.price || curr.odds || 1), 1).toFixed(2)
        )
      : 1.0;

  const potentialPayout = parseFloat((stake * totalOdds).toFixed(2));

  // Handle Placing Accumulator / Single Bet
  const handlePlaceBet = () => {
    if (picks.length === 0) {
      setStatusMsg('ERROR: Select at least one match outcome to build your ticket.');
      return;
    }
    if (stake <= 0) {
      setStatusMsg('ERROR: Enter a valid wager stake.');
      return;
    }
    if (stake > balance) {
      setStatusMsg(`ERROR: Insufficient balance ($${balance.toFixed(2)}). Please deposit or reduce stake.`);
      return;
    }

    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTicket = {
      id: ticketId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
      type: picks.length > 1 ? `ACCUMULATOR (${picks.length} LEGS)` : 'SINGLE BET',
      picks: [...picks],
      stake: stake.toFixed(2),
      odds: totalOdds.toFixed(2),
      potentialPayout: potentialPayout.toFixed(2),
      status: 'OPEN', // 'OPEN' | 'WON' | 'SETTLED'
    };

    onDeductStake(stake);

    const updatedTickets = [newTicket, ...(tickets || [])];
    if (onTicketsChange) {
      onTicketsChange(updatedTickets);
    }
    try {
      localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updatedTickets));
    } catch {}

    setStatusMsg(`SUCCESS: Ticket [${ticketId}] placed! Total Odds: ${totalOdds.toFixed(2)}x (Potential Win: $${potentialPayout.toFixed(2)})`);

    if (onBetPlaced) {
      onBetPlaced(newTicket);
    }
    onClearPicks();
    setActiveTab('tickets');
  };

  // Simulate Instant Settlement / Evaluation of an Open Ticket
  const handleSettleTicket = (ticketId, isWon = true) => {
    const updated = (tickets || []).map((t) => {
      if (t.id === ticketId && t.status === 'OPEN') {
        const newStatus = isWon ? 'WON' : 'SETTLED';
        if (isWon && onAddWinnings) {
          onAddWinnings(parseFloat(t.potentialPayout));
        }
        return { ...t, status: newStatus };
      }
      return t;
    });

    if (onTicketsChange) {
      onTicketsChange(updated);
    }
    try {
      localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updated));
    } catch {}

    if (isWon) {
      setStatusMsg(`TICKET [${ticketId}] SETTLED AS WON! Added +$${tickets.find((t) => t.id === ticketId)?.potentialPayout} to Available Balance!`);
    }
  };

  // Apply to Aviator Flight target
  const handleSyncToFlight = () => {
    if (totalOdds > 1.0 && onApplyAccaToFlight) {
      onApplyAccaToFlight(totalOdds);
      setStatusMsg(`BOOST: Flight auto-cashout target set to ${totalOdds.toFixed(2)}x in Aviator Engine!`);
    }
  };

  const openTicketsCount = (tickets || []).filter((t) => t.status === 'OPEN').length;

  return (
    <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl font-sans text-xs">
      {/* Header */}
      <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-white tracking-wider flex items-center gap-1.5">
              SPORTS BETSLIP
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                {picks.length} {picks.length === 1 ? 'LEG' : 'LEGS'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {picks.length > 0 && (
            <span className="text-emerald-400 font-black text-xs font-mono">
              ODDS: {totalOdds.toFixed(2)}x
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div>
          {/* Sub Navigation: Bet Slip vs My Tickets */}
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs font-bold">
            <button
              onClick={() => setActiveTab('slip')}
              className={`flex-1 py-2.5 text-center transition border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'slip'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Current Slip</span>
              {picks.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {picks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex-1 py-2.5 text-center transition border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'tickets'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Placed Tickets</span>
              {openTicketsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                  {openTicketsCount} OPEN
                </span>
              )}
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* VIEW 1: CURRENT BET SLIP */}
            {activeTab === 'slip' && (
              <>
                {picks.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                    <div className="font-semibold text-slate-400">Your accumulator slip is empty.</div>
                    <div className="text-[11px] text-slate-600">
                      Click any match odds (Home 1, Draw X, Away 2, Over/Under) across European Top 10 matches or leagues to accumulate games into this ticket.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div className="flex justify-between items-center pb-1 text-[11px] text-slate-400 font-semibold">
                      <span>ACCUMULATOR SELECTIONS ({picks.length})</span>
                      <button
                        onClick={onClearPicks}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] transition cursor-pointer font-bold"
                      >
                        <Trash2 className="w-3 h-3" /> Clear Slip
                      </button>
                    </div>

                    {picks.map((pick) => (
                      <div
                        key={pick.id || `${pick.matchId}_${pick.selection}`}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2.5 shadow-sm"
                      >
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-cyan-400 font-bold border border-slate-800 uppercase">
                              {pick.league || 'MATCH'}
                            </span>
                            <span className="text-slate-300 text-xs font-semibold truncate">
                              {pick.match || `${pick.home} vs ${pick.away}`}
                            </span>
                          </div>
                          <div className="text-xs text-emerald-400 font-bold mt-1">
                            PICK: <span className="text-white">{pick.selectionName || pick.selection}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-black text-cyan-300 text-sm font-mono">
                            {parseFloat(pick.price || pick.odds || 1).toFixed(2)}x
                          </span>
                          <button
                            onClick={() => onRemovePick(pick.id || `${pick.matchId}_${pick.selection}`)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Staking & Accumulator Summary */}
                {picks.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">TOTAL MULTI-BET ODDS:</span>
                      <span className="text-base font-black text-cyan-300 font-mono">
                        {totalOdds.toFixed(2)}x
                      </span>
                    </div>

                    {/* Stake Input */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-slate-300 font-bold text-[11px]">
                          WAGER STAKE (USD)
                        </label>
                        <div className="flex gap-1 font-mono">
                          {[10, 25, 50, 100].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setStake(amt)}
                              className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer ${
                                stake === amt
                                  ? 'bg-cyan-500 text-slate-950'
                                  : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">$</span>
                        <input
                          type="number"
                          min="1"
                          step="5"
                          value={stake}
                          onChange={(e) => setStake(Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-2.5 text-xs font-bold text-white font-mono focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    {/* Potential Return */}
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                      <span className="text-[11px] text-slate-300 font-bold">
                        ESTIMATED POTENTIAL WIN:
                      </span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        ${potentialPayout.toFixed(2)} USD
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={handlePlaceBet}
                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                      >
                        <Receipt className="w-4 h-4" />
                        PLACE ACCUMULATOR BET (${stake.toFixed(2)} @ {totalOdds.toFixed(2)}x)
                      </button>

                      {onApplyAccaToFlight && (
                        <button
                          onClick={handleSyncToFlight}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] uppercase rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                          title="Bridge accumulator multiplier directly to Aviator flight project"
                        >
                          <Plane className="w-3.5 h-3.5 transform -rotate-45 text-cyan-400" />
                          ⚡ APPLY ACCA ODDS TO AVIATOR FLIGHT ({totalOdds.toFixed(2)}x)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: PLACED TICKETS (PERSISTENT HISTORY) */}
            {activeTab === 'tickets' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>PERSISTENT TICKETS ({(tickets || []).length})</span>
                  {(tickets || []).length > 0 && (
                    <span className="text-slate-500">Saved to Wallet Ledger</span>
                  )}
                </div>

                {(tickets || []).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                    <div className="font-semibold text-slate-400">No placed tickets yet.</div>
                    <div className="text-[11px] text-slate-600">
                      When you place an accumulator or single bet, your tickets remain stored here permanently so you can inspect match outcomes anytime.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {(tickets || []).map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border transition ${
                          t.status === 'WON'
                            ? 'bg-emerald-950/40 border-emerald-500/40'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-cyan-400 font-extrabold text-xs">
                            {t.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              t.status === 'WON'
                                ? 'bg-emerald-500 text-slate-950'
                                : t.status === 'OPEN'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                          <span>{t.type}</span>
                          <span>{t.date} {t.timestamp}</span>
                        </div>

                        {/* Collapsible Legs List */}
                        <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 mb-2">
                          {t.picks.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] text-slate-300"
                            >
                              <span className="truncate flex-1 mr-2">
                                • {p.match || `${p.home} vs ${p.away}`}:{' '}
                                <strong className="text-white">{p.selectionName || p.selection}</strong>
                              </span>
                              <span className="font-mono text-cyan-300 font-bold shrink-0">
                                {parseFloat(p.price || p.odds || 1).toFixed(2)}x
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-400">Stake: </span>
                            <span className="font-bold text-white font-mono">${t.stake}</span>
                            <span className="text-slate-400 ml-2">Odds: </span>
                            <span className="font-bold text-cyan-300 font-mono">{t.odds}x</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 text-[10px] block leading-tight">
                              Potential Win:
                            </span>
                            <span className="font-black text-emerald-400 font-mono text-sm">
                              ${t.potentialPayout}
                            </span>
                          </div>
                        </div>

                        {/* If OPEN, allow user to settle/evaluate as WON */}
                        {t.status === 'OPEN' && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex gap-2">
                            <button
                              onClick={() => handleSettleTicket(t.id, true)}
                              className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Zap className="w-3 h-3" />
                              Evaluate as Won (+${t.potentialPayout})
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status message */}
            {statusMsg && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-semibold border ${
                  statusMsg.startsWith('ERROR')
                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {statusMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BetSlip;
