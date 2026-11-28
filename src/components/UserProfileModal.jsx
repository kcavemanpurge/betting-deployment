import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react';

const SETTLEMENT_WALLET = '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m';
const MIN_WITHDRAWAL = 100;

export function UserProfileModal({
  isOpen,
  onClose,
  userId,
  onUserChange,
  balance,
  onBalanceChange,
  onRefreshLedger,
}) {
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'balance' | 'withdraw'
  const [inputUserId, setInputUserId] = useState(userId || '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userWallet, setUserWallet] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [cardNumber, setCardNumber] = useState('');
  const [withdrawRail, setWithdrawRail] = useState('SOLANA');
  const [statusBanner, setStatusBanner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setInputUserId(userId || '');
  }, [userId]);

  if (!isOpen) return null;

  const activeOperatorId = (inputUserId || userId || '').trim();

  const handleCopyWallet = () => {
    navigator.clipboard?.writeText(SETTLEMENT_WALLET);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleSaveUserId = (e) => {
    e?.preventDefault();
    if (!activeOperatorId) {
      setStatusBanner({
        type: 'error',
        message: 'Enter a valid operator ID before saving.',
      });
      return;
    }
    onUserChange(activeOperatorId);
    setStatusBanner({
      type: 'success',
      message: `Operator identity bound to ${activeOperatorId}.`,
    });
  };

  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(withdrawAmount);

    if (!activeOperatorId) {
      setStatusBanner({
        type: 'error',
        message: 'Operator identity is required before requesting a withdrawal.',
      });
      return;
    }

    if (!Number.isFinite(amountNum) || amountNum < MIN_WITHDRAWAL) {
      setStatusBanner({
        type: 'error',
        message: `Minimum withdrawal floor is $${MIN_WITHDRAWAL.toFixed(2)}.`,
      });
      return;
    }

    if (amountNum > Number(balance)) {
      setStatusBanner({
        type: 'error',
        message: 'Requested amount exceeds available settled balance.',
      });
      return;
    }

    if (withdrawRail === 'CARD_RAIL' && !cardNumber.trim()) {
      setStatusBanner({
        type: 'error',
        message: 'Enter a destination card reference for CARD_RAIL.',
      });
      return;
    }

    if (withdrawRail !== 'CARD_RAIL' && !userWallet.trim()) {
      setStatusBanner({
        type: 'error',
        message: `Enter a valid ${withdrawRail} destination wallet address.`,
      });
      return;
    }

    setIsSubmitting(true);
    setStatusBanner(null);

    const settlementId = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('/.netlify/functions/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId,
          userId: activeOperatorId,
          amount: amountNum,
          rail: withdrawRail,
          cardNumber: withdrawRail === 'CARD_RAIL' ? cardNumber.trim() : undefined,
          destinationWallet: withdrawRail !== 'CARD_RAIL' ? userWallet.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.ok || data.success)) {
        const authoritativeBal =
          data.availableBalance ?? data.balance ?? data.updatedBalance;
        if (
          typeof onBalanceChange === 'function' &&
          authoritativeBal !== undefined &&
          authoritativeBal !== null &&
          Number.isFinite(Number(authoritativeBal))
        ) {
          onBalanceChange(Number(authoritativeBal));
        }
        if (typeof onRefreshLedger === 'function') {
          onRefreshLedger();
        }
        setStatusBanner({
          type: 'success',
          message: `Withdrawal of $${amountNum.toFixed(2)} confirmed on ${withdrawRail} (Ref: ${data.receiptId || data.txHash || settlementId}).`,
        });
        setCardNumber('');
      } else {
        setStatusBanner({
          type: 'error',
          message: `Withdrawal rejected: ${data.error || 'Server settlement check failed.'}`,
        });
      }
    } catch {
      setStatusBanner({
        type: 'error',
        message: 'Network error reaching withdrawal endpoint. No local balance deduction applied.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Account &amp; Vault Center
              </h2>
              <p className="text-[11px] text-slate-400">
                Operator Identity, Ledger Standing &amp; Payout Rails
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Banner */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Available Balance:</span>
            <span className="font-bold text-emerald-400 text-sm font-mono">
              ${Number(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {typeof onRefreshLedger === 'function' && (
            <button
              type="button"
              onClick={onRefreshLedger}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 font-semibold transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Sync Ledger
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-6 pt-2 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`pb-2.5 border-b-2 transition cursor-pointer ${
              activeTab === 'account'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Operator Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('balance')}
            className={`pb-2.5 border-b-2 transition cursor-pointer ${
              activeTab === 'balance'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Vault Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`pb-2.5 border-b-2 transition cursor-pointer ${
              activeTab === 'withdraw'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Withdrawal Rail ($100 Min)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {statusBanner && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                statusBanner.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
              }`}
            >
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusBanner.message}</span>
            </div>
          )}

          {activeTab === 'account' && (
            <form onSubmit={handleSaveUserId} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Active Operator ID / Username:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputUserId}
                    onChange={(e) => setInputUserId(e.target.value)}
                    placeholder="Enter operator ID"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Full Legal Name (Optional):
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Optional profile name"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Account Email Address:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@domain.io"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Reference Settlement Wallet:</span>
                  <button
                    type="button"
                    onClick={handleCopyWallet}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {copiedWallet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWallet ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-slate-300 break-all">
                  {SETTLEMENT_WALLET}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'balance' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px] uppercase tracking-wider">
                  Server-Governed Balance
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  ${Number(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                <div className="font-bold text-emerald-300 uppercase tracking-wider">
                  Discretionary Monthly Allocation Policy
                </div>
                <p>
                  Monthly reward allocations are discretionary and governed by backend ledger rules, anti-arbitrage checks, and scheduled review cycles rather than client-side clicks.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <form onSubmit={handleWithdrawalSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Enforces ${MIN_WITHDRAWAL} minimum floor and server-side PostgreSQL balance locking before payout dispatch.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Settlement Rail:
                </label>
                <select
                  value={withdrawRail}
                  onChange={(e) => setWithdrawRail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="SOLANA">SOLANA Rail</option>
                  <option value="SMART_CHAIN">SMART CHAIN (EVM)</option>
                  <option value="HOT_WALLET">Direct Hot Wallet</option>
                  <option value="CARD_RAIL">Card Rail</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Withdrawal Amount (${MIN_WITHDRAWAL} Minimum):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    min={MIN_WITHDRAWAL}
                    step="10"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {withdrawRail === 'CARD_RAIL' ? (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Card Reference / Number:
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="Enter payout card details"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Destination Wallet Address:
                  </label>
                  <input
                    type="text"
                    value={userWallet}
                    onChange={(e) => setUserWallet(e.target.value)}
                    placeholder="Enter destination wallet address"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || Number(balance) < MIN_WITHDRAWAL}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Settlement...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Submit ${Number(withdrawAmount || 0).toFixed(2)} Withdrawal</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Serverless Settlement Rail</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}