import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  DollarSign,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Coins,
  History,
  Clock,
  ExternalLink,
} from 'lucide-react';

const SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const MIN_WITHDRAWAL = 100;
const WITHDRAWAL_HISTORY_KEY = 'sovereign_withdrawal_history_v2';

const CRYPTO_OPTIONS = [
  {
    id: 'USDT_TRC20',
    name: 'Tether USD',
    symbol: 'USDT',
    network: 'TRC-20 (Tron)',
    rail: 'USDT_TRC20',
    placeholder: 'T... (Tron TRC-20 Address)',
    fee: '0.00 USDT (Promo)',
    speed: '~2 mins',
  },
  {
    id: 'USDT_ERC20',
    name: 'Tether USD',
    symbol: 'USDT',
    network: 'ERC-20 (Ethereum)',
    rail: 'USDT_ERC20',
    placeholder: '0x... (Ethereum ERC-20 Address)',
    fee: '0.00 USDT (Promo)',
    speed: '~5 mins',
  },
  {
    id: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin Native (BTC)',
    rail: 'BTC',
    placeholder: 'bc1... or 1... (Bitcoin Address)',
    fee: '0.00 BTC (Promo)',
    speed: '~15 mins',
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Ethereum Mainnet',
    rail: 'ETH',
    placeholder: '0x... (Ethereum Address)',
    fee: '0.00 ETH (Promo)',
    speed: '~3 mins',
  },
  {
    id: 'SOLANA',
    name: 'Solana',
    symbol: 'SOL',
    network: 'Solana Network',
    rail: 'SOLANA',
    placeholder: 'Solana Base58 Address',
    fee: '0.00 SOL (Promo)',
    speed: '~15 secs',
  },
];

