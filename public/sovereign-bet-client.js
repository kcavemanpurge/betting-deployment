const WALLET_ANCHOR = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const STORAGE_KEY = 'sovereign_bet_state_v2';

const defaultState = {
  auth: { loggedIn: false, email: '', fullName: '', kycId: '', walletAddress: '', kycLocked: false },
  balances: { promo: 0, profit: 0, dailySpend: 0, spendDate: new Date().toISOString().slice(0, 10) },
  slip: [],
  history: [],
  sportsView: 'spotlight', // 'spotlight' | 'ongoing'
  aviator: { multiplier: 1.0, running: false, stake: 10, autoCashout: 2.0, crashAt: null }
};

function loadBetState() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultState;
    if (parsed.balances?.spendDate !== today) {
      parsed.balances.dailySpend = 0;
      parsed.balances.spendDate = today;
    }
    return { ...defaultState, ...parsed, balances: { ...defaultState.balances, ...parsed.balances } };
  } catch {
    return { ...defaultState };
  }
}

let state = loadBetState();

function persistBetState() {
  const serialized = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, serialized);
  sessionStorage.setItem(STORAGE_KEY, serialized);
}

// Email sign-in / registration with KYC + wallet lock in metadata
function signInWithEmail({ email, password, fullName, kycId, walletAddress }) {
  if (!email || !email.includes('@')) throw new Error('Valid email required.');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

  const prev = state.auth;
  const lockedName = prev.kycLocked && prev.fullName ? prev.fullName : (fullName || '').trim();
  const lockedKyc = prev.kycLocked && prev.kycId ? prev.kycId : (kycId || '').trim();
  const lockedWallet = (walletAddress || prev.walletAddress || WALLET_ANCHOR).trim();

  state.auth = {
    loggedIn: true,
    email: email.trim().toLowerCase(),
    fullName: lockedName,
    kycId: lockedKyc,
    walletAddress: lockedWallet,
    kycLocked: Boolean(lockedName && lockedKyc),
    settlementWallet: WALLET_ANCHOR
  };
  persistBetState();
  return state.auth;
}

// Deduct stake (promo first, then profit) and persist to bet history
function placeWager({ marketType, stake, odds, selections = [] }) {
  const amount = Number(stake);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid stake amount.');

  const totalAvailable = state.balances.promo + state.balances.profit;
  if (amount > totalAvailable) throw new Error('Insufficient promo + profit balance.');

  const fromPromo = Math.min(state.balances.promo, amount);
  const fromProfit = Number((amount - fromPromo).toFixed(4));

  state.balances.promo = Number((state.balances.promo - fromPromo).toFixed(4));
  state.balances.profit = Number((state.balances.profit - fromProfit).toFixed(4));
  state.balances.dailySpend = Number((state.balances.dailySpend + amount).toFixed(4));

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    marketType,
    stakeAmount: amount,
    usedPromo: fromPromo,
    usedProfit: fromProfit,
    oddsOrMultiplier: Number(odds),
    payoutAmount: 0,
    outcome: 'PENDING',
    selections,
    createdAt: new Date().toISOString()
  };

  state.history.unshift(entry);
  persistBetState();
  return entry;
}

// Settle bet into Profit Balance and keep permanent history
function settleWager(entryId, won, finalMultiplier) {
  const item = state.history.find((h) => h.id === entryId);
  if (!item) return null;

  const mult = Number(finalMultiplier ?? item.oddsOrMultiplier);
  if (won) {
    const payout = Number((item.stakeAmount * mult).toFixed(4));
    item.outcome = 'WON';
    item.payoutAmount = payout;
    state.balances.profit = Number((state.balances.profit + payout).toFixed(4));
  } else {
    item.outcome = item.marketType === 'AVIATOR' ? 'CRASHED' : 'LOST';
    item.payoutAmount = 0;
  }

  persistBetState();
  return item;
}

// Submit withdrawal request for backend manual approval (Solana / Smart Chain / Hot Wallet)
async function requestWithdrawal({ amount, rail, userWallet, apiBase = '' }) {
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) throw new Error('Invalid withdrawal amount.');
  if (numAmount > state.balances.profit) throw new Error('Withdrawals draw from settled profit balance.');

  const targetWallet = (userWallet || state.auth.walletAddress || '').trim();
  if (!targetWallet) throw new Error('User withdrawal wallet is required.');

  state.balances.profit = Number((state.balances.profit - numAmount).toFixed(4));
  const reqPayload = {
    userId: state.auth.email || 'guest_user',
    amount: numAmount,
    rail: rail || 'SOLANA',
    userWallet: targetWallet,
    settlementWallet: WALLET_ANCHOR,
    status: 'PENDING_MANUAL_APPROVAL',
    requestedAt: new Date().toISOString()
  };

  state.history.unshift({
    id: `wd-${Date.now()}`,
    marketType: 'WITHDRAWAL',
    stakeAmount: numAmount,
    usedPromo: 0,
    usedProfit: numAmount,
    oddsOrMultiplier: 1,
    payoutAmount: numAmount,
    outcome: 'PENDING',
    selections: [reqPayload],
    createdAt: reqPayload.requestedAt
  });
  persistBetState();

  if (apiBase) {
    await fetch(`${apiBase}/.netlify/functions/withdrawals-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload)
    }).catch(() => null);
  }

  return reqPayload;
}

// Render two-mode sports display (Spotlight top game + Ongoing score strip) & footer notice
function renderSportsAndFooter(matches = []) {
  const spotlightEl = document.getElementById('sports-spotlight');
  const ongoingEl = document.getElementById('sports-ongoing-strip');
  const footerEl = document.getElementById('disbursement-footer');

  if (spotlightEl && matches.length > 0) {
    const top = matches[0];
    spotlightEl.innerHTML = `
      <div class="spotlight-card">
        <span>TOP FEATURED MATCH</span>
        <h3>${top.homeTeam} vs ${top.awayTeam}</h3>
        <div>Score: <strong>${top.homeScore ?? 0} - ${top.awayScore ?? 0}</strong></div>
      </div>`;
  }

  if (ongoingEl) {
    ongoingEl.innerHTML = matches
      .map((m) => `<div class="ongoing-pill"><span>${m.homeTeam}</span> <strong>${m.homeScore ?? 0}:${m.awayScore ?? 0}</strong> <span>${m.awayTeam}</span></div>`)
      .join('');
  }

  if (footerEl) {
    footerEl.textContent =
      'Verified Netlify Serverless Settlement & Crypto Rail Portal.';
  }
}
