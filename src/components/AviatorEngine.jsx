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
} from 'lucide-react';

function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.04) return 1.0;
  const val = (100 * 0.96) / (100 * (1 - r));
  return Math.min(25.0, Number(Math.max(1.01, val).toFixed(2)));
}

export function Aviator({
  userId = '',
  initialBalance = 0,
  externalBalance,
  onBalanceChange,
  onSettlementComplete,
  onOpenProfile,
  boostMultiplier = null,
}) {
  const [balance, setBalance] = useState(externalBalance ?? initialBalance);

  const [wagerStake, setWagerStake] = useState(10.0);
  const [targetOdds, setTargetOdds] = useState(2.0);
  const [autoLoop, setAutoLoop] = useState(false);
  const [accaBoostActive, setAccaBoostActive] = useState(false);

  const [countdownDuration, setCountdownDuration] = useState(5);
  const [calmDownRemaining, setCalmDownRemaining] = useState(null);
  const [isBettingUnlocked, setIsBettingUnlocked] = useState(true);
  const [flightPhase, setFlightPhase] = useState('IDLE');

  const [multiplier, setMultiplier] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [settlementLog, setSettlementLog] = useState('');

  const hasSettledRef = useRef(false);
  const crashPointRef = useRef(2.0);
  const canvasRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    if (externalBalance !== undefined && externalBalance !== null) {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  useEffect(() => {
    if (boostMultiplier && boostMultiplier > 1.0) {
      setTargetOdds(Number(boostMultiplier.toFixed(2)));
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

  const clearCountdownTimer = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const launchFlight = useCallback(() => {
    if (balance < wagerStake) {
      setSettlementLog('ERROR: Insufficient balance for stake');
      setFlightPhase('IDLE');
      setCalmDownRemaining(null);
      setIsBettingUnlocked(true);
      return;
    }

    clearCountdownTimer();
    setCalmDownRemaining(null);
    setIsBettingUnlocked(false);

    const nextBal = Number((balance - wagerStake).toFixed(2));
    updateBalance(nextBal);

    crashPointRef.current = generateCrashPoint();
    setMultiplier(1.0);
    setIsRunning(true);
    setFlightPhase('FLYING');
    setSettlementLog('');
    hasSettledRef.current = false;
    sound.playLaunchWhoosh();
  }, [balance, wagerStake, clearCountdownTimer, updateBalance]);

  const startCalmDownCountdown = useCallback(
    (durationOverride = null) => {
      clearCountdownTimer();
      const duration = durationOverride || countdownDuration;
      setCalmDownRemaining(duration);
      setFlightPhase('CALM_DOWN');
      setIsBettingUnlocked(true);
      sound.playCountdownTick(duration);

      let count = duration;
      countdownIntervalRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCalmDownRemaining(count);
          sound.playCountdownTick(count);
        } else {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setCalmDownRemaining(0);
          setTimeout(() => {
            launchFlight();
          }, 150);
        }
      }, 1000);
    },
    [countdownDuration, clearCountdownTimer, launchFlight]
  );

  const cancelCountdown = useCallback(() => {
    clearCountdownTimer();
    setCalmDownRemaining(null);
    setFlightPhase('IDLE');
    setIsBettingUnlocked(true);
  }, [clearCountdownTimer]);

  const executeSettlement = useCallback(
    async (finalMult, triggerType) => {
      const sessionId = `aviator_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const payout = Number((wagerStake * finalMult).toFixed(2));
      setFlightPhase('LOCKED');
      sound.playCashout();

      let settlementId = sessionId;
      let timestamp = new Date().toISOString();

      try {
        const res = await fetch('/.netlify/functions/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId,
            wagerAmount: wagerStake,
            multiplier: finalMult,
            triggerType,
          }),
        });
        const data = await res.json();
        if (data.settlementId) settlementId = data.settlementId;
        if (data.timestamp) timestamp = data.timestamp;
      } catch {
        // Keep local balance update synced when offline
      }

      const settledBal = Number((balance + payout).toFixed(2));
      updateBalance(settledBal);
      setSettlementLog(`[${triggerType}] SETTLED: +$${payout.toFixed(2)} @ ${finalMult.toFixed(2)}x`);

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

      if (autoLoop) {
        setTimeout(() => {
          startCalmDownCountdown();
        }, 1200);
      } else {
        setIsBettingUnlocked(true);
      }
    },
    [wagerStake, userId, balance, autoLoop, updateBalance, onSettlementComplete, startCalmDownCountdown]
  );

  useEffect(() => {
    let animationId;
    let currentMult = 1.0;

    if (isRunning) {
      hasSettledRef.current = false;

      const tick = () => {
        currentMult += 0.015;
        const formattedMult = Number(currentMult.toFixed(2));
        setMultiplier(formattedMult);

        if (Math.floor(formattedMult * 10) % 5 === 0) {
          sound.playVectorClimb(formattedMult);
        }

        if (formattedMult >= targetOdds && !hasSettledRef.current) {
          hasSettledRef.current = true;
          setIsRunning(false);
          executeSettlement(formattedMult, 'AUTO-LOCK HIT');
          return;
        }

        if (formattedMult >= crashPointRef.current) {
          hasSettledRef.current = true;
          setIsRunning(false);
          setFlightPhase('CRASHED');
          sound.playCrash();
          setSettlementLog(`CRASHED @ ${crashPointRef.current.toFixed(2)}x`);

          if (autoLoop) {
            setTimeout(() => {
              startCalmDownCountdown();
            }, 1200);
          } else {
            setIsBettingUnlocked(true);
          }
          return;
        }

        animationId = requestAnimationFrame(tick);
      };

      animationId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(animationId);
      clearCountdownTimer();
    };
  }, [isRunning, targetOdds, autoLoop, executeSettlement, startCalmDownCountdown, clearCountdownTimer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const multClamped = Math.min(10.0, multiplier);
      const progress = (multClamped - 1.0) / 9.0;
      const currentX = width * Math.min(1.0, 0.1 + progress * 0.9);
      const currentY = height - progress * (height - 35) - 20;

      const grad = ctx.createLinearGradient(0, currentY, 0, height);
      if (flightPhase === 'CRASHED') {
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
      } else if (flightPhase === 'LOCKED') {
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else if (flightPhase === 'CALM_DOWN') {
        grad.addColorStop(0, 'rgba(234, 179, 8, 0.20)');
        grad.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
      } else {
        grad.addColorStop(0, 'rgba(225, 29, 72, 0.22)');
        grad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.lineTo(currentX, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle =
        flightPhase === 'CRASHED'
          ? '#f43f5e'
          : flightPhase === 'LOCKED'
            ? '#10b981'
            : flightPhase === 'CALM_DOWN'
              ? '#eab308'
              : '#f43f5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.stroke();

      ctx.fillStyle =
        flightPhase === 'CRASHED' ? '#f43f5e' : flightPhase === 'CALM_DOWN' ? '#facc15' : '#fda4af';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      if (isRunning) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isRunning, multiplier, flightPhase]);

  const handleInstantAutoSettle = () => {
    if (isRunning && !hasSettledRef.current) {
      hasSettledRef.current = true;
      setIsRunning(false);
      executeSettlement(multiplier, 'INSTANT AUTO-SETTLE');
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-950 text-rose-400 font-mono p-6 border border-slate-800 rounded-lg shadow-2xl">
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-rose-400 transform -rotate-45" />
            <h2 className="text-xl font-bold text-white tracking-widest">// AVIATOR ENGINE</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">AUTONOMOUS FLIGHT &amp; SETTLEMENT</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">BALANCE</div>
          <div className="text-2xl font-bold text-emerald-400">${balance.toFixed(2)}</div>
        </div>
      </div>

      {balance <= 0 && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Balance is $0.00. Open Account to manage wallet or wait for monthly $100 disbursement.</span>
          </div>
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] uppercase transition cursor-pointer whitespace-nowrap"
            >
              ACCOUNT
            </button>
          )}
        </div>
      )}

      {accaBoostActive && (
        <div className="mb-3 p-2 rounded bg-slate-900 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>
              ACCUMULATOR BOOST: Target multiplier set to{' '}
              <strong className="text-white">{targetOdds.toFixed(2)}x</strong>
            </span>
          </div>
          <button
            onClick={() => setAccaBoostActive(false)}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      <div className="mb-4 p-2.5 rounded border flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-900/90 border-slate-800">
        <div className="flex items-center gap-2">
          {isBettingUnlocked ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold">
              <Unlock className="w-3.5 h-3.5" />
              BETTING UNLOCKED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-400 font-bold">
              <Lock className="w-3.5 h-3.5" />
              FLIGHT IN PROGRESS
            </span>
          )}
          <span className="text-slate-400 text-[11px]">
            STAKE: <strong className="text-white">${wagerStake.toFixed(2)}</strong> @{' '}
            <strong className="text-rose-400">{targetOdds.toFixed(2)}x</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> COUNTDOWN:
          </span>
          <button
            onClick={() => setCountdownDuration(5)}
            disabled={flightPhase === 'FLYING'}
            className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer transition ${
              countdownDuration === 5
                ? 'bg-amber-500 text-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            5s
          </button>
          <button
            onClick={() => setCountdownDuration(3)}
            disabled={flightPhase === 'FLYING'}
            className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer transition ${
              countdownDuration === 3
                ? 'bg-amber-500 text-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            3s
          </button>
        </div>
      </div>

      <div className="relative h-48 bg-slate-900 border border-slate-800 rounded mb-4 flex items-center justify-center overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={580}
          height={192}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {flightPhase === 'CALM_DOWN' && calmDownRemaining !== null ? (
          <div className="relative z-10 flex flex-col items-center justify-center animate-pulse">
            <div className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-amber-400 animate-spin" /> TAKEOFF IN
            </div>
            <div className="text-6xl font-black text-amber-300 drop-shadow-lg tracking-wider">
              {calmDownRemaining}
              <span className="text-2xl text-amber-400">s</span>
            </div>
          </div>
        ) : (
          <div className="relative z-10 text-5xl font-extrabold text-white tracking-wider drop-shadow-md select-none">
            {multiplier.toFixed(2)}
            <span className="text-rose-400">x</span>
          </div>
        )}

        {isRunning && (
          <div className="absolute top-3 left-3 text-xs text-rose-300 animate-pulse flex items-center gap-1.5 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
            IN FLIGHT
          </div>
        )}

        {flightPhase === 'LOCKED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-emerald-400 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> SETTLED
          </div>
        )}

        {flightPhase === 'CRASHED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-rose-400 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> CRASHED
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-400 font-bold">AUTO-LOCK ODDS</label>
            <div className="flex gap-1">
              {[1.5, 2.0, 3.0, 5.0].map((odds) => (
                <button
                  key={odds}
                  onClick={() => setTargetOdds(odds)}
                  disabled={flightPhase === 'FLYING'}
                  className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                    targetOdds === odds
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {odds.toFixed(2)}x
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            step="0.10"
            min="1.05"
            value={targetOdds}
            disabled={flightPhase === 'FLYING'}
            onChange={(e) => setTargetOdds(parseFloat(e.target.value) || 1.1)}
            className="w-full bg-slate-900 border border-slate-800 p-2 text-white font-bold rounded text-sm focus:border-rose-400 outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1 font-bold">WAGER STAKE</label>
          <input
            type="number"
            min="1"
            value={wagerStake}
            disabled={flightPhase === 'FLYING'}
            onChange={(e) => setWagerStake(parseFloat(e.target.value) || 1)}
            className="w-full bg-slate-900 border border-slate-800 p-2 text-white font-bold rounded text-sm focus:border-rose-400 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs">
        <span className="text-slate-400 text-[11px] font-bold">QUICK STAKE:</span>
        <div className="flex gap-1.5">
          {[10, 25, 50, 100, 250].map((amt) => (
            <button
              key={amt}
              onClick={() => setWagerStake(amt)}
              disabled={flightPhase === 'FLYING'}
              className={`px-2.5 py-1 text-xs rounded font-bold transition cursor-pointer ${
                wagerStake === amt
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-800 pl-2">
          <input
            type="checkbox"
            id="autoloop-check"
            checked={autoLoop}
            onChange={(e) => setAutoLoop(e.target.checked)}
            className="cursor-pointer accent-rose-500"
          />
          <label
            htmlFor="autoloop-check"
            className="text-[10px] text-slate-300 cursor-pointer font-bold select-none"
          >
            AUTO-LOOP
          </label>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {flightPhase === 'FLYING' ? (
          <button
            onClick={handleInstantAutoSettle}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base tracking-widest uppercase rounded shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-black" />
            CASHOUT NOW [${(wagerStake * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
          </button>
        ) : flightPhase === 'CALM_DOWN' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={launchFlight}
              className="py-3.5 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Plane className="w-4 h-4 transform -rotate-45" />
              TAKEOFF NOW ({calmDownRemaining}s)
            </button>
            <button
              onClick={cancelCountdown}
              className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm tracking-wider uppercase rounded border border-slate-700 transition cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => startCalmDownCountdown(countdownDuration)}
              className="sm:col-span-2 py-4 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm tracking-wider uppercase rounded transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              START {countdownDuration}s COUNTDOWN (${wagerStake.toFixed(2)})
            </button>
            <button
              onClick={launchFlight}
              className="py-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs tracking-wider uppercase rounded transition cursor-pointer"
            >
              TAKEOFF
            </button>
          </div>
        )}
      </div>

      {settlementLog && (
        <div className="mb-4 p-2.5 bg-slate-900 border border-slate-800 text-emerald-400 text-xs rounded flex items-center justify-between">
          <span>{settlementLog}</span>
          <span className="text-[10px] text-slate-500">LEDGER</span>
        </div>
      )}

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400 text-[11px]">WITHDRAWALS &amp; ACCOUNT</span>
        </div>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            ACCOUNT &amp; WITHDRAWALS
          </button>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-900 text-[11px] text-slate-500">
        Monthly $100 disbursement applies on the scheduled monthly cycle — wait for monthly $100 disbursement.
      </div>
    </div>
  );
}
