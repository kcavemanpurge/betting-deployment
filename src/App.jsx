import React, { useState, useEffect, useCallback } from 'react';
import { BettingCanvas } from './components/BettingCanvas.jsx';
import { AviatorEngine } from './components/AviatorEngine.jsx';
import { Top5FootballSim } from './components/Top5FootballSim.jsx';
import { LiveOddsPortal } from './components/LiveOddsPortal.jsx';
import { SportsbookEngine } from './components/SportsbookEngine.jsx';
import { BetSlip } from './components/BetSlip.jsx';
import { UserProfileModal } from './components/UserProfileModal.jsx';
import { sound } from './utils/audio.js';
import {
  ShieldCheck,
  Database,
  Volume2,
  VolumeX,
  Activity,
  RefreshCw,
  DollarSign,
  Plane,
  Trophy,
  Flame,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Layers,
  Coins,
  History,
  Zap,
} from 'lucide-react';

const SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const BALANCE_STORAGE_KEY = 'sovereign_available_balance';
const TICKETS_STORAGE_KEY = 'sovereign_bet_tickets_v1';
const USER_ID_KEY = 'sovereign_user_id';

export default function App() {
  const [userId, setUserId] = useState(() => {
    try {
      return localStorage.getItem(USER_ID_KEY) || 'ApexPlayer_01';
    } catch {
      return 'ApexPlayer_01';
    }
  });

  const [balance, setBalance] = useState(() => {
    try {
      const saved = localStorage.getItem(BALANCE_STORAGE_KEY);
      return saved !== null ? Math.max(0, parseFloat(saved)) : 1000.0;
    } catch {
      return 1000.0;
    }
  });

  const [tickets, setTickets] = useState(() => {
    try {
      const saved = localStorage.getItem(TICKETS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [engineMode, setEngineMode] = useState('aviator');
  const [wagerAmount, setWagerAmount] = useState(10.0);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [useAutoCashout, setUseAutoCashout] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledgerSource, setLedgerSource] = useState('POSTGRES_LEDGER');
  const [activeTab, setActiveTab] = useState('sportsbook');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('withdraw');
  const [betPicks, setBetPicks] = useState([]);
  const [boostMultiplier, setBoostMultiplier] = useState(null);

  // Sync balance to localStorage
  const updateBalance = useCallback((newBal) => {
    const clamped = Math.max(0, Number(newBal.toFixed(2)));
    setBalance(clamped);
    try {
      localStorage.setItem(BALANCE_STORAGE_KEY, clamped.toString());
    } catch {}
  }, []);

  const handleUserChange = (newId) => {
    const trimmed = (newId || 'ApexPlayer_01').trim();
    setUserId(trimmed);
    try {
      localStorage.setItem(USER_ID_KEY, trimmed);
    } catch {}
  };

  const handleTicketsChange = (updatedTickets) => {
    setTickets(updatedTickets);
    try {
      localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(updatedTickets));
    } catch {}
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const tab = params.get('tab');
      if (mode === 'aviator' || mode === 'trajectory' || mode === 'vector') {
        setEngineMode(mode === 'vector' ? 'trajectory' : mode);
        setActiveTab('aviator');
      } else if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  const toggleMute = () => {
    sound.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const fetchLedger = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`/.netlify/functions/settle${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.settlements)) {
          setSettlements(data.settlements);
          setLedgerSource(data.source || 'POSTGRES_LEDGER');
        }
      }
    } catch {
      // Keep current ledger view
    } finally {
      setIsLoadingLedger(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleSettlementComplete = (newSettlement) => {
    const payout = Number(newSettlement.payout_amount) || 0;
    const wager = Number(newSettlement.wager_amount) || 0;
    const profit = payout - wager;

    updateBalance(balance + profit);
    setSettlements((prev) => [newSettlement, ...prev.slice(0, 19)]);
  };

  // Toggle accumulator picks across matches
  const handleTogglePick = (pick) => {
    setBetPicks((prev) => {
      const exists = prev.some(
        (p) => p.id === pick.id || (p.matchId === pick.matchId && p.selection === pick.selection)
      );
      if (exists) {
        return prev.filter(
          (p) => p.id !== pick.id && !(p.matchId === pick.matchId && p.selection === pick.selection)
        );
      }
      // If pick is from the same match, replace it; if from another match, ACCUMULATE!
      const withoutSameMatch = prev.filter((p) => p.matchId !== pick.matchId);
      return [...withoutSameMatch, pick];
    });
  };

  const handleRemovePick = (pickId) => {
    setBetPicks((prev) => prev.filter((p) => p.id !== pickId));
  };

  const handleClearPicks = () => {
    setBetPicks([]);
  };

  const handleDeductStake = (amount) => {
    updateBalance(balance - amount);
  };

  const handleAddWinnings = (amount) => {
    updateBalance(balance + amount);
  };

  const handleApplyAccaToFlight = (odds) => {
    setBoostMultiplier(odds);
    setActiveTab('aviator');
    setEngineMode('aviator');
  };

  const openTicketsCount = tickets.filter((t) => t.status === 'OPEN').length;
  const totalSettledCount = settlements.length;
  const highestMultiplier = settlements.reduce(
    (max, curr) => Math.max(max, Number(curr.multiplier) || 1),
    1.0
  );

  const openWithdrawModal = () => {
    setProfileModalTab('withdraw');
    setIsProfileOpen(true);
  };

  const openDepositModal = () => {
    setProfileModalTab('deposit');
    setIsProfileOpen(true);
  };

  const openAccountModal = () => {
    setProfileModalTab('profile');
    setIsProfileOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center gap-2">
                APEX SOVEREIGN SPORTSBOOK &amp; CASINO
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <span>Odds Settlement:</span>
                <span className="text-cyan-400 font-bold">{SETTLEMENT_WALLET.slice(0, 12)}...{SETTLEMENT_WALLET.slice(-6)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Audio Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Available Balance Box */}
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center gap-2.5 shadow-inner">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block leading-tight font-bold uppercase tracking-wider">
                  Available Balance
                </span>
                <span className="font-black text-emerald-400 text-sm font-mono">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Quick Crypto Withdraw Button */}
            <button
              onClick={openWithdrawModal}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Withdraw</span>
            </button>

            {/* Quick Deposit Button */}
            <button
              onClick={openDepositModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.98]"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>

            {/* User Account / Profile */}
            <button
              onClick={openAccountModal}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono">{userId}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 text-xs overflow-x-auto pb-1 font-bold">
          <button
            onClick={() => setActiveTab('sportsbook')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'sportsbook'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 text-cyan-400" /> Top 10 Sportsbook &amp; Accumulator
          </button>
          <button
            onClick={() => setActiveTab('aviator')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'aviator'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Plane className="w-4 h-4 text-rose-400" /> Aviator Crash Engine
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'tickets'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-400" /> My Tickets ({tickets.length})
            {openTicketsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                {openTicketsCount} OPEN
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('football')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'football'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" /> Top 5 League Sim (26/27)
          </button>
          <button
            onClick={() => setActiveTab('odds')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'odds'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" /> Live Odds Exchange
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-4 transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4 text-slate-400" /> Database Ledger
          </button>
        </div>

        {/* TAB 1: TOP 10 SPORTSBOOK & ACCUMULATOR */}
        {activeTab === 'sportsbook' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <SportsbookEngine picks={betPicks} onTogglePick={handleTogglePick} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
                onAddWinnings={handleAddWinnings}
                tickets={tickets}
                onTicketsChange={handleTicketsChange}
              />
            </div>
          </div>
        )}

        {/* TAB 2: AVIATOR CRASH ENGINE */}
        {activeTab === 'aviator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEngineMode('aviator')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'aviator'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Plane className="w-4 h-4 transform -rotate-45" />
                    Aviator Crash
                  </button>
                  <button
                    onClick={() => setEngineMode('trajectory')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'trajectory'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Curve Trajectory
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Provably Fair Multiplier Engine</span>
                </div>
              </div>

              {engineMode === 'aviator' ? (
                <div className="flex justify-center">
                  <AviatorEngine
                    userId={userId}
                    externalBalance={balance}
                    onBalanceChange={updateBalance}
                    onSettlementComplete={handleSettlementComplete}
                    onOpenProfile={openWithdrawModal}
                    boostMultiplier={boostMultiplier}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <BettingCanvas
                    userId={userId}
                    wagerAmount={wagerAmount}
                    autoCashoutMultiplier={useAutoCashout ? autoCashout : null}
                    onSettlementComplete={handleSettlementComplete}
                  />

                  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
                    <div className="text-xs font-extrabold text-white uppercase tracking-wider pb-2 border-b border-slate-800">
                      Wager Stake &amp; Auto Cashout
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1.5 font-bold">
                          Wager Stake ($)
                        </label>
                        <div className="flex gap-2 mb-2 font-mono">
                          {[10, 25, 50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setWagerAmount(amt)}
                              className={`flex-1 py-1.5 text-xs rounded-xl border transition cursor-pointer font-bold ${
                                wagerAmount === amt
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={wagerAmount}
                          onChange={(e) => setWagerAmount(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-cyan-400 outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-slate-300 font-bold">
                            Auto Cashout Multiplier (x)
                          </label>
                          <button
                            onClick={() => setUseAutoCashout(!useAutoCashout)}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase cursor-pointer ${
                              useAutoCashout
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {useAutoCashout ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        <div className="flex gap-2 mb-2 font-mono">
                          {['1.50', '2.00', '3.00', '5.00', '10.00'].map((mult) => (
                            <button
                              key={mult}
                              onClick={() => {
                                setAutoCashout(mult);
                                setUseAutoCashout(true);
                              }}
                              className={`flex-1 py-1.5 text-xs rounded-xl border transition cursor-pointer font-bold ${
                                useAutoCashout && autoCashout === mult
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {mult}x
                            </button>
                          ))}
                        </div>

                        <input
                          type="number"
                          step="0.10"
                          min="1.01"
                          value={autoCashout}
                          onChange={(e) => setAutoCashout(e.target.value)}
                          disabled={!useAutoCashout}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold disabled:bg-slate-900 focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
                onAddWinnings={handleAddWinnings}
                tickets={tickets}
                onTicketsChange={handleTicketsChange}
              />

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">ROUND SETTLED</div>
                  <div className="text-xl font-black text-cyan-400 mt-1">{totalSettledCount}</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">TOP MULTIPLIER</div>
                  <div className="text-xl font-black text-emerald-400 mt-1">
                    {highestMultiplier.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MY TICKETS (PERSISTENT TICKETS LIST) */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  My Persistent Sports Tickets ({tickets.length})
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  All placed accumulator and single tickets remain saved to your ledger history. Click evaluate to check winning outcomes!
                </p>
              </div>

              <div className="flex gap-2 font-mono text-xs">
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                  Total Placed: <strong className="text-white">{tickets.length}</strong>
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-300">
                  Open Tickets: <strong className="text-emerald-400">{openTicketsCount}</strong>
                </span>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-dashed border-slate-800 rounded-2xl space-y-2">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-400">No sports tickets placed yet.</div>
                <div className="text-xs text-slate-500 max-w-md mx-auto">
                  Browse the Top 10 Sportsbook, pick your match outcomes, and place an accumulator bet. Your tickets will persist here.
                </div>
                <button
                  onClick={() => setActiveTab('sportsbook')}
                  className="mt-3 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs uppercase cursor-pointer"
                >
                  Explore Top 10 Games
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={`p-5 rounded-2xl border transition shadow-lg space-y-3 ${
                      t.status === 'WON'
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 font-extrabold text-sm">{t.id}</span>
                        <span className="text-[11px] text-slate-400 font-semibold">{t.type}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
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

                    <div className="text-[11px] text-slate-400">
                      Placed: {t.date} {t.timestamp}
                    </div>

                    {/* Legs details */}
                    <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      {t.picks.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
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

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 font-mono">
                      <div>
                        <span className="text-slate-400">Stake: </span>
                        <span className="font-bold text-white">${t.stake}</span>
                        <span className="text-slate-400 ml-3">Odds: </span>
                        <span className="font-bold text-cyan-300">{t.odds}x</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] block leading-tight">
                          Potential Win:
                        </span>
                        <span className="font-black text-emerald-400 text-base">
                          ${t.potentialPayout} USD
                        </span>
                      </div>
                    </div>

                    {t.status === 'OPEN' && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            const updated = tickets.map((item) => {
                              if (item.id === t.id) {
                                handleAddWinnings(parseFloat(item.potentialPayout));
                                return { ...item, status: 'WON' };
                              }
                              return item;
                            });
                            handleTicketsChange(updated);
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Simulate Outcome: Settle as Won (+${t.potentialPayout})
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TOP 5 EUROPEAN LEAGUES (2026/2027) */}
        {activeTab === 'football' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <Top5FootballSim picks={betPicks} onTogglePick={handleTogglePick} />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
                onAddWinnings={handleAddWinnings}
                tickets={tickets}
                onTicketsChange={handleTicketsChange}
              />
            </div>
          </div>
        )}

        {/* TAB 5: LIVE ODDS TELEMETRY */}
        {activeTab === 'odds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <LiveOddsPortal
                userId={userId}
                onAccumulatorOddsChange={setBoostMultiplier}
                onTogglePick={handleTogglePick}
                picks={betPicks}
              />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
                onAddWinnings={handleAddWinnings}
                tickets={tickets}
                onTicketsChange={handleTicketsChange}
              />
            </div>
          </div>
        )}

        {/* TAB 6: POSTGRESQL & DRIZZLE SCHEMA */}
        {activeTab === 'schema' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-extrabold text-white">
                PostgreSQL &amp; Drizzle Ledger Schema (Netlify Database)
              </h2>
            </div>

            <pre className="p-4 bg-slate-950 text-cyan-300 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`CREATE TABLE IF NOT EXISTS bet_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    wager_amount NUMERIC(12, 2) NOT NULL CHECK (wager_amount >= 0),
    multiplier NUMERIC(8, 4) NOT NULL CHECK (multiplier >= 1.0000),
    payout_amount NUMERIC(12, 2) GENERATED ALWAYS AS (wager_amount * multiplier) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'SETTLED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    amount NUMERIC(14, 4) NOT NULL,
    rail VARCHAR(32) NOT NULL,
    user_wallet TEXT NOT NULL,
    settlement_wallet TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_MANUAL_APPROVAL',
    tx_ref TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 4) NOT NULL,
    hot_wallet_address TEXT,
    tx_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`}
            </pre>
          </div>
        )}
      </main>

      {/* Crypto Cashier & User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={userId}
        onUserChange={handleUserChange}
        balance={balance}
        onBalanceChange={updateBalance}
        initialTab={profileModalTab}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-12 bg-slate-900/60 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Autonomous Provably Fair Sportsbook &amp; Netlify Serverless Crypto Settlement
            </span>
          </div>
          <div className="font-mono text-slate-400">
            Global Odds Settlement Wallet: <span className="text-cyan-400">{SETTLEMENT_WALLET}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