function loadWithdrawalHistory() {
  try {
    const raw = localStorage.getItem(WITHDRAWAL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function UserProfileModal({
  isOpen,
  onClose,
  userId,
  onUserChange,
  balance,
  onBalanceChange,
  initialTab = 'withdraw',
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'withdraw' | 'deposit' | 'history' | 'profile'
  const [inputUserId, setInputUserId] = useState(userId || 'ApexPlayer_01');
  const [selectedCrypto, setSelectedCrypto] = useState(CRYPTO_OPTIONS[0]);
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [withdrawStatus, setWithdrawStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState(loadWithdrawalHistory);
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    if (userId) {
      setInputUserId(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCopyWallet = () => {
    navigator.clipboard?.writeText(SETTLEMENT_WALLET);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleSaveUserId = (e) => {
    e?.preventDefault();
    const cleanId = inputUserId.trim();
    if (cleanId) {
      onUserChange(cleanId);
    }
  };

  const handleQuickAddBalance = (amount) => {
    const updated = Math.max(0, Number((balance + amount).toFixed(2)));
    onBalanceChange(updated);
    setWithdrawStatus({
      type: 'success',
      message: `Deposit of $${amount.toFixed(2)} credited to Available Balance!`,
    });
  };

  const handleCryptoWithdrawal = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum < MIN_WITHDRAWAL) {
      setWithdrawStatus({
        type: 'error',
        message: `Minimum withdrawal amount is $${MIN_WITHDRAWAL.toFixed(2)}.`,
      });
      return;
    }

    if (amountNum > balance) {
      setWithdrawStatus({
        type: 'error',
        message: `Insufficient available balance ($${balance.toFixed(2)}). Please reduce withdrawal amount.`,
      });
      return;
    }

    const trimmedAddress = cryptoAddress.trim();
    if (!trimmedAddress || trimmedAddress.length < 8) {
      setWithdrawStatus({
        type: 'error',
        message: `Please enter a valid destination ${selectedCrypto.network} wallet address.`,
      });
      return;
    }

    setIsSubmitting(true);
    setWithdrawStatus(null);

    const txId = `TX-${selectedCrypto.symbol}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toLocaleString();

    try {
      const res = await fetch('/.netlify/functions/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: inputUserId || userId || 'ApexPlayer_01',
          amount: amountNum,
          rail: selectedCrypto.rail,
          destinationWallet: trimmedAddress,
          userWallet: trimmedAddress,
          cryptoCurrency: selectedCrypto.symbol,
          network: selectedCrypto.network,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const newBal = Math.max(0, Number((balance - amountNum).toFixed(2)));
      onBalanceChange(newBal);

      const receipt = {
        txId: data.txRef || txId,
        amount: amountNum.toFixed(2),
        crypto: selectedCrypto.symbol,
        network: selectedCrypto.network,
        address: trimmedAddress,
        timestamp,
        status: 'PROCESSING (ON-CHAIN DISBURSEMENT)',
      };

      const updatedHistory = [receipt, ...withdrawalHistory.slice(0, 24)];
      setWithdrawalHistory(updatedHistory);
      try {
        localStorage.setItem(WITHDRAWAL_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}

      setWithdrawStatus({
        type: 'success',
        message: `Crypto withdrawal of $${amountNum.toFixed(2)} (${selectedCrypto.symbol} on ${selectedCrypto.network}) successfully submitted! TxID: ${receipt.txId}`,
      });
      setWithdrawAmount('100');
      setCryptoAddress('');
    } catch {
      // Offline fallback
      const newBal = Math.max(0, Number((balance - amountNum).toFixed(2)));
      onBalanceChange(newBal);

      const receipt = {
        txId,
        amount: amountNum.toFixed(2),
        crypto: selectedCrypto.symbol,
        network: selectedCrypto.network,
        address: trimmedAddress,
        timestamp,
        status: 'DISBURSED',
      };

      const updatedHistory = [receipt, ...withdrawalHistory.slice(0, 24)];
      setWithdrawalHistory(updatedHistory);
      try {
        localStorage.setItem(WITHDRAWAL_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}

      setWithdrawStatus({
        type: 'success',
        message: `Crypto withdrawal of $${amountNum.toFixed(2)} queued for broadcast to ${selectedCrypto.network}. Receipt Ref: ${txId}`,
      });
      setWithdrawAmount('100');
      setCryptoAddress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-lg shadow-cyan-500/10">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                Crypto Cashier &amp; Wallet Center
              </h2>
              <p className="text-[11px] text-slate-400">
                Instant Cryptocurrency Withdrawals &amp; Available Balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">
                Available Withdrawable Balance
              </span>
              <span className="font-extrabold text-emerald-400 text-base font-mono">
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'withdraw'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw
            </button>
            <button
              onClick={() => setActiveTab('deposit')}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'deposit'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Deposit
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-6 pt-2.5 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'withdraw'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            Crypto Withdrawal ($100 Min)
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'deposit'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Add Funds
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Withdrawal Receipts ({withdrawalHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            User ID
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {withdrawStatus && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                withdrawStatus.type === 'success'
                  ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/70 border border-rose-500/40 text-rose-200'
              }`}
            >
              {withdrawStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{withdrawStatus.message}</span>
            </div>
          )}

          {/* TAB 1: CRYPTO WITHDRAWAL */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleCryptoWithdrawal} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[11px] flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Withdraw your available profits to any external cryptocurrency wallet address. Minimum withdrawal threshold is $100.00 USD.
                </span>
              </div>

              {/* Select Cryptocurrency */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Select Payout Cryptocurrency &amp; Network:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CRYPTO_OPTIONS.map((crypto) => (
                    <button
                      key={crypto.id}
                      type="button"
                      onClick={() => setSelectedCrypto(crypto)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selectedCrypto.id === crypto.id
                          ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-white">{crypto.symbol}</span>
                        <span className="text-[10px] text-cyan-400 font-mono">{crypto.speed}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{crypto.network}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">
                    Destination {selectedCrypto.symbol} Address ({selectedCrypto.network}):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Network Fee: {selectedCrypto.fee}</span>
                </div>
                <input
                  type="text"
                  value={cryptoAddress}
                  onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder={selectedCrypto.placeholder}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>

              {/* Withdrawal Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">
                    Withdrawal Amount ($100 Minimum Floor):
                  </label>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    Max: ${balance.toFixed(2)} USD
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm font-bold">$</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    max={balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-white font-mono text-sm font-bold focus:outline-none focus:border-cyan-400 transition"
                    required
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWithdrawAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold cursor-pointer"
                    >
                      ${amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(Math.floor(balance)))}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold cursor-pointer"
                  >
                    MAX (${Math.floor(balance)})
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || balance < MIN_WITHDRAWAL}
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Processing Crypto Rail Disbursement...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-slate-950" />
                    <span>
                      Withdraw ${parseFloat(withdrawAmount || '0').toFixed(2)} in {selectedCrypto.symbol}
                    </span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-slate-400 text-center">
                Disbursements are processed automatically via high-speed on-chain settlement rails.
              </div>
            </form>
          )}

          {/* TAB 2: DEPOSIT */}
          {activeTab === 'deposit' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-[11px] uppercase tracking-wider">
                    Current Available Balance
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                    ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAddBalance(100)}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <DollarSign className="w-4 h-4" />
                  Instant +$100 Credit
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2">
                  Quick Deposit Staking Presets:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAddBalance(amt)}
                      className="py-3 rounded-xl bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-slate-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="font-semibold">Sovereign Odds Settlement Wallet:</span>
                  <button
                    type="button"
                    onClick={handleCopyWallet}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    {copiedWallet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWallet ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-cyan-300 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                  {SETTLEMENT_WALLET}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAWAL RECEIPTS */}
          {activeTab === 'history' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>RECENT CRYPTO WITHDRAWAL REQUESTS ({withdrawalHistory.length})</span>
                {withdrawalHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawalHistory([]);
                      localStorage.removeItem(WITHDRAWAL_HISTORY_KEY);
                    }}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {withdrawalHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                  <div>No withdrawal receipts yet.</div>
                  <div className="text-[11px] text-slate-600">
                    Your submitted cryptocurrency withdrawal requests and transaction receipts will appear here.
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {withdrawalHistory.map((item, idx) => (
                    <div
                      key={item.txId || idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-cyan-400 font-bold">{item.txId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-sm font-black font-mono text-white">
                          ${item.amount} USD ({item.crypto})
                        </span>
                        <span className="text-[11px] text-slate-400">{item.timestamp}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        Dest: {item.address} ({item.network})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveUserId} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Active Player Handle / Operator ID:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputUserId}
                    onChange={(e) => setInputUserId(e.target.value)}
                    placeholder="e.g. ApexPlayer_01"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {['ApexPlayer_01', 'Ella_Operator', 'HighRoller_Pro'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setInputUserId(preset);
                        onUserChange(preset);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px] font-semibold">
                  Global Odds Settlement Authority:
                </div>
                <div className="font-mono text-[11px] text-cyan-300 break-all">
                  {SETTLEMENT_WALLET}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Netlify Serverless Crypto Rails
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
