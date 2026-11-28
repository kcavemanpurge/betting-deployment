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
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';

const EPHEMERAL_CHAT_PREFIX = 'sovereign_aviator_ephemeral_chat::';

function getChatStorageKey(userId) {
  const clean = (userId || '').trim();
  return clean ? `${EPHEMERAL_CHAT_PREFIX}${clean}` : null;
}

function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.04) return 1.0;
  const val = (100 * 0.96) / (100 * (1 - r));
  return Math.min(25.0, Number(Math.max(1.01, val).toFixed(2)));
}

export function AviatorEngine({
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

  // Ephemeral avatar session chat (no history when no user; deleted on exit)
  const cleanUserId = (userId || '').trim();
  const hasActiveUser = Boolean(cleanUserId);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

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

  // Load session chat only if a userId is present; never keep history without a user
  useEffect(() => {
    const key = getChatStorageKey(cleanUserId);
    if (!key) {
      setChatMessages([]);
      return;
    }
    try {
      const saved = sessionStorage.getItem(key);
      setChatMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setChatMessages([]);
    }
  }, [cleanUserId]);

  useEffect(() => {
    const key = getChatStorageKey(cleanUserId);
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(chatMessages));
    } catch {
      // Ignore storage errors
    }
  }, [cleanUserId, chatMessages]);

  const clearEphemeralSessionChat = useCallback(() => {
    const key = getChatStorageKey(cleanUserId);
    setChatMessages([]);
    if (key) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    }
  }, [cleanUserId]);

  // Wipe chat history when user exits/unmounts or closes the terminal
  useEffect(() => {
    const key = getChatStorageKey(cleanUserId);
    if (!key) return;

    const purgeOnExit = () => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener('pagehide', purgeOnExit);
    window.addEventListener('beforeunload', purgeOnExit);
    return () => {
      window.removeEventListener('pagehide', purgeOnExit);
      window.removeEventListener('beforeunload', purgeOnExit);
      purgeOnExit();
    };
  }, [cleanUserId]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!hasActiveUser) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender: cleanUserId,
        avatarBadge: cleanUserId.slice(0, 2).toUpperCase(),
        text: trimmed,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

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
            userId: cleanUserId,
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
          user_id: cleanUserId,
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
    [wagerStake, cleanUserId, balance, autoLoop, updateBalance, onSettlementComplete, startCalmDownCountdown]
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

  // Sovereign dark/lime/gold vector plane + aim spot rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle Sovereign grid lines
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.07)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < width; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 32; gy < height; gy += 38) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      const multClamped = Math.min(10.0, multiplier);
      const progress = (multClamped - 1.0) / 9.0;
      const currentX = width * Math.min(0.92, 0.1 + progress * 0.82);
      const currentY = height - progress * (height - 42) - 22;

      const strokeColor =
        flightPhase === 'CRASHED'
          ? '#f87171'
          : flightPhase === 'LOCKED'
            ? '#34d399'
            : flightPhase === 'CALM_DOWN'
              ? '#facc15'
              : '#bef264';

      const fillTop =
        flightPhase === 'CRASHED'
          ? 'rgba(248, 113, 113, 0.22)'
          : flightPhase === 'LOCKED'
            ? 'rgba(52, 211, 153, 0.22)'
            : 'rgba(163, 230, 53, 0.22)';

      const grad = ctx.createLinearGradient(0, currentY, 0, height);
      grad.addColorStop(0, fillTop);
      grad.addColorStop(1, 'rgba(7, 12, 9, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(16, height - 14);
      ctx.quadraticCurveTo(currentX * 0.55, height - 14, currentX, currentY);
      ctx.lineTo(currentX, height - 14);
      ctx.closePath();
      ctx.fill();

      // Trajectory curve
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, height - 14);
      ctx.quadraticCurveTo(currentX * 0.55, height - 14, currentX, currentY);
      ctx.stroke();

      // Aim reticle + directional vector nose at tip
      const angle = Math.atan2(currentY - (height - 14), currentX - 16) * 0.65;
      ctx.save();
      ctx.translate(currentX, currentY);

      // Aim ring
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Aim crosshairs
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-7, 0);
      ctx.moveTo(7, 0);
      ctx.lineTo(15, 0);
      ctx.moveTo(0, -15);
      ctx.lineTo(0, -7);
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 15);
      ctx.stroke();

      // Plane / vector chevron at aim point
      ctx.rotate(angle);
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-5, -5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

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
    <div className="w-full max-w-2xl bg-[#070c09] text-lime-300 font-mono p-6 border border-lime-500/25 rounded-xl shadow-2xl">
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-lime-500/15">
        <div>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-lime-400 transform -rotate-45" />
            <h2 className="text-xl font-bold text-white tracking-widest">// AVIATOR ENGINE</h2>
          </div>
          <p className="text-xs text-lime-200/60 mt-0.5">SOVEREIGN VECTOR PLANE &amp; SETTLEMENT</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="px-2.5 py-1.5 rounded bg-[#0d1711] hover:bg-[#14231a] text-lime-300 border border-lime-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>SESSION CHAT ({hasActiveUser ? chatMessages.length : 0})</span>
          </button>
          <div className="text-right">
            <div className="text-xs text-lime-200/60">BALANCE</div>
            <div className="text-2xl font-bold text-emerald-400">${balance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Ephemeral Avatar Session Chat (Zero history without user; wiped on exit) */}
      {chatOpen && (
        <div className="mb-4 p-3.5 rounded-lg bg-[#0b130e] border border-lime-500/25 space-y-3">
          <div className="flex items-center justify-between border-b border-lime-500/15 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-lime-300">
              <span className="w-6 h-6 rounded-full bg-lime-400 text-[#070c09] flex items-center justify-center font-black text-[11px]">
                {hasActiveUser ? cleanUserId.slice(0, 2).toUpperCase() : '--'}
              </span>
              <span>
                {hasActiveUser
                  ? `ACTIVE AVATAR SESSION: ${cleanUserId}`
                  : 'NO ACTIVE USER — SESSION HISTORY DISABLED'}
              </span>
            </div>
            {hasActiveUser && chatMessages.length > 0 && (
              <button
                type="button"
                onClick={clearEphemeralSessionChat}
                className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Wipe Session
              </button>
            )}
          </div>

          {!hasActiveUser ? (
            <div className="text-xs text-lime-200/50 py-3 text-center">
              Sign in or set an active user ID to participate in the live avatar conversation. No history is stored without a user.
            </div>
          ) : (
            <>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-lime-200/45 py-2 text-center">
                    Session active. Messages stay only for this session and delete on terminal exit.
                  </div>
                ) : (
                  chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded bg-[#070c09] border border-lime-500/15 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="text-lime-400 font-bold mr-1.5">[{m.avatarBadge}]</span>
                        <span className="text-white">{m.text}</span>
                      </div>
                      <span className="text-[10px] text-lime-200/40 shrink-0">{m.time}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message over current avatar..."
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

      {balance <= 0 && (
        <div className="mb-4 p-3 rounded-lg bg-[#0d1711] border border-lime-500/20 text-lime-100/80 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Balance is $0.00. Open Account to manage wallet or check eligibility for discretionary monthly allocation.</span>
          </div>
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-3 py-1 rounded bg-[#14231a] hover:bg-[#1c3124] text-lime-300 border border-lime-500/30 font-bold text-[11px] uppercase transition cursor-pointer whitespace-nowrap"
            >
              ACCOUNT
            </button>
          )}
        </div>
      )}

      {accaBoostActive && (
        <div className="mb-3 p-2 rounded bg-[#0d1711] border border-lime-400/40 text-lime-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-lime-400" />
            <span>
              ACCUMULATOR BOOST: Target multiplier set to{' '}
              <strong className="text-white">{targetOdds.toFixed(2)}x</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAccaBoostActive(false)}
            className="text-[10px] text-lime-200/70 hover:text-white underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      <div className="mb-4 p-2.5 rounded border flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0c150f] border-lime-500/20">
        <div className="flex items-center gap-2">
          {isBettingUnlocked ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold">
              <Unlock className="w-3.5 h-3.5" />
              BETTING UNLOCKED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400/40 text-amber-300 font-bold">
              <Lock className="w-3.5 h-3.5" />
              FLIGHT IN PROGRESS
            </span>
          )}
          <span className="text-lime-200/70 text-[11px]">
            STAKE: <strong className="text-white">${wagerStake.toFixed(2)}</strong> @{' '}
            <strong className="text-lime-300">{targetOdds.toFixed(2)}x</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-lime-200/60 text-[10px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> COUNTDOWN:
          </span>
          {[5, 3].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setCountdownDuration(sec)}
              disabled={flightPhase === 'FLYING'}
              className={`px-2 py-0.5 text-[10px] rounded font-bold cursor-pointer transition ${
                countdownDuration === sec
                  ? 'bg-amber-400 text-[#070c09]'
                  : 'bg-[#132018] text-lime-200/70 hover:text-white'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-48 bg-[#0b130e] border border-lime-500/25 rounded mb-4 flex items-center justify-center overflow-hidden shadow-inner">
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
            <span className="text-lime-400">x</span>
          </div>
        )}

        {isRunning && (
          <div className="absolute top-3 left-3 text-xs text-lime-300 animate-pulse flex items-center gap-1.5 z-10 bg-[#070c09]/85 px-2.5 py-1 rounded border border-lime-400/30">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping"></span>
            AIM LOCK ACTIVE
          </div>
        )}

        {flightPhase === 'LOCKED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-emerald-400 z-10 bg-[#070c09]/85 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> SETTLED
          </div>
        )}

        {flightPhase === 'CRASHED' && !isRunning && (
          <div className="absolute bottom-3 left-3 text-xs text-rose-400 z-10 bg-[#070c09]/85 px-2.5 py-1 rounded border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> CRASHED
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-lime-200/70 font-bold">AUTO-LOCK ODDS</label>
            <div className="flex gap-1">
              {[1.5, 2.0, 3.0, 5.0].map((odds) => (
                <button
                  key={odds}
                  type="button"
                  onClick={() => setTargetOdds(odds)}
                  disabled={flightPhase === 'FLYING'}
                  className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                    targetOdds === odds
                      ? 'bg-lime-400 text-[#070c09] font-bold'
                      : 'bg-[#132018] text-lime-200/70 hover:text-white'
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
            className="w-full bg-[#0b130e] border border-lime-500/25 p-2 text-white font-bold rounded text-sm focus:border-lime-400 outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-lime-200/70 block mb-1 font-bold">WAGER STAKE</label>
          <input
            type="number"
            min="1"
            value={wagerStake}
            disabled={flightPhase === 'FLYING'}
            onChange={(e) => setWagerStake(parseFloat(e.target.value) || 1)}
            className="w-full bg-[#0b130e] border border-lime-500/25 p-2 text-white font-bold rounded text-sm focus:border-lime-400 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-[#0b130e] p-2.5 rounded border border-lime-500/20 text-xs">
        <span className="text-lime-200/70 text-[11px] font-bold">QUICK STAKE:</span>
        <div className="flex gap-1.5">
          {[10, 25, 50, 100, 250].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setWagerStake(amt)}
              disabled={flightPhase === 'FLYING'}
              className={`px-2.5 py-1 text-xs rounded font-bold transition cursor-pointer ${
                wagerStake === amt
                  ? 'bg-lime-400 text-[#070c09]'
                  : 'bg-[#132018] text-lime-200/80 hover:bg-[#1a2c21]'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2 border-l border-lime-500/20 pl-2">
          <input
            type="checkbox"
            id="autoloop-check"
            checked={autoLoop}
            onChange={(e) => setAutoLoop(e.target.checked)}
            className="cursor-pointer accent-lime-400"
          />
          <label
            htmlFor="autoloop-check"
            className="text-[10px] text-lime-200/80 cursor-pointer font-bold select-none"
          >
            AUTO-LOOP
          </label>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {flightPhase === 'FLYING' ? (
          <button
            type="button"
            onClick={handleInstantAutoSettle}
            className="w-full py-4 bg-lime-400 hover:bg-lime-300 text-[#070c09] font-extrabold text-base tracking-widest uppercase rounded shadow-lg shadow-lime-500/20 transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-[#070c09]" />
            CASHOUT NOW [${(wagerStake * multiplier).toFixed(2)} @ {multiplier.toFixed(2)}x]
          </button>
        ) : flightPhase === 'CALM_DOWN' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={launchFlight}
              className="py-3.5 bg-lime-400 hover:bg-lime-300 text-[#070c09] font-extrabold text-sm tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Plane className="w-4 h-4 transform -rotate-45" />
              TAKEOFF NOW ({calmDownRemaining}s)
            </button>
            <button
              type="button"
              onClick={cancelCountdown}
              className="py-3.5 bg-[#132018] hover:bg-[#1a2c21] text-lime-200 font-bold text-sm tracking-wider uppercase rounded border border-lime-500/25 transition cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => startCalmDownCountdown(countdownDuration)}
              className="sm:col-span-2 py-4 bg-amber-400 hover:bg-amber-300 text-[#070c09] font-extrabold text-sm tracking-wider uppercase rounded transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              START {countdownDuration}s COUNTDOWN (${wagerStake.toFixed(2)})
            </button>
            <button
              type="button"
              onClick={launchFlight}
              className="py-4 bg-lime-400 hover:bg-lime-300 text-[#070c09] font-extrabold text-xs tracking-wider uppercase rounded transition cursor-pointer"
            >
              TAKEOFF
            </button>
          </div>
        )}
      </div>

      {settlementLog && (
        <div className="mb-4 p-2.5 bg-[#0b130e] border border-lime-500/25 text-emerald-400 text-xs rounded flex items-center justify-between">
          <span>{settlementLog}</span>
          <span className="text-[10px] text-lime-200/50">LEDGER</span>
        </div>
      )}

      <div className="pt-4 border-t border-lime-500/15 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-lime-200/70 text-[11px]">WITHDRAWALS &amp; ACCOUNT</span>
        </div>
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="px-3 py-1.5 rounded bg-[#0d1711] hover:bg-[#14231a] text-white border border-lime-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            ACCOUNT &amp; WITHDRAWALS
          </button>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-lime-500/10 text-[11px] text-lime-200/50">
        Discretionary Monthly Allocation Policy: Any monthly reward grant is discretionary and governed by ledger standing and scheduled cycle review.
      </div>
    </div>
  );
}