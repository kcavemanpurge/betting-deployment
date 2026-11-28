export async function pingEdge() {
  const start = performance.now();
  const res = await fetch('/.netlify/functions/system?command=ping');
  const elapsed = Math.round(performance.now() - start);
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && Boolean(data.ok ?? data.success),
    latencyMs: data.latencyMs ?? elapsed,
    settlementWallet: data.settlementWallet || '',
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

export async function verifyDeployment() {
  const res = await fetch('/.netlify/functions/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'deploy' }),
  });
  return res.json().catch(() => ({ ok: false, error: 'INVALID_JSON_RESPONSE' }));
}

export async function fetchStatus() {
  const res = await fetch('/.netlify/functions/system?command=status');
  return res.json().catch(() => ({ ok: false, error: 'INVALID_JSON_RESPONSE' }));
}

export async function runAutomatedRound({ userId, wagerAmount, targetOdds }) {
  const res = await fetch('/.netlify/functions/round', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      wagerAmount: Number(wagerAmount),
      targetOdds: Number(targetOdds),
    }),
  });
  return res.json().catch(() => ({ ok: false, error: 'INVALID_JSON_RESPONSE' }));
}

export async function settleWagerAutomated({
  sessionId,
  userId,
  wagerAmount,
  multiplier,
  rail = 'HOT_WALLET',
  onBalanceUpdate,
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
  const data = await res.json().catch(() => ({ ok: false, error: 'INVALID_JSON_RESPONSE' }));

  // Prefer authoritative server balance if provided; avoid guessing client-side math
  const authoritativeBalance =
    data.availableBalance ?? data.balance ?? data.updatedBalance;
  if (
    res.ok &&
    (data.ok || data.success) &&
    typeof onBalanceUpdate === 'function' &&
    authoritativeBalance !== undefined &&
    authoritativeBalance !== null &&
    Number.isFinite(Number(authoritativeBalance))
  ) {
    onBalanceUpdate(Number(authoritativeBalance));
  }

  return data;
}

export async function requestAutomatedWithdrawal({
  userId,
  amount,
  rail,
  userWallet,
  settlementWallet,
  onBalanceUpdate,
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
      ...(settlementWallet ? { settlementWallet } : {}),
    }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'INVALID_JSON_RESPONSE' }));

  const authoritativeBalance =
    data.availableBalance ?? data.balance ?? data.updatedBalance;
  if (
    res.ok &&
    (data.ok || data.success) &&
    typeof onBalanceUpdate === 'function' &&
    authoritativeBalance !== undefined &&
    authoritativeBalance !== null &&
    Number.isFinite(Number(authoritativeBalance))
  ) {
    onBalanceUpdate(Number(authoritativeBalance));
  }

  return data;
}

export async function fetchSettlementLedger(userId = '') {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`/.netlify/functions/settle${query}`);
  if (!res.ok) {
    return { ok: false, settlements: [], error: `LEDGER_FETCH_FAILED_${res.status}` };
  }
  const data = await res.json().catch(() => ({}));
  return {
    ok: true,
    settlements: Array.isArray(data.settlements) ? data.settlements : [],
    source: data.source || 'POSTGRES_LEDGER',
  };
}