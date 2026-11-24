import React, { useState, useEffect, useCallback } from 'react';
import { BettingCanvas } from './components/BettingCanvas.jsx';
import { AviatorEngine } from './components/AviatorEngine.jsx';
import { Top5FootballSim } from './components/Top5FootballSim.jsx';
import { LiveOddsPortal } from './components/LiveOddsPortal.jsx';
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
} from 'lucide-react';

const SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';

export default function App() {
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState(0);
  const [engineMode, setEngineMode] = useState('aviator');
  const [wagerAmount, setWagerAmount] = useState(10.0);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [useAutoCashout, setUseAutoCashout] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledgerSource, setLedgerSource] = useState('POSTGRES_LEDGER');
  const [activeTab, setActiveTab] = useState('cockpit');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [betPicks, setBetPicks] = useState([]);
  const [boostMultiplier, setBoostMultiplier] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const tab = params.get('tab');
      if (mode === 'aviator' || mode === 'vector') {
        setEngineMode(mode);
        setActiveTab('cockpit');
      } else if (tab && tab !== 'terminal') {
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

    setBalance((prev) => Number(Math.max(0, prev + profit).toFixed(2)));
    setSettlements((prev) => [newSettlement, ...prev.slice(0, 19)]);
  };

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
    setBalance((prev) => Math.max(0, Number((prev - amount).toFixed(2))));
  };

  const handleApplyAccaToFlight = (odds) => {
    setBoostMultiplier(odds);
    setActiveTab('cockpit');
    setEngineMode('aviator');
  };

  const totalSettledCount = settlements.length;
  const highestMultiplier = settlements.reduce(
    (max, curr) => Math.max(max, Number(curr.multiplier) || 1),
    1.0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-slate-900">
                Match &amp; Flight Sportsbook
              </div>
              <div className="text-xs text-slate-500">
                Wallet: <span className="font-mono text-slate-700">{SETTLEMENT_WALLET}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-blue-700" />}
            </button>

            <div className="px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              <div>
                <span className="text-[10px] text-emerald-800 block leading-tight font-semibold">
                  BALANCE
                </span>
                <span className="font-bold text-emerald-700 text-sm">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>{userId || 'Account'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        <div className="flex border-b border-slate-200 gap-2 text-xs overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cockpit'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plane className="w-4 h-4" /> Aviator &amp; Flight
          </button>
          <button
            onClick={() => setActiveTab('football')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'football'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-600" /> Top 5 Football (26/27)
          </button>
          <button
            onClick={() => setActiveTab('odds')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'odds'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-emerald-700" /> Sports &amp; Live Events
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" /> Ledger Schema
          </button>
        </div>

        {activeTab === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEngineMode('aviator')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'aviator'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" />
                    Aviator
                  </button>
                  <button
                    onClick={() => setEngineMode('vector')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      engineMode === 'vector'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Flight Curve
                  </button>
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

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                      Stake &amp; Auto Cashout
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-600 block mb-1.5 font-semibold">
                          Wager Stake ($)
                        </label>
                        <div className="flex gap-2 mb-2">
                          {[10, 25, 50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setWagerAmount(amt)}
                              className={`flex-1 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                wagerAmount === amt
                                  ? 'bg-blue-700 text-white border-blue-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-slate-600 font-semibold">
                            Auto Cashout (x)
                          </label>
                          <button
                            onClick={() => setUseAutoCashout(!useAutoCashout)}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase cursor-pointer ${
                              useAutoCashout
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {useAutoCashout ? 'ON' : 'OFF'}
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
                              className={`flex-1 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                useAutoCashout && autoCashout === mult
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold disabled:bg-slate-100"
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
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">SETTLED</div>
                  <div className="text-xl font-bold text-blue-700 mt-1">{totalSettledCount}</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">TOP MULTIPLIER</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {highestMultiplier.toFixed(2)}x
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Settlement Ledger
                    </span>
                  </div>
                  <button
                    onClick={fetchLedger}
                    className="text-slate-600 hover:text-blue-700 p-1 rounded transition cursor-pointer"
                    title="Refresh Ledger"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLedger ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="p-2 text-[10px] bg-slate-50 border-b border-slate-200 text-slate-500 flex justify-between px-3">
                  <span>Source: {ledgerSource}</span>
                  <span className="text-emerald-700 font-semibold">Active</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {settlements.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No settlements recorded yet.
                    </div>
                  ) : (
                    settlements.map((item, idx) => (
                      <div key={item.id || item.session_id || idx} className="p-3 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-600">
                            {item.session_id || String(item.id || '').slice(0, 14)}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {item.status || 'SETTLED'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            ${Number(item.wager_amount || 0).toFixed(2)} @{' '}
                            <strong className="text-slate-900">
                              {Number(item.multiplier || 1).toFixed(2)}x
                            </strong>
                          </span>
                          <span className="font-bold text-emerald-700">
                            +${Number(item.payout_amount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
              />
            </div>
          </div>
        )}

        {activeTab === 'odds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <LiveOddsPortal userId={userId} onAccumulatorOddsChange={setBoostMultiplier} />
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

        {activeTab === 'schema' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Database className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-bold text-slate-900">
                PostgreSQL &amp; Drizzle Ledger Schema
              </h2>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
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
        )}
      </main>

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={userId}
        onUserChange={(newId) => setUserId(newId)}
        balance={balance}
        onBalanceChange={(newBal) => setBalance(newBal)}
      />

      <footer className="border-t border-slate-200 py-5 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            Monthly $100 disbursement applies on the scheduled monthly cycle — wait for monthly $100 disbursement.
          </div>
          <div className="font-mono text-slate-700">
            Wallet: {SETTLEMENT_WALLET}
          </div>
        </div>
      </footer>
    </div>
  );
}
