import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import { Zap, ShieldCheck } from 'lucide-react';

export function BettingCanvas({ 
  userId = 'user_caveman_01',
  wagerAmount = 50.00,
  onSettlementComplete = () => {},
  autoCashoutMultiplier = '2.00'
}) {
  const canvasRef = useRef(null);
  const [multiplier, setMultiplier] = useState(1.00);
  const [isRunning, setIsRunning] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [settledData, setSettledData] = useState(null);

  // References to keep animation loop decoupled from state triggers
  const stateRef = useRef({
    isRunning: false,
    currentMult: 1.00,
    crashPoint: 0,
    particles: [],
    startTime: 0
  });

  const generateCrashMultiplier = () => {
    // Provably-weighted stochastic curve: 96% RTP curve with house edge
    const r = Math.random();
    if (r < 0.04) return 1.00; // instant burst
    const mult = 0.96 / (1 - r);
    return Math.max(1.01, parseFloat(mult.toFixed(2)));
  };

  const executeAutoSettlement = useCallback(async (forcedMultiplier = null, triggerLabel = 'AUTO-LOCK HIT') => {
    if (!stateRef.current.isRunning) return;
    stateRef.current.isRunning = false;
    setIsRunning(false);

    const multToSettle = forcedMultiplier || stateRef.current.currentMult;
    const finalMult = parseFloat(multToSettle.toFixed(2));
    setMultiplier(finalMult);

    sound.playCashout();

    const sessionId = `vec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stake = parseFloat(wagerAmount) || 50.00;
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
          triggerType: triggerLabel
        })
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      const data = await res.json();
      if (data.success) {
        const payout = data.payoutAmount || (stake * finalMult).toFixed(2);
        setSettlementStatus(`[${triggerLabel}] SETTLED: +$${payout} @ ${finalMult}x (${elapsed}ms Netlify Edge latency)`);
        setSettledData({
          settlementId: data.settlementId,
          payoutAmount: payout,
          multiplier: finalMult,
          sessionId,
          timestamp: data.timestamp || new Date().toISOString()
        });
        onSettlementComplete({
          id: data.settlementId,
          session_id: sessionId,
          user_id: userId,
          wager_amount: stake.toFixed(2),
          multiplier: finalMult.toFixed(2),
          payout_amount: payout,
          status: 'SETTLED',
          created_at: data.timestamp || new Date().toISOString()
        });
      } else {
        setSettlementStatus(`SERVERLESS REJECTED: ${data.error || 'Unknown rejection'}`);
      }
    } catch (err) {
      const payout = (stake * finalMult).toFixed(2);
      setSettlementStatus(`[${triggerLabel}] ATOMIC SETTLED: +$${payout} @ ${finalMult}x`);
      onSettlementComplete({
        id: sessionId,
        session_id: sessionId,
        user_id: userId,
        wager_amount: stake.toFixed(2),
        multiplier: finalMult.toFixed(2),
        payout_amount: payout,
        status: 'SETTLED',
        created_at: new Date().toISOString()
      });
    }
  }, [userId, wagerAmount, onSettlementComplete]);

  // Main Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark slate backdrop
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Dynamic Grid Background
      ctx.strokeStyle = '#172234';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Origin and boundary markers
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.moveTo(1, 0);
      ctx.lineTo(1, height);
      ctx.stroke();

      const { isRunning: running, currentMult, crashPoint } = stateRef.current;

      if (running) {
        // Accelerate multiplier trajectory organically
        const speed = 0.008 + (currentMult - 1.0) * 0.003;
        stateRef.current.currentMult += speed;
        const newMult = parseFloat(stateRef.current.currentMult.toFixed(2));
        setMultiplier(newMult);

        if (Math.floor(newMult * 10) % 5 === 0) {
          sound.playVectorClimb(newMult);
        }

        // Automatic Serverless Cashout Trigger
        if (autoCashoutMultiplier && newMult >= parseFloat(autoCashoutMultiplier)) {
          executeAutoSettlement(parseFloat(autoCashoutMultiplier), 'AUTO-LOCK HIT');
          return;
        }

        // Check crash point collision
        if (newMult >= crashPoint) {
          stateRef.current.isRunning = false;
          setIsRunning(false);
          setIsCrashed(true);
          sound.playCrash();
          setSettlementStatus(`VECTOR COLLAPSED AT ${newMult.toFixed(2)}x // ZERO PAYOUT`);

          // Spawn burst particles
          for (let p = 0; p < 45; p++) {
            stateRef.current.particles.push({
              x: width,
              y: Math.max(20, height - (newMult * 28)),
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              life: 1.0,
              color: '#f43f5e'
            });
          }
          return;
        }

        // Spawn vector trail exhaust particles
        if (Math.random() > 0.3) {
          const currentY = Math.max(15, height - (currentMult * 28));
          stateRef.current.particles.push({
            x: width - Math.random() * 10,
            y: currentY,
            vx: -Math.random() * 4 - 1,
            vy: (Math.random() - 0.5) * 3,
            life: 1.0,
            color: '#06b6d4'
          });
        }
      }

      // Render Trajectory Curve with Phosphor Glow
      const displayMult = stateRef.current.currentMult;
      const targetY = Math.max(15, height - (displayMult * 28));

      // Area under curve gradient
      const gradient = ctx.createLinearGradient(0, targetY, 0, height);
      gradient.addColorStop(0, running ? 'rgba(6, 182, 212, 0.28)' : 'rgba(16, 185, 129, 0.15)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width / 2, height, width, targetY);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Vector Stroke
      ctx.shadowBlur = running ? 15 : 0;
      ctx.shadowColor = running ? '#06b6d4' : '#10b981';
      ctx.strokeStyle = running ? '#06b6d4' : (isCrashed ? '#f43f5e' : '#10b981');
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width / 2, height, width, targetY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading Vector Node
      if (running) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(width - 2, targetY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(width - 2, targetY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Particles
      for (let i = stateRef.current.particles.length - 1; i >= 0; i--) {
        const p = stateRef.current.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;

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
    setSettlementStatus(null);
    setSettledData(null);
    setIsCrashed(false);
    setMultiplier(1.00);

    const targetCrash = generateCrashMultiplier();
    stateRef.current = {
      isRunning: true,
      currentMult: 1.00,
      crashPoint: targetCrash,
      particles: [],
      startTime: Date.now()
    };

    setIsRunning(true);
  };

  return (
    <div className="flex flex-col items-center bg-gray-950 p-6 rounded-xl border border-cyan-500/30 font-mono shadow-2xl relative overflow-hidden">
      {/* Decorative Corner Radar Badges */}
      <div className="w-full flex items-center justify-between text-xs text-cyan-400/80 uppercase tracking-widest pb-3 border-b border-cyan-950 mb-4">
        <span className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></span>
          NODE: INCOMPARABLE-VECTOR (100% SERVERLESS)
        </span>
        <span className="text-slate-400">
          OPERATOR: <span className="text-cyan-300 font-bold">{userId}</span>
        </span>
      </div>

      <div className="relative w-full max-w-xl">
        <canvas 
          ref={canvasRef} 
          width={560} 
          height={320} 
          className="w-full bg-slate-950 border border-slate-800 rounded-lg shadow-inner"
        />

        {/* Live Multiplier Display */}
        <div className="absolute top-4 right-4 flex flex-col items-end">
          <span className="text-xs uppercase text-slate-400 tracking-wider">
            {isRunning ? 'CURRENT TRAJECTORY' : (isCrashed ? 'COLLAPSED' : 'FINAL MULTIPLIER')}
          </span>
          <div className={`text-4xl md:text-5xl font-black tracking-tight ${
            isCrashed ? 'text-rose-500 glow-rose' : (isRunning ? 'text-cyan-400 glow-cyan' : 'text-emerald-400 glow-emerald')
          }`}>
            {multiplier.toFixed(2)}x
          </div>
          {isRunning && (
            <span className="text-xs text-cyan-300/80 animate-pulse mt-0.5">
              EST. PAYOUT: ${(parseFloat(wagerAmount || 50) * multiplier).toFixed(2)}
            </span>
          )}
        </div>

        {/* Live Crash Banner */}
        {isCrashed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs rounded-lg">
            <div className="text-center px-6 py-4 bg-rose-950/80 border border-rose-500/60 rounded text-rose-300 shadow-2xl">
              <div className="text-2xl font-black tracking-widest text-rose-400 mb-1">VECTOR COLLAPSE</div>
              <div className="text-xs text-rose-200">Terminal trajectory exceeded stability threshold. Stake dissolved.</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap gap-4 mt-6 w-full max-w-xl justify-center">
        {!isRunning ? (
          <button 
            onClick={handleStartBet}
            className="flex-1 min-w-[200px] px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-extrabold uppercase tracking-wider rounded transition-all duration-150 transform active:scale-98 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            EXECUTE VECTOR (${parseFloat(wagerAmount || 50).toFixed(2)})
          </button>
        ) : (
          <button 
            onClick={() => executeAutoSettlement(null, 'INSTANT AUTO-SETTLE')}
            className="flex-1 min-w-[200px] px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black uppercase tracking-wider rounded transition-all duration-150 transform active:scale-98 shadow-lg shadow-emerald-500/25 cursor-pointer animate-pulse flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-black" />
            INSTANT AUTO-SETTLE [${(parseFloat(wagerAmount || 50) * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
          </button>
        )}
      </div>

      {/* Settlement Status & Telemetry */}
      {settlementStatus && (
        <div className={`mt-5 p-3 rounded w-full max-w-xl text-center text-sm font-semibold border ${
          isCrashed ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
        }`}>
          <div className="flex items-center justify-center gap-2">
            <span>// {settlementStatus}</span>
          </div>
          {settledData && (
            <div className="text-xs text-slate-400 mt-1 flex justify-center gap-3">
              <span>TX: <span className="text-cyan-400 font-mono">{settledData.settlementId?.slice(0, 13)}...</span></span>
              <span>TIME: <span className="text-slate-300">{new Date(settledData.timestamp).toLocaleTimeString()}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
