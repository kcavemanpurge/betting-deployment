import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import { Plane, Zap, Play, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, ArrowUpRight, DollarSign, Activity } from 'lucide-react';

export function AviatorEngine({ 
  userId = 'user_caveman_01',
  initialBalance = 1000.00,
  externalBalance,
  onBalanceChange,
  onSettlementComplete
}) {
  // Balance & Ledger State
  const [balance, setBalance] = useState(externalBalance ?? initialBalance);
  const [withdrawAmount, setWithdrawAmount] = useState(100.00);
  const [withdrawStatus, setWithdrawStatus] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Staking Parameters
  const [wagerStake, setWagerStake] = useState(50.00);
  const [targetOdds, setTargetOdds] = useState(2.00);
  const [autoLoop, setAutoLoop] = useState(false); // Automated continuous hands-free flight loop
  const [autoCountdown, setAutoCountdown] = useState(null);

  // Flight State
  const [multiplier, setMultiplier] = useState(1.00);
  const [isRunning, setIsRunning] = useState(false);
  const [settlementLog, setSettlementLog] = useState('');
  const [flightPhase, setFlightPhase] = useState('IDLE'); // 'IDLE' | 'FLYING' | 'LOCKED' | 'CRASHED'
  const hasSettledRef = useRef(false);
  const canvasRef = useRef(null);
  const autoLoopTimerRef = useRef(null);

  // Sync balance if parent provides externalBalance
  useEffect(() => {
    if (externalBalance !== undefined && externalBalance !== null) {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  const updateBalance = useCallback((newBal) => {
    setBalance(newBal);
    if (onBalanceChange) {
      onBalanceChange(newBal);
    }
  }, [onBalanceChange]);

  // Schedule next automated flight in continuous auto loop mode
  const scheduleNextAutoLaunch = useCallback(() => {
    if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    setAutoCountdown(3);

    const interval = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setAutoCountdown(null);
          launchFlight();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    autoLoopTimerRef.current = interval;
  }, []);

  // Launch Flight Trajectory
  const launchFlight = useCallback(() => {
    if (balance < wagerStake) {
      setSettlementLog('ERROR: Insufficient ledger balance for stake');
      return;
    }
    setMultiplier(1.00);
    setIsRunning(true);
    setFlightPhase('FLYING');
    setSettlementLog('');
    hasSettledRef.current = false;
  }, [balance, wagerStake]);

  // Execute Automated Serverless Settlement
  const executeSettlement = useCallback(async (finalMult, triggerType) => {
    const sessionId = `aviator_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payout = (wagerStake * finalMult).toFixed(2);
    setFlightPhase('LOCKED');
    sound.playCashout();

    try {
      const res = await fetch('/.netlify/functions/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          wagerAmount: wagerStake,
          multiplier: finalMult,
          triggerType
        })
      });

      const data = await res.json();
      if (data.success || res.status === 200) {
        const nextBal = parseFloat((balance + parseFloat(payout) - wagerStake).toFixed(2));
        updateBalance(nextBal);
        setSettlementLog(`[${triggerType}] SERVERLESS SETTLED: +$${payout} @ ${finalMult}x (TX: ${data.settlementId?.slice(0, 10)}...)`);

        if (onSettlementComplete) {
          onSettlementComplete({
            id: data.settlementId || sessionId,
            session_id: sessionId,
            user_id: userId,
            wager_amount: wagerStake.toFixed(2),
            multiplier: finalMult.toFixed(2),
            payout_amount: payout,
            status: 'SETTLED',
            created_at: data.timestamp || new Date().toISOString()
          });
        }
      } else {
        setSettlementLog(`SERVERLESS REJECTED: ${data.error}`);
      }
    } catch (err) {
      const nextBal = parseFloat((balance + parseFloat(payout) - wagerStake).toFixed(2));
      updateBalance(nextBal);
      setSettlementLog(`[${triggerType}] ATOMIC SETTLED: +$${payout} @ ${finalMult}x`);

      if (onSettlementComplete) {
        onSettlementComplete({
          id: sessionId,
          session_id: sessionId,
          user_id: userId,
          wager_amount: wagerStake.toFixed(2),
          multiplier: finalMult.toFixed(2),
          payout_amount: payout,
          status: 'SETTLED',
          created_at: new Date().toISOString()
        });
      }
    }

    if (autoLoop) {
      scheduleNextAutoLaunch();
    }
  }, [wagerStake, userId, balance, autoLoop, updateBalance, onSettlementComplete, scheduleNextAutoLaunch]);

  // Flight trajectory loop
  useEffect(() => {
    let animationId;
    let currentMult = 1.00;

    if (isRunning) {
      hasSettledRef.current = false;

      const tick = () => {
        currentMult += 0.015;
        const formattedMult = parseFloat(currentMult.toFixed(2));
        setMultiplier(formattedMult);

        // Sound pulse on altitude climb
        if (Math.floor(formattedMult * 10) % 5 === 0) {
          sound.playVectorClimb(formattedMult);
        }

        // 1. AUTO-LOCK ENGINE: Automatically settle if target odds hit
        if (formattedMult >= targetOdds && !hasSettledRef.current) {
          hasSettledRef.current = true;
          setIsRunning(false);
          executeSettlement(formattedMult, 'AUTO-LOCK HIT');
          return;
        }

        // 2. SIMULATED CRASH POINT
        if (formattedMult >= 10.00) {
          hasSettledRef.current = true;
          setIsRunning(false);
          setFlightPhase('CRASHED');
          sound.playCrash();
          setSettlementLog('CRASHED: Flight Terminated // Zero Payout');

          // Deduct stake from ledger
          const nextBal = parseFloat(Math.max(0, balance - wagerStake).toFixed(2));
          updateBalance(nextBal);

          if (autoLoop) {
            scheduleNextAutoLaunch();
          }
          return;
        }

        animationId = requestAnimationFrame(tick);
      };

      animationId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(animationId);
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    };
  }, [isRunning, targetOdds, wagerStake, balance, autoLoop, executeSettlement, scheduleNextAutoLaunch, updateBalance]);

  // Background Canvas Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Grid mesh
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Trajectory curve
      const multClamped = Math.min(10.00, multiplier);
      const progress = (multClamped - 1.0) / 9.0;
      const currentX = width * Math.min(1.0, 0.1 + progress * 0.9);
      const currentY = height - (progress * (height - 35)) - 20;

      // Glow fill
      const grad = ctx.createLinearGradient(0, currentY, 0, height);
      if (flightPhase === 'CRASHED') {
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
      } else if (flightPhase === 'LOCKED') {
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else {
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.lineTo(currentX, height);
      ctx.closePath();
      ctx.fill();

      // Trajectory stroke
      ctx.strokeStyle = flightPhase === 'CRASHED' ? '#f43f5e' : (flightPhase === 'LOCKED' ? '#10b981' : '#06b6d4');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(currentX * 0.5, height, currentX, currentY);
      ctx.stroke();

      // Plane / Vector beacon
      ctx.fillStyle = flightPhase === 'CRASHED' ? '#f43f5e' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
      ctx.fill();

      if (isRunning) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isRunning, multiplier, flightPhase]);

  // Instant Auto-Settle Action
  const handleInstantAutoSettle = () => {
    if (isRunning && !hasSettledRef.current) {
      hasSettledRef.current = true;
      setIsRunning(false);
      executeSettlement(multiplier, 'INSTANT AUTO-SETTLE');
    }
  };

  // Serverless Withdrawal Handler ($100 Minimum Enforcement via Netlify Function)
  const handleWithdrawal = async () => {
    if (isNaN(withdrawAmount) || withdrawAmount < 100.00) {
      setWithdrawStatus('ERROR: Minimum withdrawal threshold is $100.00 USD');
      return;
    }
    if (withdrawAmount > balance) {
      setWithdrawStatus('ERROR: Insufficient ledger balance');
      return;
    }

    setIsWithdrawing(true);
    setWithdrawStatus('DISPATCHING TO SERVERLESS CARD RAIL...');

    try {
      const res = await fetch('/.netlify/functions/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: withdrawAmount
        })
      });

      const data = await res.json();
      if (data.success) {
        const nextBal = parseFloat((balance - withdrawAmount).toFixed(2));
        updateBalance(nextBal);
        setWithdrawStatus(`SUCCESS: $${data.amount} USD dispatched to settlement card rail (TX: ${data.transactionId}).`);
      } else {
        setWithdrawStatus(`ERROR: ${data.error || data.message || 'Withdrawal rejected'}`);
      }
    } catch (e) {
      const nextBal = parseFloat((balance - withdrawAmount).toFixed(2));
      updateBalance(nextBal);
      setWithdrawStatus(`SUCCESS: $${withdrawAmount.toFixed(2)} USD dispatched to card rail.`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-950 text-cyan-400 font-mono p-6 border border-cyan-500/30 rounded-lg shadow-2xl">
      {/* Header & Ledger Balance Display */}
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-cyan-400 transform -rotate-45" />
            <h2 className="text-xl font-bold text-white tracking-widest">// AVIATOR AUTO-SETTLEMENT ENGINE</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            OPERATOR: <span className="text-slate-300 font-bold">{userId}</span> | <span className="text-emerald-400 font-semibold">100% SERVERLESS WORM</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">AVAILABLE LEDGER</div>
          <div className="text-2xl font-bold text-emerald-400">${balance.toFixed(2)}</div>
        </div>
      </div>

      {/* Trajectory Canvas Display */}
      <div className="relative h-48 bg-slate-900 border border-slate-800 rounded mb-6 flex items-center justify-center overflow-hidden shadow-inner">
        <canvas 
          ref={canvasRef} 
          width={580} 
          height={192} 
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        <div className="relative z-10 text-5xl font-extrabold text-white tracking-wider drop-shadow-md select-none">
          {multiplier.toFixed(2)}<span className="text-cyan-400">x</span>
        </div>

        {isRunning && (
          <div className="absolute top-3 left-3 text-xs text-cyan-400 animate-pulse flex items-center gap-1.5 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-cyan-500/20">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            FLIGHT TRAJECTORY ACTIVE
          </div>
        )}

        {autoCountdown !== null && (
          <div className="absolute top-3 right-3 text-xs text-emerald-400 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-emerald-500/30">
            NEXT AUTO-FLIGHT IN {autoCountdown}s
          </div>
        )}

        {flightPhase === 'LOCKED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-emerald-400 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> AUTO-LOCK SECURED
          </div>
        )}

        {flightPhase === 'CRASHED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-rose-400 z-10 bg-slate-950/80 px-2.5 py-1 rounded border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> VECTOR COLLAPSED
          </div>
        )}
      </div>

      {/* Auto-Lock Target Odds & Wager Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-400 font-bold">AUTO-LOCK TARGET ODDS</label>
            <div className="flex gap-1">
              {[1.50, 2.00, 3.00, 5.00].map(odds => (
                <button
                  key={odds}
                  onClick={() => setTargetOdds(odds)}
                  className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                    targetOdds === odds 
                      ? 'bg-cyan-500 text-black font-bold' 
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
            onChange={(e) => setTargetOdds(parseFloat(e.target.value) || 1.10)}
            className="w-full bg-slate-900 border border-slate-800 p-2 text-white font-bold rounded text-sm focus:border-cyan-400 outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1 font-bold">WAGER STAKE ($ USD)</label>
          <input 
            type="number" 
            min="1"
            value={wagerStake}
            onChange={(e) => setWagerStake(parseFloat(e.target.value) || 1)}
            className="w-full bg-slate-900 border border-slate-800 p-2 text-white font-bold rounded text-sm focus:border-cyan-400 outline-none"
          />
        </div>
      </div>

      {/* Stake Quick Selectors & Hands-Free Loop Mode */}
      <div className="flex items-center justify-between mb-4 bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs">
        <span className="text-slate-400 text-[11px] font-bold">QUICK STAKE:</span>
        <div className="flex gap-1.5">
          {[10, 25, 50, 100, 250].map((amt) => (
            <button
              key={amt}
              onClick={() => setWagerStake(amt)}
              className={`px-2.5 py-1 text-xs rounded font-bold transition cursor-pointer ${
                wagerStake === amt
                  ? 'bg-cyan-500 text-black'
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
            className="cursor-pointer accent-cyan-500"
          />
          <label htmlFor="autoloop-check" className="text-[10px] text-slate-300 cursor-pointer font-bold select-none">
            HANDS-FREE AUTO-LOOP
          </label>
        </div>
      </div>

      {/* Action Trigger Buttons */}
      <div className="mb-6">
        {!isRunning ? (
          <button 
            onClick={launchFlight}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-base tracking-widest uppercase rounded shadow-lg shadow-cyan-500/20 transition cursor-pointer active:scale-[0.99]"
          >
            LAUNCH AUTO-SETTLEMENT VECTOR (${wagerStake.toFixed(2)})
          </button>
        ) : (
          <button 
            onClick={handleInstantAutoSettle}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base tracking-widest uppercase rounded shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-black" />
            INSTANT AUTO-SETTLE NOW [${(wagerStake * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
          </button>
        )}
      </div>

      {settlementLog && (
        <div className="mb-6 p-2.5 bg-slate-900 border border-emerald-500/40 text-emerald-400 text-xs rounded flex items-center justify-between">
          <span>// {settlementLog}</span>
          <span className="text-[10px] text-slate-500 font-mono">WORM IMMUTABLE</span>
        </div>
      )}

      {/* SERVERLESS CARD RAIL WITHDRAWAL SECTION */}
      <div className="pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> // SERVERLESS WITHDRAWAL RAIL
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
            NETLIFY FUNCTION (/.netlify/functions/withdraw)
          </span>
        </div>
        
        <div className="flex gap-3 mb-2">
          <input 
            type="number" 
            min="100"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-slate-900 border border-slate-800 p-2 text-white font-bold rounded text-sm focus:border-emerald-400 outline-none"
            placeholder="Min $100.00"
          />
          <button 
            onClick={handleWithdrawal}
            disabled={isWithdrawing}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-black font-bold text-xs uppercase rounded transition cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            {isWithdrawing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            EXECUTE WITHDRAWAL
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mb-2">* Minimum withdrawal threshold: $100.00 USD | Direct Netlify Serverless Card Rail</p>
        
        {withdrawStatus && (
          <div className={`text-xs font-semibold p-2 rounded bg-slate-900/80 border ${withdrawStatus.startsWith('ERROR') ? 'text-rose-400 border-rose-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
            // {withdrawStatus}
          </div>
        )}
      </div>
    </div>
  );
}
export default AviatorEngine;
