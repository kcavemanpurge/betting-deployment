import React, { useState, useEffect, useCallback } from 'react';
import { BettingCanvas } from './components/BettingCanvas.jsx';
import { AviatorEngine } from './components/AviatorEngine.jsx';
import { ServerlessTerminal } from './components/ServerlessTerminal.jsx';
import { Top5FootballSim } from './components/Top5FootballSim.jsx';
import { LiveOddsPortal } from './components/LiveOddsPortal.jsx';
import { BetSlip } from './components/BetSlip.jsx';
import { UserProfileModal } from './components/UserProfileModal.jsx';
import { sound } from './utils/audio.js';
import { 
  Zap, 
  ShieldCheck, 
  Database, 
  Terminal, 
  Volume2, 
  VolumeX, 
  Activity, 
  CheckCircle2, 
  RefreshCw, 
  Layers,
  DollarSign,
  Plane,
  Server,
  Trophy,
  ExternalLink,
  Flame,
  User,
  PlusCircle,
  Receipt,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [userId, setUserId] = useState('user_caveman_01');
  const [balance, setBalance] = useState(1000.00);
  const [engineMode, setEngineMode] = useState('aviator'); // 'aviator' | 'vector'
  const [wagerAmount, setWagerAmount] = useState(50.00);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [useAutoCashout, setUseAutoCashout] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledgerSource, setLedgerSource] = useState('CONNECTING...');
  const [activeTab, setActiveTab] = useState('cockpit'); // 'cockpit' | 'football' | 'odds' | 'terminal' | 'architecture' | 'schema'

  // User Profile & Provider Auth Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Football Acca Bet Slip State
  const [betPicks, setBetPicks] = useState([]);
  const [boostMultiplier, setBoostMultiplier] = useState(null);

  // Read URL query params on load (e.g. ?mode=aviator)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const tab = params.get('tab');
      if (mode === 'aviator' || mode === 'vector') {
        setEngineMode(mode);
        setActiveTab('cockpit');
      } else if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  // Toggle sound
  const toggleMute = () => {
    sound.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Fetch immutable ledger from Netlify function
  const fetchLedger = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const res = await fetch(`/.netlify/functions/settle?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settlements) {
          setSettlements(data.settlements);
          setLedgerSource(data.source || 'POSTGRES_IMMUTABLE_LEDGER');
        }
      }
    } catch (e) {
      console.warn('Ledger fetch warning:', e);
    } finally {
      setIsLoadingLedger(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleSettlementComplete = (newSettlement) => {
    const payout = parseFloat(newSettlement.payout_amount) || 0;
    const wager = parseFloat(newSettlement.wager_amount) || 0;
    const profit = payout - wager;

    setBalance((prev) => parseFloat((prev + profit).toFixed(2)));
    setSettlements((prev) => [newSettlement, ...prev.slice(0, 19)]);
  };

  // Toggle or add pick to Bet Slip
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
      // Replace same match if different outcome picked
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
    setBalance((prev) => Math.max(0, parseFloat((prev - amount).toFixed(2))));
  };

  const handleApplyAccaToFlight = (odds) => {
    setBoostMultiplier(odds);
    setActiveTab('cockpit');
    setEngineMode('aviator');
  };

  // Stats calculation
  const totalSettledCount = settlements.length;
  const highestMultiplier = settlements.reduce((max, curr) => Math.max(max, parseFloat(curr.multiplier) || 1), 1.00);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-mono relative selection:bg-cyan-500 selection:text-black">
      {/* Ambient background vector grid */}
      <div className="fixed inset-0 scanlines opacity-40 pointer-events-none z-50"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

      {/* Primary Header */}
      <header className="border-b border-cyan-500/20 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-cyan-950 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-wider text-slate-100 flex items-center gap-2">
                SOVEREIGN VECTOR
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  100% SERVERLESS
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>NODE: <span className="text-cyan-400">betting-deployment.netlify.app</span></span>
                <span className="text-slate-600">|</span>
                <span className="text-[11px] text-amber-400 font-semibold">ODDS WALLET: 4AB1u2f...qA4m</span>
              </div>
            </div>
          </div>

          {/* Quick Telemetry & Controls */}
          <div className="flex items-center gap-3 text-xs">
            {/* Audio Mute */}
            <button
              onClick={toggleMute}
              className="p-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Operator Balance & Deposit Reload */}
            <div className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block leading-tight">LEDGER BALANCE</span>
                <span className="font-bold text-emerald-400 text-sm tracking-wide">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                title="Deposit or Renew $100"
              >
                <PlusCircle className="w-3 h-3 text-emerald-400" /> +$100 RENEW
              </button>
            </div>

            {/* User Provider Sign In & Profile Button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-3 py-1.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/10"
              title="Open User Provider Sign In & Account Profile"
            >
              <User className="w-3.5 h-3.5" />
              <span>{userId}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 text-xs overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cockpit'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" /> SIMULATION COCKPIT
          </button>
          <button
            onClick={() => setActiveTab('football')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'football'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" /> TOP 5 FOOTBALL (26/27) & TEAM BOARDS
          </button>
          <button
            onClick={() => setActiveTab('odds')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'odds'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4 text-cyan-400" /> LIVE SPORTS ODDS
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" /> SERVERLESS TERMINAL
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" /> ENVIRONMENT MAPPING
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> IMMUTABLE LEDGER SCHEMA
          </button>
        </div>

        {/* Tab 1: Cockpit (Core Automated Engines & Ledger) */}
        {activeTab === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Simulation Engines */}
            <div className="lg:col-span-8 space-y-4">
              {/* Engine Mode Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-950 p-2.5 rounded-xl border border-slate-800 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEngineMode('aviator')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'aviator'
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5 transform -rotate-45" />
                    AVIATOR AUTO-ENGINE
                  </button>
                  <button
                    onClick={() => setEngineMode('vector')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'vector'
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    VECTOR TRAJECTORY CANVAS
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-2 pr-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  MODE: <span className="text-cyan-300 font-bold">{engineMode === 'aviator' ? 'CALM-DOWN & AUTO-LOCK STAKING' : 'AUTOMATED VECTOR TRAJECTORY'}</span>
                </div>
              </div>

              {engineMode === 'aviator' ? (
                <div className="flex justify-center">
                  <AviatorEngine
                    userId={userId}
                    externalBalance={balance}
                    onBalanceChange={(newBal) => setBalance(newBal)}
                    onSettlementComplete={handleSettlementComplete}
                    onOpenProfile={() => setIsProfileOpen(true)}
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

                  {/* Stake & Configuration Cockpit */}
                  <div className="bg-gray-950 p-5 rounded-xl border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                      <span className="uppercase tracking-widest font-bold text-slate-300 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        AUTO-SETTLEMENT PARAMETERS
                      </span>
                      <span className="text-[11px] text-emerald-400 font-bold">100% SERVERLESS ATOMIC PIPELINE</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Wager Amount selector */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                          WAGER STAKE (USD)
                        </label>
                        <div className="flex gap-2 mb-2">
                          {[10, 25, 50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setWagerAmount(amt)}
                              className={`flex-1 py-1.5 text-xs rounded border transition cursor-pointer font-bold ${
                                wagerAmount === amt
                                  ? 'bg-cyan-500 text-black border-cyan-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-500 text-xs">$</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={wagerAmount}
                            onChange={(e) => setWagerAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-7 py-2 text-xs text-cyan-300 focus:border-cyan-400 outline-hidden font-bold"
                          />
                        </div>
                      </div>

                      {/* Auto-Cashout Selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-slate-400 font-medium">
                            AUTO-SETTLEMENT MULTIPLIER
                          </label>
                          <button
                            onClick={() => setUseAutoCashout(!useAutoCashout)}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase cursor-pointer ${
                              useAutoCashout
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {useAutoCashout ? 'AUTO-LOCK ON' : 'AUTO-LOCK OFF'}
                          </button>
                        </div>

                        <div className="flex gap-2 mb-2">
                          {['1.50', '2.00', '3.00', '5.00', '10.00'].map((mult) => (
                            <button
                              key={mult}
                              onClick={() => {
                                setAutoCashout(mult);
                                setUseAutoCashout(true);
                              }}
                              className={`flex-1 py-1.5 text-xs rounded border transition cursor-pointer font-bold ${
                                useAutoCashout && autoCashout === mult
                                  ? 'bg-emerald-500 text-black border-emerald-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
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
                          placeholder="e.g. 2.00"
                          className={`w-full bg-slate-900 border rounded px-3 py-2 text-xs font-bold outline-hidden ${
                            useAutoCashout
                              ? 'border-slate-800 text-emerald-300 focus:border-emerald-400'
                              : 'border-slate-800/40 text-slate-600 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Bet Slip & Immutable Ledger */}
            <div className="lg:col-span-4 space-y-6">
              {/* Football Acca Bet Slip Component */}
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
              />

              {/* Telemetry Snapshot Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">SETTLED BLOCKS</div>
                  <div className="text-xl font-bold text-cyan-400 mt-1">{totalSettledCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">WORM Verified</div>
                </div>

                <div className="bg-gray-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">PEAK MULTIPLIER</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{highestMultiplier.toFixed(2)}x</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Record Vector</div>
                </div>
              </div>

              {/* Immutable Settlement Ledger */}
              <div className="bg-gray-950 rounded-xl border border-slate-800 overflow-hidden shadow-xl flex flex-col">
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 tracking-wider">
                      IMMUTABLE LEDGER
                    </span>
                  </div>
                  <button
                    onClick={fetchLedger}
                    className="text-slate-400 hover:text-cyan-400 p-1 rounded transition cursor-pointer"
                    title="Refresh Ledger"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLedger ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="p-2 text-[10px] bg-slate-900/50 border-b border-slate-800/80 text-slate-400 flex justify-between px-3">
                  <span>SOURCE: <span className="text-cyan-400">{ledgerSource}</span></span>
                  <span className="text-emerald-400">STATUS: ACTIVE</span>
                </div>

                {/* Ledger Items List */}
                <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
                  {settlements.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No settled blocks yet in ledger. Execute vector to register atomic settlement.
                    </div>
                  ) : (
                    settlements.map((item, idx) => (
                      <div key={item.id || item.session_id || idx} className="p-3 hover:bg-slate-900/40 transition">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-cyan-400">
                            {item.session_id || item.id?.slice(0, 14)}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                            {item.status || 'SETTLED'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Wager: ${parseFloat(item.wager_amount || 0).toFixed(2)} @{' '}
                            <span className="text-cyan-300 font-bold">
                              {parseFloat(item.multiplier || 1).toFixed(2)}x
                            </span>
                          </span>
                          <span className="font-bold text-emerald-400">
                            +${parseFloat(item.payout_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                          <span>OP: {item.user_id}</span>
                          <span>{item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'RECENT'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Top 5 Football Leagues (2026/2027) with Bet Slip */}
        {activeTab === 'football' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <Top5FootballSim
                picks={betPicks}
                onTogglePick={handleTogglePick}
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
              />
            </div>
          </div>
        )}

        {/* Tab 3: Live Sports & Verified Odds with Bet Slip */}
        {activeTab === 'odds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <LiveOddsPortal />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <BetSlip
                picks={betPicks}
                onRemovePick={handleRemovePick}
                onClearPicks={handleClearPicks}
                balance={balance}
                onDeductStake={handleDeductStake}
                onApplyAccaToFlight={handleApplyAccaToFlight}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Serverless Deployment Terminal */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="bg-gray-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  SOVEREIGN IN-APP SERVERLESS TERMINAL
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deploy, test, and audit all Netlify serverless functions directly from the browser cockpit. Zero Termux dependency.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/30">
                100% NETLIFY SERVERLESS
              </span>
            </div>

            <ServerlessTerminal
              userId={userId}
              balance={balance}
              onBalanceUpdate={(newBal) => setBalance(newBal)}
            />
          </div>
        )}

        {/* Tab 5: Environment Mapping */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="bg-gray-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                    I. 100% Serverless Environment Architecture
                  </h2>
                </div>
                <span className="text-xs text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                  ZERO EXTERNAL SHELL DEPENDENCY
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Component</th>
                      <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Target Hosting / Environment</th>
                      <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Tooling & Runtime</th>
                      <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Operational Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">Frontend Cockpit & Sim</td>
                      <td className="py-3 px-3 text-slate-300">Netlify Edge CDN (betting-deployment.netlify.app)</td>
                      <td className="py-3 px-3 text-slate-400">Vite + React + HTML5 Canvas</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> OPERATIONAL
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">User Provider & Credit Auth</td>
                      <td className="py-3 px-3 text-slate-300">In-App Account Provider Portal</td>
                      <td className="py-3 px-3 text-slate-400">Sovereign Identity + Netlify Database</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ACTIVE
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">Acca Bet Slip Engine</td>
                      <td className="py-3 px-3 text-slate-300">Multi-Leg Accumulator + Flight Booster</td>
                      <td className="py-3 px-3 text-slate-400">Real-Time Odds Calculator</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ARMED
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">Top 5 European Leagues Board</td>
                      <td className="py-3 px-3 text-slate-300">EPL, La Liga, Serie A, Bundesliga, Ligue 1</td>
                      <td className="py-3 px-3 text-slate-400">Visual Team Board + Auto-Simulation Ticker</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> LIVE ENGINE
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">WORM Settlement Engine</td>
                      <td className="py-3 px-3 text-slate-300">Netlify Function (/.netlify/functions/settle)</td>
                      <td className="py-3 px-3 text-slate-400">Node.js Serverless Runtime</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ZERO-LATENCY ATOMIC
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-bold text-cyan-300">Card Rail Withdrawal API</td>
                      <td className="py-3 px-3 text-slate-300">Netlify Function (/.netlify/functions/withdraw)</td>
                      <td className="py-3 px-3 text-slate-400">Node.js Serverless Runtime ($100 floor)</td>
                      <td className="py-3 px-3 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ACTIVE RAIL
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Schema View */}
        {activeTab === 'schema' && (
          <div className="space-y-6">
            <div className="bg-gray-950 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                    Immutable Ledger & Football Database Schema
                  </h2>
                </div>
                <span className="text-xs text-cyan-400 font-mono">
                  MANAGED MIGRATIONS
                </span>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed">
{`-- 1. Core bet settlements table
CREATE TABLE IF NOT EXISTS bet_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    wager_amount NUMERIC(12, 2) NOT NULL CHECK (wager_amount >= 0),
    multiplier NUMERIC(8, 4) NOT NULL CHECK (multiplier >= 1.0000),
    payout_amount NUMERIC(12, 2) GENERATED ALWAYS AS (wager_amount * multiplier) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Multi-rail financial ledger
CREATE TABLE IF NOT EXISTS financial_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 4) NOT NULL,
    hot_wallet_address TEXT,
    gas_fee_paid NUMERIC(14, 8) DEFAULT 0,
    tx_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* User Provider Sign In & Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={userId}
        onUserChange={(newId) => setUserId(newId)}
        balance={balance}
        onBalanceChange={(newBal) => setBalance(newBal)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 mt-12 bg-gray-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>SOVEREIGN BETTING DEPLOYMENT // 100% SERVERLESS ENGINE</span>
          </div>
          <div className="flex items-center gap-4">
            <span>ODDS WALLET: 4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m</span>
            <span>NETLIFY FUNCTIONS // DRIZZLE ORM // NEON POSTGRESQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
