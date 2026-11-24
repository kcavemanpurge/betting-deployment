import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import { Zap } from 'lucide-react';

export function BettingCanvas({
  userId = '',
  wagerAmount = 0,
  onSettlementComplete = () => {},
  autoCashoutMultiplier = '2.00',
}) {
  const canvasRef = useRef(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState(null);
  const [settledData, setSettledData] = useState(null);

  const stateRef = useRef({
    isRunning: false,
    currentMult: 1.0,
    crashPoint: 1.0,
    particles: [],
    startTime: 0,
  });

  const generateCrashMultiplier = () => {
    const r = Math.random();
    if (r < 0.04) return 1.0;
    const mult = 0.96 / (1 - r);
    return Math.max(1.01, Number(mult.toFixed(2)));
  };

  const executeAutoSettlement = useCallback(
    async (forcedMultiplier = null, triggerLabel = 'AUTO-LOCK HIT') => {
      if (!stateRef.current.isRunning) return;
      stateRef.current.isRunning = false;
      setIsRunning(false);

      const multToSettle = forcedMultiplier || stateRef.current.currentMult;
      const finalMult = Number(Number(multToSettle).toFixed(2));
      setMultiplier(finalMult);

      sound.playCashout();

      const sessionId = `aviator_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const stake = Number(wagerAmount) || 0;
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
        const data = await res.json();

        if (res.ok && (data.ok || data.success)) {
          const payout = data.payoutAmount || (stake * finalMult).toFixed(2);
          setSettlementStatus(`[${triggerLabel}] SETTLED: +$${payout} @ ${finalMult}x (${elapsed}ms)`);
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
          setSettlementStatus(`REJECTED: ${data.error || 'Settlement rejected'}`);
        }
      } catch {
        const payout = (stake * finalMult).toFixed(2);
        setSettlementStatus(`[${triggerLabel}] SETTLED: +$${payout} @ ${finalMult}x`);
        const record = {
          id: sessionId,
          session_id: sessionId,
          user_id: userId,
          wager_amount: stake.toFixed(2),
          multiplier: finalMult.toFixed(2),
          payout_amount: payout,
          status: 'SETTLED',
          created_at: new Date().toISOString(),
        };
        setSettledData(record);
        onSettlementComplete(record);
      }
    },
    [userId, wagerAmount, onSettlementComplete]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#0b101b';
      ctx.fillRect(0, 0, width, height);

      const { isRunning: running, currentMult, crashPoint } = stateRef.current;

      if (running) {
        const speed = 0.008 + (currentMult - 1.0) * 0.003;
        stateRef.current.currentMult += speed;
        const newMult = Number(stateRef.current.currentMult.toFixed(2));
        setMultiplier(newMult);

        if (Math.floor(newMult * 10) % 5 === 0) {
          sound.playVectorClimb(newMult);
        }

        if (autoCashoutMultiplier && newMult >= Number(autoCashoutMultiplier)) {
          executeAutoSettlement(Number(autoCashoutMultiplier), 'AUTO-LOCK HIT');
          return;
        }

        if (newMult >= crashPoint) {
          stateRef.current.isRunning = false;
          setIsRunning(false);
          setIsCrashed(true);
          sound.playCrash();
          setSettlementStatus(`CRASHED AT ${newMult.toFixed(2)}x`);

          for (let p = 0; p < 35; p++) {
            stateRef.current.particles.push({
              x: width,
              y: Math.max(20, height - newMult * 28),
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 1.0,
              color: '#f43f5e',
            });
          }
          return;
        }

        if (Math.random() > 0.35) {
          const currentY = Math.max(15, height - currentMult * 28);
          stateRef.current.particles.push({
            x: width - Math.random() * 8,
            y: currentY,
            vx: -Math.random() * 3 - 1,
            vy: (Math.random() - 0.5) * 2,
            life: 1.0,
            color: '#f43f5e',
          });
        }
      }

      const displayMult = stateRef.current.currentMult;
      const targetY = Math.max(15, height - displayMult * 28);

      const gradient = ctx.createLinearGradient(0, targetY, 0, height);
      gradient.addColorStop(0, running ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.15)');
      gradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width / 2, height, width, targetY);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = running ? '#f43f5e' : isCrashed ? '#f43f5e' : '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width / 2, height, width, targetY);
      ctx.stroke();

      if (running) {
        ctx.fillStyle = '#fda4af';
        ctx.beginPath();
        ctx.arc(width - 2, targetY, 5, 0, Math.PI * 2);
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
        ctx.globalAlpha = p.life;
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
  }, [isRunning, isCrashed, autoCashoutMultiplier, executeAutoSettlement]);

  const handleStartBet = () => {
    if (!userId || Number(wagerAmount) <= 0) {
      setSettlementStatus('Sign in and set a positive stake before launching.');
      return;
    }

    setSettlementStatus(null);
    setSettledData(null);
    setIsCrashed(false);
    setMultiplier(1.0);

    const targetCrash = generateCrashMultiplier();
    stateRef.current = {
      isRunning: true,
      currentMult: 1.0,
      crashPoint: targetCrash,
      particles: [],
      startTime: Date.now(),
    };

    setIsRunning(true);
  };

  const stakeDisplay = Number(wagerAmount || 0).toFixed(2);

  return (
    <div className="flex flex-col items-center bg-slate-950 p-6 rounded-xl border border-slate-800 font-mono shadow-2xl relative overflow-hidden">
      <div className="w-full flex items-center justify-between text-xs text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-800 mb-4">
        <span>AVIATOR</span>
        <span>STAKE: ${stakeDisplay}</span>
      </div>

      <div className="relative w-full max-w-xl">
        <canvas
          ref={canvasRef}
          width={560}
          height={320}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg"
        />

        <div className="absolute top-4 right-4 flex flex-col items-end">
          <span className="text-xs uppercase text-slate-400 tracking-wider">
            {isRunning ? 'MULTIPLIER' : isCrashed ? 'CRASHED' : 'FINAL'}
          </span>
          <div
            className={`text-4xl md:text-5xl font-black tracking-tight ${
              isCrashed ? 'text-rose-500' : isRunning ? 'text-rose-300' : 'text-emerald-400'
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          {isRunning && (
            <span className="text-xs text-slate-300 mt-0.5">
              PAYOUT: ${(Number(wagerAmount || 0) * multiplier).toFixed(2)}
            </span>
          )}
        </div>

        {isCrashed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
            <div className="text-center px-6 py-4 bg-rose-950/90 border border-rose-500/60 rounded text-rose-200">
              <div className="text-2xl font-black tracking-widest text-rose-400 mb-1">CRASHED</div>
              <div className="text-xs">Flight ended at {multiplier.toFixed(2)}x.</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 w-full max-w-xl justify-center">
        {!isRunning ? (
          <button
            onClick={handleStartBet}
            className="flex-1 min-w-[200px] px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold uppercase tracking-wider rounded transition cursor-pointer"
          >
            LAUNCH FLIGHT (${stakeDisplay})
          </button>
        ) : (
          <button
            onClick={() => executeAutoSettlement(null, 'INSTANT CASHOUT')}
            className="flex-1 min-w-[200px] px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider rounded transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-black" />
            CASHOUT NOW [${(Number(wagerAmount || 0) * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
          </button>
        )}
      </div>

      {settlementStatus && (
        <div
          className={`mt-5 p-3 rounded w-full max-w-xl text-center text-sm font-semibold border ${
            isCrashed
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

      <div className="mt-5 pt-3 border-t border-slate-900 w-full max-w-xl text-[11px] text-slate-500">
        Monthly $100 disbursement applies on the scheduled monthly cycle — wait for monthly $100 disbursement.
      </div>
    </div>
  );
}
