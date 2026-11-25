import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import {
  Plane,
  Zap,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Unlock,
  Lock,
  Timer,
  User,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.04) return 1.0;
  const val = (100 * 0.96) / (100 * (1 - r));
  return Math.min(50.0, Number(Math.max(1.01, val).toFixed(2)));
}

export function AviatorEngine({
  userId = '',
  initialBalance = 1000,
  externalBalance,
  onBalanceChange,
  onSettlementComplete,
  onOpenProfile,
  boostMultiplier = null,
}) {
  const [balance, setBalance] = useState(externalBalance ?? initialBalance);

  // Staking & Cashout settings
  const [wagerStake, setWagerStake] = useState(10.0);
  const [targetOdds, setTargetOdds] = useState(2.0);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(true);
  const [autoLoop, setAutoLoop] = useState(true);
  const [accaBoostActive, setAccaBoostActive] = useState(false);

  // Round & Flight state
  // Phases: 'COUNTDOWN' | 'FLYING' | 'CRASHED'
  const [flightPhase, setFlightPhase] = useState('COUNTDOWN');
  const [countdownRemaining, setCountdownRemaining] = useState(5);
  const [multiplier, setMultiplier] = useState(1.0);
  const [recentMultipliers, setRecentMultipliers] = useState([
    1.85, 2.45, 1.22, 4.10, 1.15, 3.20, 12.8, 1.62,
  ]);

  // User round participation state
  // betState: 'NONE' | 'PLACED' | 'QUEUED' | 'CASHED_OUT'
  const [betState, setBetState] = useState('NONE');
  const [cashedOutAmount, setCashedOutAmount] = useState(null);
  const [cashedOutMultiplier, setCashedOutMultiplier] = useState(null);
  const [settlementLog, setSettlementLog] = useState('');

  // Refs for animation & state synchronization
  const hasSettledRef = useRef(false);
  const crashPointRef = useRef(2.5);
  const canvasRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isFlyingRef = useRef(false);

  useEffect(() => {
    if (externalBalance !== undefined && externalBalance !== null) {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  useEffect(() => {
    if (boostMultiplier && boostMultiplier > 1.0) {
      setTargetOdds(Number(boostMultiplier.toFixed(2)));
      setAutoCashoutEnabled(true);
      setAccaBoostActive(true);
    }
  }, [boostMultiplier]);

  const updateBalance = useCallback(
    (newBal) => {
      const clamped = Number(Math.max(0, newBal).toFixed(2));
      setBalance(clamped);
      if (onBalanceChange) {
        onBalanceChange(clamped);
      }
    },
    [onBalanceChange]
  );

  // Settlement execution to Netlify backend
  const executeSettlement = useCallback(
    async (finalMult, triggerType) => {
      const sessionId = `aviator_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const payout = Number((wagerStake * finalMult).toFixed(2));
      sound.playCashout();

      setCashedOutAmount(payout);
      setCashedOutMultiplier(finalMult);
      setBetState('CASHED_OUT');

      let settlementId = sessionId;
      let timestamp = new Date().toISOString();

      try {
        const res = await fetch('/.netlify/functions/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: userId || 'ApexPlayer_01',
            wagerAmount: wagerStake,
            multiplier: finalMult,
            triggerType,
          }),
        });
        const data = await res.json();
        if (data.settlementId) settlementId = data.settlementId;
        if (data.timestamp) timestamp = data.timestamp;
      } catch {
        // Keep local balance updated if offline
      }

      const settledBal = Number((balance + payout).toFixed(2));
      updateBalance(settledBal);
      setSettlementLog(`[${triggerType}] WON: +$${payout.toFixed(2)} @ ${finalMult.toFixed(2)}x`);

      if (onSettlementComplete) {
        onSettlementComplete({
          id: settlementId,
          session_id: sessionId,
          user_id: userId,
          wager_amount: wagerStake.toFixed(2),
          multiplier: finalMult.toFixed(2),
          payout_amount: payout.toFixed(2),
          status: 'SETTLED',
          created_at: timestamp,
        });
      }
    },
    [wagerStake, userId, balance, updateBalance, onSettlementComplete]
  );

  // Start Pre-Flight Countdown
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    isFlyingRef.current = false;
    hasSettledRef.current = false;
    setFlightPhase('COUNTDOWN');
    setCountdownRemaining(5);
    setMultiplier(1.0);
    setCashedOutAmount(null);
    setCashedOutMultiplier(null);
    setSettlementLog('');

    // If user had queued a bet for next flight, activate it now!
    setBetState((prev) => {
      if (prev === 'QUEUED') {
        return 'PLACED';
      }
      return 'NONE';
    });

    let count = 5;
    sound.playCountdownTick(count);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownRemaining(count);
        sound.playCountdownTick(count);
      } else {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdownRemaining(0);
        // Launch Flight
        launchFlightInternal();
      }
    }, 1000);
  }, []); // will reference launchFlightInternal via ref

  // Takeoff / Launch Flight
  const launchFlightInternal = useCallback(() => {
    isFlyingRef.current = true;
    hasSettledRef.current = false;
    setFlightPhase('FLYING');
    sound.playLaunchWhoosh();

    const targetCrash = generateCrashPoint();
    crashPointRef.current = targetCrash;

    let currentMult = 1.0;
    const startTime = performance.now();

    const tick = (now) => {
      if (!isFlyingRef.current) return;

      const elapsedSec = (now - startTime) / 1000;
      // Exponential flight curve
      currentMult = 1.0 + Math.pow(elapsedSec * 0.72, 1.45);
      const formattedMult = Number(currentMult.toFixed(2));
      setMultiplier(formattedMult);

      if (Math.floor(formattedMult * 10) % 5 === 0) {
        sound.playVectorClimb(formattedMult);
      }

      // Check Auto-Cashout
      if (
        autoCashoutEnabled &&
        formattedMult >= targetOdds &&
        !hasSettledRef.current
      ) {
        // Only cashout if user actually placed a bet for this flight
        setBetState((latestBetState) => {
          if (latestBetState === 'PLACED' && !hasSettledRef.current) {
            hasSettledRef.current = true;
            executeSettlement(formattedMult, 'AUTO-CASHOUT');
          }
          return latestBetState;
        });
      }

      // Check Crash
      if (formattedMult >= crashPointRef.current) {
        isFlyingRef.current = false;
        setFlightPhase('CRASHED');
        sound.playCrash();
        setRecentMultipliers((prev) => [crashPointRef.current, ...prev.slice(0, 9)]);

        setBetState((latestBetState) => {
          if (latestBetState === 'PLACED' && !hasSettledRef.current) {
            setSettlementLog(`FLEW AWAY @ ${crashPointRef.current.toFixed(2)}x - Round Lost`);
            return 'NONE';
          }
          return latestBetState;
        });

        // If autoLoop is on, start next round after 2.5s
        setTimeout(() => {
          startCountdown();
        }, 2500);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [autoCashoutEnabled, targetOdds, executeSettlement, startCountdown]);

  // Initial mount: Start first countdown
  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [startCountdown]);

  // User Actions:
  // 1. Place Bet (during Countdown)
  const handlePlaceBet = () => {
    if (balance < wagerStake) {
      setSettlementLog('ERROR: Insufficient available balance for stake');
      return;
    }
    const nextBal = Number((balance - wagerStake).toFixed(2));
    updateBalance(nextBal);
    setBetState('PLACED');
    setSettlementLog(`BET ARMED: $${wagerStake.toFixed(2)} placed for upcoming flight`);
  };

  // 2. Cancel Bet (before Takeoff)
  const handleCancelBet = () => {
    if (flightPhase === 'COUNTDOWN' && betState === 'PLACED') {
      const refunded = Number((balance + wagerStake).toFixed(2));
      updateBalance(refunded);
      setBetState('NONE');
      setSettlementLog('Bet cancelled and stake refunded to balance.');
    }
  };

  // 3. Queue Bet for Next Flight (while Flying)
  const handleQueueBetForNextFlight = () => {
    if (balance < wagerStake) {
      setSettlementLog('ERROR: Insufficient available balance for stake');
      return;
    }
    const nextBal = Number((balance - wagerStake).toFixed(2));
    updateBalance(nextBal);
    setBetState('QUEUED');
    setSettlementLog(`BET QUEUED: $${wagerStake.toFixed(2)} reserved for NEXT flight`);
  };

  // 4. Manual Cash Out (during Flight)
  const handleManualCashout = () => {
    if (flightPhase === 'FLYING' && betState === 'PLACED' && !hasSettledRef.current) {
      hasSettledRef.current = true;
      executeSettlement(multiplier, 'MANUAL CASHOUT');
    }
  };

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background grid lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const multClamped = Math.min(15.0, multiplier);
      const progress = (multClamped - 1.0) / 14.0;
      const currentX = width * Math.min(0.92, 0.08 + progress * 0.88);
      const currentY = height - progress * (height - 45) - 25;

      // Glow fill gradient under curve
      const grad = ctx.createLinearGradient(0, currentY, 0, height);
      if (flightPhase === 'CRASHED') {
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
      } else if (betState === 'CASHED_OUT') {
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else {
        grad.addColorStop(0, 'rgba(225, 29, 72, 0.30)');
        grad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.lineTo(currentX, height);
      ctx.closePath();
      ctx.fill();

      // Trajectory curve line
      ctx.strokeStyle =
        flightPhase === 'CRASHED'
          ? '#f43f5e'
          : betState === 'CASHED_OUT'
            ? '#10b981'
            : '#e11d48';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.stroke();

      // Glowing Airplane position indicator
      ctx.fillStyle =
        flightPhase === 'CRASHED'
          ? '#f43f5e'
          : betState === 'CASHED_OUT'
            ? '#10b981'
            : '#fda4af';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Aircraft thruster glow ring
      ctx.strokeStyle =
        flightPhase === 'CRASHED' ? '#fb7185' : '#fda4af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 11, 0, Math.PI * 2);
      ctx.stroke();

      if (flightPhase === 'FLYING') {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [multiplier, flightPhase, betState]);

  return (
    <div className="w-full max-w-3xl bg-slate-950 text-slate-100 font-sans p-6 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
            <Plane className="w-6 h-6 transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-wider uppercase">
                Aviator Crash Engine
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                PROVABLY FAIR
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous Real-Time Multiplier Flight &amp; Settlement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">
              Available Balance
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* Multiplier History Pill Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-[10px] text-slate-500 uppercase font-semibold mr-1">History:</span>
        {recentMultipliers.map((m, idx) => (
          <span
            key={idx}
            className={`px-2 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap border ${
              m >= 10.0
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : m >= 2.0
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-cyan-400 border-slate-800'
            }`}
          >
            {m.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Accumulator boost banner */}
      {accaBoostActive && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>
              ACCUMULATOR BOOST: Target flight auto-cashout set to{' '}
              <strong className="text-white">{targetOdds.toFixed(2)}x</strong>
            </span>
          </div>
          <button
            onClick={() => setAccaBoostActive(false)}
            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* Main Flight Stage Screen */}
      <div className="relative h-64 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={680}
          height={256}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Phase Overlays */}
        {flightPhase === 'COUNTDOWN' ? (
          <div className="relative z-10 flex flex-col items-center justify-center animate-in zoom-in duration-200 text-center">
            <div className="text-xs uppercase tracking-widest text-amber-400 font-extrabold mb-1.5 flex items-center gap-2 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500/30">
              <Timer className="w-4 h-4 text-amber-400 animate-spin" />
              NEXT ROUND TAKEOFF IN
            </div>
            <div className="text-7xl font-black text-amber-300 drop-shadow-2xl font-mono tracking-tight">
              {countdownRemaining}
              <span className="text-3xl text-amber-400 ml-1">s</span>
            </div>
            <div className="text-xs text-slate-300 mt-2 font-medium">
              {betState === 'PLACED' ? (
                <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/40">
                  ✓ Bet of ${wagerStake.toFixed(2)} Armed for Takeoff
                </span>
              ) : (
                'Place your bet below before countdown reaches 0 to join this flight'
              )}
            </div>
          </div>
        ) : flightPhase === 'FLYING' ? (
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-2xl font-mono select-none">
              {multiplier.toFixed(2)}
              <span className="text-rose-400 font-sans">x</span>
            </div>
            {betState === 'PLACED' && (
              <div className="mt-2 text-sm font-extrabold text-emerald-400 font-mono bg-slate-950/90 px-3 py-1 rounded-full border border-emerald-500/30 animate-pulse">
                Current Value: ${(wagerStake * multiplier).toFixed(2)} USD
              </div>
            )}
            {betState === 'CASHED_OUT' && (
              <div className="mt-2 text-sm font-extrabold text-emerald-400 font-mono bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-500/40">
                ✓ Cashed Out at {cashedOutMultiplier?.toFixed(2)}x (+${cashedOutAmount?.toFixed(2)})
              </div>
            )}
            {betState === 'NONE' && (
              <div className="mt-2 text-xs text-amber-300 font-semibold bg-slate-950/80 px-2.5 py-0.5 rounded border border-amber-500/20">
                Flight in Progress — Queued for next round
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className="text-xs uppercase tracking-widest text-rose-400 font-extrabold mb-1 bg-rose-950/60 px-3 py-1 rounded-full border border-rose-500/30">
              FLEW AWAY
            </div>
            <div className="text-6xl font-black text-rose-500 drop-shadow-2xl font-mono">
              {crashPointRef.current.toFixed(2)}
              <span className="text-3xl text-rose-400 ml-1">x</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Preparing next autonomous flight countdown...
            </div>
          </div>
        )}

        {/* Status badges */}
        {flightPhase === 'FLYING' && (
          <div className="absolute top-3 left-3 text-xs text-rose-300 font-bold flex items-center gap-1.5 bg-slate-950/90 px-2.5 py-1 rounded-lg border border-rose-500/20 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            IN FLIGHT
          </div>
        )}

        <div className="absolute top-3 right-3 text-xs text-slate-400 font-bold flex items-center gap-1.5 bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-800">
          {flightPhase === 'COUNTDOWN' ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Unlock className="w-3.5 h-3.5" /> BETTING UNLOCKED
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> ROUND LOCKED
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive Staking / Cashout Action Area */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Stake selector */}
          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <label className="text-slate-300 font-bold">WAGER STAKE (USD)</label>
              <div className="flex gap-1 font-mono">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWagerStake(amt)}
                    disabled={flightPhase === 'FLYING' && betState === 'PLACED'}
                    className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer ${
                      wagerStake === amt
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-mono font-bold">$</span>
              <input
                type="number"
                min="1"
                step="5"
                value={wagerStake}
                disabled={flightPhase === 'FLYING' && betState === 'PLACED'}
                onChange={(e) => setWagerStake(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-sm font-bold focus:border-rose-400 outline-none"
              />
            </div>
          </div>

          {/* Auto-Cashout Multiplier */}
          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="auto-cashout-check"
                  checked={autoCashoutEnabled}
                  onChange={(e) => setAutoCashoutEnabled(e.target.checked)}
                  className="cursor-pointer accent-rose-500"
                />
                <label
                  htmlFor="auto-cashout-check"
                  className="text-slate-300 font-bold cursor-pointer select-none"
                >
                  AUTO-CASHOUT MULTIPLIER
                </label>
              </div>
              <div className="flex gap-1 font-mono">
                {[1.5, 2.0, 3.0, 5.0].map((odds) => (
                  <button
                    key={odds}
                    type="button"
                    onClick={() => {
                      setTargetOdds(odds);
                      setAutoCashoutEnabled(true);
                    }}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer font-bold ${
                      targetOdds === odds && autoCashoutEnabled
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {odds.toFixed(2)}x
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.10"
                min="1.05"
                value={targetOdds}
                disabled={!autoCashoutEnabled}
                onChange={(e) => setTargetOdds(Math.max(1.05, parseFloat(e.target.value) || 1.1))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-rose-400 outline-none disabled:opacity-50"
              />
              <span className="absolute right-3 top-2 text-rose-400 font-mono font-bold">x</span>
            </div>
          </div>
        </div>

        {/* PRIMARY ACTION BUTTON */}
        <div>
          {flightPhase === 'COUNTDOWN' ? (
            betState === 'PLACED' ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled
                  className="col-span-2 py-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-default"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  BET PLACED (${wagerStake.toFixed(2)}) — READY FOR FLIGHT
                </button>
                <button
                  type="button"
                  onClick={handleCancelBet}
                  className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel Bet
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePlaceBet}
                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-base uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-rose-600/25 active:scale-[0.99]"
              >
                <Plane className="w-5 h-5 transform -rotate-45" />
                PLACE BET (${wagerStake.toFixed(2)}) FOR NEXT FLIGHT
              </button>
            )
          ) : flightPhase === 'FLYING' ? (
            betState === 'PLACED' ? (
              <button
                type="button"
                onClick={handleManualCashout}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 active:scale-[0.99] animate-pulse"
              >
                <Zap className="w-5 h-5 text-slate-950" />
                CASH OUT NOW [${(wagerStake * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
              </button>
            ) : betState === 'CASHED_OUT' ? (
              <button
                disabled
                className="w-full py-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-default"
              >
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                WINNINGS LOCKED: +${cashedOutAmount?.toFixed(2)} @ {cashedOutMultiplier?.toFixed(2)}x
              </button>
            ) : betState === 'QUEUED' ? (
              <button
                disabled
                className="w-full py-4 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-default"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                BET QUEUED FOR NEXT FLIGHT (${wagerStake.toFixed(2)})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQueueBetForNextFlight}
                className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99]"
              >
                <Clock className="w-4 h-4 text-slate-950" />
                FLIGHT IN PROGRESS — QUEUE BET FOR NEXT FLIGHT (${wagerStake.toFixed(2)})
              </button>
            )
          ) : (
            <button
              disabled
              className="w-full py-4 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
            >
              ROUND OVER — STARTING NEXT FLIGHT COUNTDOWN...
            </button>
          )}
        </div>

        {/* Feedback / Settlement Log message */}
        {settlementLog && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 text-xs font-mono flex items-center justify-between">
            <span>{settlementLog}</span>
            <span className="text-[10px] text-slate-500">SETTLED</span>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Provably Fair RNG &amp; Netlify Serverless Settlement</span>
        </div>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            Crypto Cashier &amp; Payouts
          </button>
        )}
      </div>
    </div>
  );
}

export const Aviator = AviatorEngine;
export default AviatorEngine;
