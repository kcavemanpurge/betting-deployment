const DEFAULT_SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';

export async function pingEdge() {
  const start = performance.now();
  const res = await fetch('/.netlify/functions/system?command=ping');
  const elapsed = Math.round(performance.now() - start);
  const data = await res.json();
  return {
    ok: res.ok && Boolean(data.ok ?? data.success),
    latencyMs: data.latencyMs ?? elapsed,
    settlementWallet: data.settlementWallet || DEFAULT_SETTLEMENT_WALLET,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

export async function verifyDeployment() {
  const res = await fetch('/.netlify/functions/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'deploy' }),
  });
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch('/.netlify/functions/system?command=status');
  return res.json();
}

export async function runAutomatedRound({ userId, wagerAmount, targetOdds = 2.0 }) {
  const res = await fetch('/.netlify/functions/round', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      wagerAmount: Number(wagerAmount),
      targetOdds: Number(targetOdds),
    }),
  });
  return res.json();
}

export async function settleWagerAutomated({
  sessionId,
  userId,
  wagerAmount,
  multiplier,
  rail = 'HOT_WALLET',
  onBalanceUpdate,
  currentBalance,
}) {
  const stake = Number(wagerAmount);
  const mult = Number(multiplier);
  const res = await fetch('/.netlify/functions/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      userId,
      wagerAmount: stake,
      multiplier: mult,
      rail,
    }),
  });
  const data = await res.json();

  if (res.ok && (data.ok || data.success)) {
    const payout = Number(data.payoutAmount ?? stake * mult);
    if (typeof onBalanceUpdate === 'function' && typeof currentBalance === 'number') {
      const nextBal = Number(Math.max(0, currentBalance + (payout - stake)).toFixed(2));
      onBalanceUpdate(nextBal);
    }
  }

  return data;
}

export async function requestAutomatedWithdrawal({
  userId,
  amount,
  rail = 'SOLANA',
  userWallet,
  onBalanceUpdate,
  currentBalance,
}) {
  const amt = Number(amount);
  const res = await fetch('/.netlify/functions/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      amount: amt,
      rail,
      userWallet,
      settlementWallet: DEFAULT_SETTLEMENT_WALLET,
    }),
  });
  const data = await res.json();

  if (res.ok && (data.ok || data.success)) {
    if (typeof onBalanceUpdate === 'function' && typeof currentBalance === 'number') {
      const nextBal = Number(Math.max(0, currentBalance - amt).toFixed(2));
      onBalanceUpdate(nextBal);
    }
  }

  return data;
}

export async function fetchSettlementLedger(userId) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`/.netlify/functions/settle${query}`);
  return res.json();
}
