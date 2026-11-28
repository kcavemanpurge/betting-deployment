import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import { Zap, Lock, Unlock, Clock } from 'lucide-react';

const MAX_DESTINATION_MULTIPLIER = 10000.0;
const COUNTDOWN_SECONDS = 5;

function scaleMultiplierToY(mult, height) {
  const safeMult = Math.max(1, Number(mult) || 1);
  // Smooth log-based progress from 1x up to 10,000x so early climbs and high runs both stay readable
  const progress = Math.min(1, Math.log10(safeMult) / Math.log10(MAX_DESTINATION_MULTIPLIER));
  const topPadding = 24;
  const bottomPadding = 18;
  const usableHeight = Math.max(60, height - topPadding - bottomPadding);
  return height - bottomPadding - progress * usableHeight;
}

export function BettingCanvas({
  userId = '',
  wagerAmount = 0,
  onSettlementComplete = () => {},
  autoCashoutMultiplier = null,
  maxTrajectoryCap = MAX_DESTINATION_MULTIPLIER,
}) {
  const canvasRef = useRef(null);

  const [multiplier, setMultiplier] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [hasCashedOutThisRound, setHasCashedOutThisRound] = useState(false);

  // Next-flight countdown & queued stake state
  const [countdown, setCountdown] = useState(0);
  const [queuedForNextFlight, setQueuedForNextFlight] = useState(false);

  // Flexible user-controlled Auto-Lock state (persists across runs until toggled off)
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoTargetInput, setAutoTargetInput] = useState(
    autoCashoutMultiplier ? String(autoCashoutMultiplier) : '3.00'
  );

  const [settlementStatus, setSettlementStatus] = useState(null);
  const [settledData, setSettledData] = useState(null);

  const stateRef = useRef({
    isRunning: false,
    currentMult: 1.0,
    crashPoint: 1.0,
    particles: [],
    cashedOut: false,
  });

  const activeStakeRef = useRef(0);
  const queuedStakeRef = useRef(0);

  useEffect(() => {
    if (autoCashoutMultiplier !== null && autoCashoutMultiplier !== undefined) {
      const parsed = Number(autoCashoutMultiplier);
      if (Number.isFinite(parsed) && parsed >= 1.01) {
        setAutoTargetInput(parsed.toFixed(2));
        setAutoLockEnabled(true);
      }
    }
  }, [autoCashoutMultiplier]);

  const parsedAutoTarget = () => {
    const val = Number(autoTargetInput);
    if (!Number.isFinite(val) || val < 1.01) return null;
    return Math.min(maxTrajectoryCap, Number(val.toFixed(2)));
  };

  // Supports high-trajectory tail rolls up to maxTrajectoryCap (default 10,000x)
  const generateCrashMultiplier = useCallback(() => {
    const r = Math.random();
    if (r < 0.03) return 1.0; // Instant bust floor

    // Blend standard curve with a tail path that can reach up to maxTrajectoryCap
    const tailRoll = Math.random();
    let rawMult;
    if (tailRoll > 0.996) {
      // Rare deep-space trajectory (up to 10,000x)
      const deepRatio = Math.random() ** 2.4;
      rawMult = 50 + deepRatio * (maxTrajectoryCap - 50);
    } else if (tailRoll > 0.94) {
      // Mid-high trajectory (10x - 250x)
      rawMult = 10 + (Math.random() ** 1.8) * 240;
    } else {
      rawMult = 0.96 / Math.max(0.001, 1 - r * 0.92);
    }

    const clamped = Math.min(maxTrajectoryCap, Math.max(1.01, Number(rawMult.toFixed(2))));
    return clamped;
  }, [maxTrajectoryCap]);

  const executeSettlement = useCallback(
    async (forcedMultiplier = null, triggerLabel = 'MANUAL CASHOUT') => {
      if (!stateRef.current.isRunning || stateRef.current.cashedOut) return;

      stateRef.current.cashedOut = true;
      stateRef.current.isRunning = false;
      setHasCashedOutThisRound(true);
      setIsRunning(false);

      const rawMult = forcedMultiplier !== null ? forcedMultiplier : stateRef.current.currentMult;
      const finalMult = Math.min(
        maxTrajectoryCap,
        Math.max(1.01, Number(Number(rawMult).toFixed(2)))
      );
      setMultiplier(finalMult);

      sound.playCashout();

      const sessionId = `aviator_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const stake = Number(activeStakeRef.current || wagerAmount || 0);
      const startTime = performance.now();

      try {
        const res = await fetch('/.netlify/functions/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId,
            wagerAmount: stake,
            multiplier: finalMult,
            triggerType: triggerLabel,
          }),
        });

        const elapsed = Math.round(performance.now() - startTime);
        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.ok || data.success)) {
          const payout = Number(data.payoutAmount ?? stake * finalMult).toFixed(2);
          setSettlementStatus(`[${triggerLabel}] SETTLED: +$${payout} @ ${finalMult.toFixed(2)}x (${elapsed}ms)`);
          const record = {
            id: data.settlementId || sessionId,
            session_id: sessionId,
            user_id: userId,
            wager_amount: stake.toFixed(2),
            multiplier: finalMult.toFixed(2),
            payout_amount: payout,
            status: 'SETTLED',
            created_at: data.timestamp || new Date().toISOString(),
          };
          setSettledData(record);
          onSettlementComplete(record);
        } else {
          setSettlementStatus(`REJECTED: ${data.error || 'Settlement rejected by server'}`);
        }
      } catch {
        setSettlementStatus(`NETWORK ERROR: Unable to verify settlement on server for ${sessionId}`);
      }
    },
    [userId, wagerAmount, maxTrajectoryCap, onSettlementComplete]
  );

  const launchFlightWithStake = useCallback(
    (stakeToUse) => {
      const cleanStake = Number(stakeToUse) || 0;
      if (!userId || cleanStake <= 0) {
        setSettlementStatus('Sign in and set a positive stake (> $0) before launching.');
        setQueuedForNextFlight(false);
        return;
      }

      activeStakeRef.current = cleanStake;
      queuedStakeRef.current = 0;
      setQueuedForNextFlight(false);
      setCountdown(0);
      setSettlementStatus(null);
      setSettledData(null);
      setIsCrashed(false);
      setHasCashedOutThisRound(false);
      setMultiplier(1.0);

      const targetCrash = generateCrashMultiplier();
      stateRef.current = {
        isRunning: true,
        currentMult: 1.0,
        crashPoint: targetCrash,
        particles: [],
        cashedOut: false,
      };

      setIsRunning(true);
    },
    [userId, generateCrashMultiplier]
  );

  // Countdown ticker between flights; auto-launches queued stake when countdown hits 0
  useEffect(() => {
    if (countdown <= 0 || isRunning) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(0);
        if (queuedForNextFlight && queuedStakeRef.current > 0) {
          launchFlightWithStake(queuedStakeRef.current);
        }
      } else {
        setCountdown((prev) => prev - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isRunning, queuedForNextFlight, launchFlightWithStake]);

  const handlePrimaryAction = () => {
    const stake = Number(wagerAmount) || 0;
    if (!userId || stake <= 0) {
      setSettlementStatus('Sign in and enter any positive stake amount to participate.');
      return;
    }

    // If a flight is already in progress, queue stake for the next flight
    if (isRunning) {
      queuedStakeRef.current = stake;
      setQueuedForNextFlight((prev) => !prev);
      setSettlementStatus(
        !queuedForNextFlight
          ? `NEXT FLIGHT QUEUED: $${stake.toFixed(2)} armed for next launch.`
          : 'NEXT FLIGHT QUEUE CANCELLED.'
      );
      return;
    }

    // If in countdown window, arm/launch immediately or queue
    if (countdown > 0) {
      queuedStakeRef.current = stake;
      setQueuedForNextFlight(true);
      setSettlementStatus(`ARMED FOR NEXT FLIGHT ($${stake.toFixed(2)}) in ${countdown}s.`);
      return;
    }

    launchFlightWithStake(stake);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const targetAuto = autoLockEnabled ? parsedAutoTarget() : null;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#070c14';
      ctx.fillRect(0, 0, width, height);

      const { isRunning: running, currentMult, crashPoint, cashedOut } = stateRef.current;

      if (running) {
        // Dynamic climb rate that scales cleanly across low and high multipliers
        const climbStep = 0.008 + Math.min(0.45, (currentMult - 1.0) * 0.004);
        const nextMult = Math.min(
          maxTrajectoryCap,
          Number((currentMult + climbStep).toFixed(2))
        );
        stateRef.current.currentMult = nextMult;
        setMultiplier(nextMult);

        if (Math.floor(nextMult * 10) % 5 === 0) {
          sound.playVectorClimb(nextMult);
        }

        // Check flexible user-selected Auto-Lock target
        if (targetAuto && !cashedOut && nextMult >= targetAuto) {
          executeSettlement(targetAuto, `AUTO-LOCK ${targetAuto.toFixed(2)}x`);
          return;
        }

        // Check crash point
        if (nextMult >= crashPoint) {
          stateRef.current.isRunning = false;
          setIsRunning(false);
          setIsCrashed(true);
          sound.playCrash();
          setSettlementStatus(`FLIGHT ENDED AT ${nextMult.toFixed(2)}x — NEXT BOARDING IN ${COUNTDOWN_SECONDS}s`);
          setCountdown(COUNTDOWN_SECONDS);

          const crashY = scaleMultiplierToY(nextMult, height);
          for (let p = 0; p < 36; p++) {
            stateRef.current.particles.push({
              x: width - 16,
              y: crashY,
              vx: (Math.random() - 0.65) * 9,
              vy: (Math.random() - 0.5) * 9,
              life: 1.0,
              color: '#f43f5e',
            });
          }
          return;
        }

        if (Math.random() > 0.35) {
          const currentY = scaleMultiplierToY(nextMult, height);
          stateRef.current.particles.push({
            x: width - 16 - Math.random() * 6,
            y: currentY,
            vx: -Math.random() * 3 - 1,
            vy: (Math.random() - 0.5) * 2,
            life: 1.0,
            color: '#34d399',
          });
        }
      }

      const displayMult = stateRef.current.currentMult;
      const targetY = scaleMultiplierToY(displayMult, height);
      const startY = height - 18;

      const gradient = ctx.createLinearGradient(0, targetY, 0, height);
      gradient.addColorStop(0, isCrashed ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.22)');
      gradient.addColorStop(1, 'rgba(7, 12, 20, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(16, startY);
      ctx.quadraticCurveTo(width * 0.55, startY, width - 16, targetY);
      ctx.lineTo(width - 16, startY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = isCrashed ? '#f43f5e' : '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, startY);
      ctx.quadraticCurveTo(width * 0.55, startY, width - 16, targetY);
      ctx.stroke();

      if (running) {
        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(width - 16, targetY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = stateRef.current.particles.length - 1; i >= 0; i--) {
        const p = stateRef.current.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;

        if (p.life <= 0) {
          stateRef.current.particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      if (running || stateRef.current.particles.length > 0) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isRunning, isCrashed, autoLockEnabled, autoTargetInput, maxTrajectoryCap, executeSettlement]);

  const stakeNum = Number(wagerAmount) || 0;
  const stakeDisplay = stakeNum.toFixed(2);
  const livePayout = (stakeNum * multiplier).toFixed(2);

  return (
    <div className="flex flex-col items-center bg-slate-950 p-5 sm:p-6 rounded-xl border border-slate-800 font-mono shadow-2xl relative overflow-hidden">
      {/* Top Telemetry & Next-Flight Countdown Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-800 mb-4">
        <span>AVIATOR VECTOR</span>
        {countdown > 0 ? (
          <span className="text-amber-400 flex items-center gap-1 font-bold">
            <Clock className="w-3.5 h-3.5" /> NEXT FLIGHT IN {countdown}s
          </span>
        ) : (
          <span>STAKE: ${stakeDisplay}</span>
        )}
      </div>

      {/* Trajectory Canvas */}
      <div className="relative w-full max-w-xl">
        <canvas
          ref={canvasRef}
          width={560}
          height={320}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg"
        />

        <div className="absolute top-4 right-4 flex flex-col items-end">
          <span className="text-xs uppercase text-slate-400 tracking-wider">
            {isRunning ? 'MULTIPLIER' : isCrashed ? 'CRASHED' : 'READY'}
          </span>
          <div
            className={`text-4xl md:text-5xl font-black tracking-tight ${
              isCrashed ? 'text-rose-500' : isRunning ? 'text-emerald-400' : 'text-slate-200'
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          {isRunning && !hasCashedOutThisRound && (
            <span className="text-xs text-emerald-300 mt-0.5">
              LIVE PAYOUT: ${livePayout}
            </span>
          )}
        </div>

        {isCrashed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
            <div className="text-center px-6 py-4 bg-rose-950/90 border border-rose-500/60 rounded text-rose-200">
              <div className="text-2xl font-black tracking-widest text-rose-400 mb-1">CRASHED</div>
              <div className="text-xs">
                Ended at {multiplier.toFixed(2)}x
                {countdown > 0 ? ` • Next launch in ${countdown}s` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flexible Auto-Lock Configuration (Any Target Odds, Persists Across Rounds Until Stopped) */}
      <div className="w-full max-w-xl mt-4 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Auto-Lock Target (Any Odds)
          </div>
          <button
            type="button"
            onClick={() => setAutoLockEnabled((prev) => !prev)}
            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              autoLockEnabled
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {autoLockEnabled ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {autoLockEnabled ? 'AUTO LOCKED (ACTIVE)' : 'AUTO UNLOCKED'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['1.50', '2.50', '3.00', '5.00', '10.00', '50.00'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAutoTargetInput(preset)}
              className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                Number(autoTargetInput) === Number(preset)
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}x
            </button>
          ))}

          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number"
              step="0.05"
              min="1.01"
              max={maxTrajectoryCap}
              value={autoTargetInput}
              onChange={(e) => setAutoTargetInput(e.target.value)}
              aria-label="Custom Auto Cashout Multiplier"
              className="w-28 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <span className="text-xs text-slate-400 font-bold">x</span>
          </div>
        </div>
      </div>

      {/* Primary Flight & Cashout Controls */}
      <div className="flex flex-wrap gap-3 mt-4 w-full max-w-xl justify-center">
        {isRunning && !hasCashedOutThisRound && (
          <button
            type="button"
            onClick={() => executeSettlement(null, 'INSTANT CASHOUT')}
            className="flex-1 min-w-[200px] px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-wider rounded transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            CASHOUT ${livePayout} @ {multiplier.toFixed(2)}x
          </button>
        )}

        <button
          type="button"
          onClick={handlePrimaryAction}
          className={`flex-1 min-w-[200px] px-6 py-3.5 font-extrabold uppercase tracking-wider rounded transition cursor-pointer ${
            isRunning
              ? queuedForNextFlight
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          }`}
        >
          {isRunning
            ? queuedForNextFlight
              ? `QUEUED FOR NEXT ($${stakeDisplay})`
              : `BET NEXT FLIGHT ($${stakeDisplay})`
            : countdown > 0
              ? `BOARD NEXT (${countdown}s) • $${stakeDisplay}`
              : `LAUNCH FLIGHT ($${stakeDisplay})`}
        </button>
      </div>

      {settlementStatus && (
        <div
          className={`mt-4 p-3 rounded w-full max-w-xl text-center text-xs sm:text-sm font-semibold border ${
            isCrashed || settlementStatus.startsWith('REJECTED') || settlementStatus.startsWith('NETWORK')
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div>{settlementStatus}</div>
          {settledData && (
            <div className="text-xs text-slate-400 mt-1 flex justify-center gap-3">
              <span>REF: {String(settledData.id).slice(0, 13)}</span>
              <span>{new Date(settledData.created_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Mature Discretionary Policy Note */}
      <div className="mt-5 pt-3 border-t border-slate-900 w-full max-w-xl text-[11px] text-slate-500 leading-relaxed">
        Discretionary Monthly Allocation Policy: Any monthly reward grant is discretionary, subject to ledger standing, anti-abuse verification, and scheduled cycle review rather than an automatic guarantee.
      </div>
    </div>
  );
}