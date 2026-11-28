import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sound } from '../utils/audio.js';
import {
  Zap,
  Lock,
  Unlock,
  Clock,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';

const MAX_DESTINATION_MULTIPLIER = 10000.0;
const COUNTDOWN_SECONDS = 5;
const EPHEMERAL_CHAT_PREFIX = 'sovereign_canvas_ephemeral_chat::';

function getChatKey(userId) {
  const clean = (userId || '').trim();
  return clean ? `${EPHEMERAL_CHAT_PREFIX}${clean}` : null;
}

function scaleMultiplierToY(mult, height) {
  const safeMult = Math.max(1, Number(mult) || 1);
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

  // Flexible user-controlled Auto-Lock state
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoTargetInput, setAutoTargetInput] = useState(
    autoCashoutMultiplier ? String(autoCashoutMultiplier) : '3.00'
  );

  // Ephemeral user-scoped session chat (empty when no user; deleted on exit)
  const cleanUserId = (userId || '').trim();
  const hasActiveUser = Boolean(cleanUserId);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

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

  // Only allow session chat history when a userId exists; never store history without a user
  useEffect(() => {
    const key = getChatKey(cleanUserId);
    if (!key) {
      setChatMessages([]);
      return;
    }
    try {
      const raw = sessionStorage.getItem(key);
      setChatMessages(raw ? JSON.parse(raw) : []);
    } catch {
      setChatMessages([]);
    }
  }, [cleanUserId]);

  useEffect(() => {
    const key = getChatKey(cleanUserId);
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(chatMessages));
    } catch {
      // Ignore storage errors
    }
  }, [cleanUserId, chatMessages]);

  const wipeSessionChat = useCallback(() => {
    const key = getChatKey(cleanUserId);
    setChatMessages([]);
    if (key) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    }
  }, [cleanUserId]);

  // Delete session chat history on user exit / unmount / page close
  useEffect(() => {
    const key = getChatKey(cleanUserId);
    if (!key) return;

    const handleExit = () => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
    return () => {
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
      handleExit();
    };
  }, [cleanUserId]);

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!hasActiveUser) return;
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: cleanUserId,
        avatarCode: cleanUserId.slice(0, 2).toUpperCase(),
        text,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  const parsedAutoTarget = () => {
    const val = Number(autoTargetInput);
    if (!Number.isFinite(val) || val < 1.01) return null;
    return Math.min(maxTrajectoryCap, Number(val.toFixed(2)));
  };

  const generateCrashMultiplier = useCallback(() => {
    const r = Math.random();
    if (r < 0.03) return 1.0;

    const tailRoll = Math.random();
    let rawMult;
    if (tailRoll > 0.996) {
      const deepRatio = Math.random() ** 2.4;
      rawMult = 50 + deepRatio * (maxTrajectoryCap - 50);
    } else if (tailRoll > 0.94) {
      rawMult = 10 + (Math.random() ** 1.8) * 240;
    } else {
      rawMult = 0.96 / Math.max(0.001, 1 - r * 0.92);
    }

    return Math.min(maxTrajectoryCap, Math.max(1.01, Number(rawMult.toFixed(2))));
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
            userId: cleanUserId,
            wagerAmount: stake,
            multiplier: finalMult,
            triggerType: triggerLabel,
          }),
        });

        const elapsed = Math.round(performance.now() - startTime);
        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.ok || data.success)) {
          const payout = Number(data.payoutAmount ?? stake * finalMult).toFixed(2);
          setSettlementStatus(
            `[${triggerLabel}] SETTLED: +$${payout} @ ${finalMult.toFixed(2)}x (${elapsed}ms)`
          );
          const record = {
            id: data.settlementId || sessionId,
            session_id: sessionId,
            user_id: cleanUserId,
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
    [cleanUserId, wagerAmount, maxTrajectoryCap, onSettlementComplete]
  );

  const launchFlightWithStake = useCallback(
    (stakeToUse) => {
      const cleanStake = Number(stakeToUse) || 0;
      if (!cleanUserId || cleanStake <= 0) {
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
    [cleanUserId, generateCrashMultiplier]
  );

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
    if (!cleanUserId || stake <= 0) {
      setSettlementStatus('Sign in and enter any positive stake amount to participate.');
      return;
    }

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

      // Sovereign dark ground
      ctx.fillStyle = '#070c09';
      ctx.fillRect(0, 0, width, height);

      // Subtle Sovereign coordinate plane
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 48; gx < width - 16; gx += 64) {
        ctx.beginPath();
        ctx.moveTo(gx, 12);
        ctx.lineTo(gx, height - 12);
        ctx.stroke();
      }
      for (let gy = 32; gy < height - 12; gy += 44) {
        ctx.beginPath();
        ctx.moveTo(16, gy);
        ctx.lineTo(width - 16, gy);
        ctx.stroke();
      }

      const { isRunning: running, currentMult, crashPoint, cashedOut } = stateRef.current;

      if (running) {
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

        if (targetAuto && !cashedOut && nextMult >= targetAuto) {
          executeSettlement(targetAuto, `AUTO-LOCK ${targetAuto.toFixed(2)}x`);
          return;
        }

        if (nextMult >= crashPoint) {
          stateRef.current.isRunning = false;
          setIsRunning(false);
          setIsCrashed(true);
          sound.playCrash();
          setSettlementStatus(
            `FLIGHT ENDED AT ${nextMult.toFixed(2)}x — NEXT BOARDING IN ${COUNTDOWN_SECONDS}s`
          );
          setCountdown(COUNTDOWN_SECONDS);

          const crashY = scaleMultiplierToY(nextMult, height);
          for (let p = 0; p < 36; p++) {
            stateRef.current.particles.push({
              x: width - 16,
              y: crashY,
              vx: (Math.random() - 0.65) * 9,
              vy: (Math.random() - 0.5) * 9,
              life: 1.0,
              color: '#f87171',
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
            color: '#bef264',
          });
        }
      }

      const displayMult = stateRef.current.currentMult;
      const targetY = scaleMultiplierToY(displayMult, height);
      const startX = 16;
      const endX = width - 16;
      const startY = height - 18;

      const strokeColor = isCrashed
        ? '#f87171'
        : hasCashedOutThisRound
          ? '#34d399'
          : '#bef264';

      const fillTop = isCrashed
        ? 'rgba(248, 113, 113, 0.22)'
        : hasCashedOutThisRound
          ? 'rgba(52, 211, 153, 0.22)'
          : 'rgba(163, 230, 53, 0.22)';

      const gradient = ctx.createLinearGradient(0, targetY, 0, height);
      gradient.addColorStop(0, fillTop);
      gradient.addColorStop(1, 'rgba(7, 12, 9, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(width * 0.55, startY, endX, targetY);
      ctx.lineTo(endX, startY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(width * 0.55, startY, endX, targetY);
      ctx.stroke();

      // Aim reticle + plane nose at the active aim spot
      if (running || (!isCrashed && displayMult > 1)) {
        const pitchAngle = Math.atan2(targetY - startY, endX - startX) * 0.65;
        ctx.save();
        ctx.translate(endX, targetY);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-17, 0);
        ctx.lineTo(-8, 0);
        ctx.moveTo(8, 0);
        ctx.lineTo(17, 0);
        ctx.moveTo(0, -17);
        ctx.lineTo(0, -8);
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 17);
        ctx.stroke();

        ctx.rotate(pitchAngle);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -5.5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, 5.5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
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
  }, [
    isRunning,
    isCrashed,
    hasCashedOutThisRound,
    autoLockEnabled,
    autoTargetInput,
    maxTrajectoryCap,
    executeSettlement,
  ]);

  const stakeNum = Number(wagerAmount) || 0;
  const stakeDisplay = stakeNum.toFixed(2);
  const livePayout = (stakeNum * multiplier).toFixed(2);

  return (
    <div className="flex flex-col items-center bg-[#070c09] p-5 sm:p-6 rounded-xl border border-lime-500/25 font-mono shadow-2xl relative overflow-hidden">
      {/* Top Telemetry & Session Chat Toggle */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-lime-200/70 uppercase tracking-widest pb-3 border-b border-lime-500/15 mb-4">
        <span>SOVEREIGN VECTOR</span>
        <div className="flex items-center gap-3">
          {countdown > 0 ? (
            <span className="text-amber-400 flex items-center gap-1 font-bold">
              <Clock className="w-3.5 h-3.5" /> NEXT FLIGHT IN {countdown}s
            </span>
          ) : (
            <span>STAKE: ${stakeDisplay}</span>
          )}
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="px-2.5 py-1 rounded bg-[#0d1711] hover:bg-[#14231a] text-lime-300 border border-lime-500/30 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>CHAT ({hasActiveUser ? chatMessages.length : 0})</span>
          </button>
        </div>
      </div>

      {/* Ephemeral Avatar Session Chat (Zero history without user; wiped on exit) */}
      {chatOpen && (
        <div className="w-full max-w-xl mb-4 p-3.5 rounded-lg bg-[#0b130e] border border-lime-500/25 space-y-3">
          <div className="flex items-center justify-between border-b border-lime-500/15 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-lime-300">
              <span className="w-6 h-6 rounded-full bg-lime-400 text-[#070c09] flex items-center justify-center font-black text-[11px]">
                {hasActiveUser ? cleanUserId.slice(0, 2).toUpperCase() : '--'}
              </span>
              <span>
                {hasActiveUser
                  ? `AVATAR SESSION: ${cleanUserId}`
                  : 'NO USER — CHAT HISTORY DISABLED'}
              </span>
            </div>
            {hasActiveUser && chatMessages.length > 0 && (
              <button
                type="button"
                onClick={wipeSessionChat}
                className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Clear Session
              </button>
            )}
          </div>

          {!hasActiveUser ? (
            <div className="text-xs text-lime-200/50 py-3 text-center">
              Set an active user ID to join the live avatar conversation. Without a user, no history is kept.
            </div>
          ) : (
            <>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-lime-200/45 py-2 text-center">
                    Active session only. Messages delete automatically when you exit the terminal.
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2 rounded bg-[#070c09] border border-lime-500/15 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="text-lime-400 font-bold mr-1.5">[{msg.avatarCode}]</span>
                        <span className="text-white">{msg.text}</span>
                      </div>
                      <span className="text-[10px] text-lime-200/40 shrink-0">{msg.ts}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendChatMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Speak as current avatar..."
                  className="flex-1 bg-[#070c09] border border-lime-500/25 rounded px-3 py-1.5 text-xs text-white focus:border-lime-400 outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-lime-400 hover:bg-lime-300 text-[#070c09] font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Trajectory Canvas */}
      <div className="relative w-full max-w-xl">
        <canvas
          ref={canvasRef}
          width={560}
          height={320}
          className="w-full bg-[#070c09] border border-lime-500/25 rounded-lg"
        />

        <div className="absolute top-4 right-4 flex flex-col items-end">
          <span className="text-xs uppercase text-lime-200/60 tracking-wider">
            {isRunning ? 'MULTIPLIER' : isCrashed ? 'CRASHED' : 'READY'}
          </span>
          <div
            className={`text-4xl md:text-5xl font-black tracking-tight ${
              isCrashed ? 'text-rose-400' : isRunning ? 'text-lime-300' : 'text-white'
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          {isRunning && !hasCashedOutThisRound && (
            <span className="text-xs text-emerald-400 mt-0.5">
              LIVE PAYOUT: ${livePayout}
            </span>
          )}
        </div>

        {isCrashed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65 rounded-lg">
            <div className="text-center px-6 py-4 bg-[#190c0e]/95 border border-rose-500/60 rounded text-rose-200">
              <div className="text-2xl font-black tracking-widest text-rose-400 mb-1">CRASHED</div>
              <div className="text-xs">
                Ended at {multiplier.toFixed(2)}x
                {countdown > 0 ? ` • Next launch in ${countdown}s` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flexible Auto-Lock Configuration */}
      <div className="w-full max-w-xl mt-4 p-3.5 rounded-lg bg-[#0b130e] border border-lime-500/20 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-lime-200 uppercase tracking-wider">
            Auto-Lock Target (Any Odds)
          </div>
          <button
            type="button"
            onClick={() => setAutoLockEnabled((prev) => !prev)}
            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              autoLockEnabled
                ? 'bg-lime-400 text-[#070c09] hover:bg-lime-300'
                : 'bg-[#132018] text-lime-200/80 hover:text-white border border-lime-500/25'
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
                  ? 'bg-lime-400/20 border-lime-400 text-lime-300'
                  : 'bg-[#070c09] border-lime-500/15 text-lime-200/60 hover:text-white'
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
              className="w-28 bg-[#070c09] border border-lime-500/25 rounded px-2.5 py-1 text-xs font-bold text-lime-300 focus:outline-none focus:border-lime-400"
            />
            <span className="text-xs text-lime-200/60 font-bold">x</span>
          </div>
        </div>
      </div>

      {/* Primary Flight & Cashout Controls */}
      <div className="flex flex-wrap gap-3 mt-4 w-full max-w-xl justify-center">
        {isRunning && !hasCashedOutThisRound && (
          <button
            type="button"
            onClick={() => executeSettlement(null, 'INSTANT CASHOUT')}
            className="flex-1 min-w-[200px] px-6 py-3.5 bg-lime-400 hover:bg-lime-300 text-[#070c09] font-black uppercase tracking-wider rounded transition cursor-pointer flex items-center justify-center gap-2"
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
                ? 'bg-amber-400 hover:bg-amber-300 text-[#070c09]'
                : 'bg-[#132018] hover:bg-[#1a2c21] text-amber-300 border border-amber-400/40'
              : 'bg-emerald-500 hover:bg-emerald-400 text-[#070c09]'
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
            <div className="text-xs text-lime-200/60 mt-1 flex justify-center gap-3">
              <span>REF: {String(settledData.id).slice(0, 13)}</span>
              <span>{new Date(settledData.created_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Mature Discretionary Policy Note */}
      <div className="mt-5 pt-3 border-t border-lime-500/10 w-full max-w-xl text-[11px] text-lime-200/50 leading-relaxed">
        Discretionary Monthly Allocation Policy: Any monthly reward grant is discretionary, subject to ledger standing, anti-abuse verification, and scheduled cycle review rather than an automatic guarantee.
      </div>
    </div>
  );
}