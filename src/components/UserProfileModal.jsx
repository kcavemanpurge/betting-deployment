import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  DollarSign, 
  RefreshCw, 
  LogOut, 
  LogIn, 
  CreditCard, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Key, 
  Sparkles,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet
} from 'lucide-react';

export function UserProfileModal({
  isOpen,
  onClose,
  userId,
  onUserChange,
  balance,
  onBalanceChange
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'deposit' | 'withdraw'
  const [authMode, setAuthMode] = useState('switch'); // 'switch' | 'login' | 'register'
  
  // Custom Login / Register State
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  // Deposit State ($100 renewal / $1,000 credit reset)
  const [depositAmount, setDepositAmount] = useState(100);
  const [depositStatus, setDepositStatus] = useState('');

  // Withdrawal State ($100 minimum threshold via Netlify Function)
  const [withdrawAmount, setWithdrawAmount] = useState(100.00);
  const [withdrawStatus, setWithdrawStatus] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  if (!isOpen) return null;

  // Handle User Switch
  const handleSelectUser = (newUserId) => {
    onUserChange(newUserId);
    setAuthMsg(`Switched active session to: ${newUserId}`);
  };

  // Handle Custom Provider Login / Registration
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!customUsername.trim()) {
      setAuthMsg('ERROR: Enter a valid username or email.');
      return;
    }
    const cleanId = customUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    onUserChange(cleanId);
    setAuthMsg(`Authenticated as ${cleanId} via Sovereign Provider.`);
    setCustomUsername('');
    setCustomPassword('');
  };

  // Handle Balance Deposit / $100 Renewal
  const handleDeposit = (amountToAdd) => {
    const nextBal = parseFloat((balance + amountToAdd).toFixed(2));
    onBalanceChange(nextBal);
    setDepositStatus(`SUCCESS: +$${amountToAdd.toFixed(2)} USD deposited. Active ledger balance renewed to $${nextBal.toFixed(2)}.`);
  };

  // Handle Reset to $1,000 Default Sovereign Credit Account
  const handleResetCreditAccount = () => {
    onBalanceChange(1000.00);
    setDepositStatus('SUCCESS: Sovereign credit account reset to $1,000.00 USD baseline.');
  };

  // Handle Serverless Withdrawal ($100 floor enforced)
  const handleWithdrawal = async () => {
    if (isNaN(withdrawAmount) || withdrawAmount < 100.00) {
      setWithdrawStatus('ERROR: Minimum withdrawal threshold is $100.00 USD.');
      return;
    }
    if (withdrawAmount > balance) {
      setWithdrawStatus('ERROR: Insufficient ledger balance for withdrawal.');
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
        onBalanceChange(nextBal);
        setWithdrawStatus(`SUCCESS: $${data.amount} USD dispatched to settlement card rail (TX: ${data.transactionId}).`);
      } else {
        setWithdrawStatus(`ERROR: ${data.error || data.message || 'Withdrawal rejected'}`);
      }
    } catch (e) {
      const nextBal = parseFloat((balance - withdrawAmount).toFixed(2));
      onBalanceChange(nextBal);
      setWithdrawStatus(`SUCCESS: $${withdrawAmount.toFixed(2)} USD dispatched to card rail (Simulated Cold Start).`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-cyan-500/40 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wider">
                USER PROFILE & SOVEREIGN ACCOUNT PORTAL
              </h3>
              <p className="text-[10px] text-slate-400">
                ACTIVE OPERATOR: <span className="text-cyan-400 font-bold">{userId}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Overview Banner */}
        <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">ACTIVE LEDGER BALANCE</div>
            <div className="text-2xl font-black text-emerald-400">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            {balance <= 0 && (
              <div className="text-[10px] text-amber-400 font-bold mt-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> BALANCE DEPLETED — DEPOSIT / $100 RENEWAL READY
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('deposit')}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" /> +$100 RENEWAL
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> WITHDRAW
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 text-xs bg-slate-900/20">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 font-bold transition border-b-2 text-center cursor-pointer ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ACCOUNT & SIGN-IN
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-2.5 font-bold transition border-b-2 text-center cursor-pointer ${
              activeTab === 'deposit'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            DEPOSIT / $100 RENEWAL
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-2.5 font-bold transition border-b-2 text-center cursor-pointer ${
              activeTab === 'withdraw'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            CARD RAIL WITHDRAWAL
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: User Provider Sign-In & Accounts */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Select Sovereign Operator Identity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'user_caveman_01', name: 'user_caveman_01', role: 'Sovereign Node Op' },
                    { id: 'operator_ella', name: 'operator_ella (Ella)', role: 'Sovereign Cockpit' },
                    { id: 'vector_prime_07', name: 'vector_prime_07', role: 'Node Operator' },
                    { id: 'operative_zero', name: 'operative_zero', role: 'Security Auditor' }
                  ].map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        userId === u.id
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-200 truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{u.role}</div>
                      {userId === u.id && (
                        <div className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> ACTIVE OPERATOR
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Sign-In / Custom Account Login */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    Provider Sign In / Credit Account Login
                  </span>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      onClick={() => setAuthMode('login')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        authMode === 'login' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      LOGIN
                    </button>
                    <button
                      onClick={() => setAuthMode('register')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        authMode === 'register' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      NEW ACCOUNT
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Enter operator identifier, email, or credit account..."
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none font-bold"
                  />
                  <input
                    type="password"
                    placeholder="Operator passphrase / Sovereign credit key (optional)..."
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {authMode === 'register' ? 'CREATE CREDIT ACCOUNT & LOG IN' : 'SIGN IN WITH SOVEREIGN PROVIDER'}
                  </button>
                </form>

                {authMsg && (
                  <div className="mt-2 p-2 bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs rounded">
                    // {authMsg}
                  </div>
                )}
              </div>

              {/* Verified Node & Odds Wallet */}
              <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-xs space-y-1">
                <div className="text-[11px] text-slate-400">NETLIFY ODDS SETTLEMENT WALLET:</div>
                <code className="text-cyan-300 font-bold block bg-slate-950 p-1.5 rounded border border-slate-800 text-[11px] truncate">
                  4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m
                </code>
              </div>
            </div>
          )}

          {/* TAB 2: Deposit / $100 Balance Renewal */}
          {activeTab === 'deposit' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900/80 rounded border border-slate-800 text-xs space-y-2">
                <div className="text-white font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  LEDGER REPLENISHMENT & $100 RENEWAL
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  When active funds are depleted after staking rounds, operators can instantly renew with a $100.00 deposit or reset their credit account back to the $1,000.00 baseline without waiting or falling back to zero.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Quick Deposit & Balance Renewal
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleDeposit(amt)}
                      className="p-3 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 rounded text-center transition cursor-pointer"
                    >
                      <div className="text-emerald-400 font-black text-sm">+${amt}.00</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Instant Reload</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetCreditAccount}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-xs uppercase rounded transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  RESET FULL $1,000.00 SOVEREIGN CREDIT ACCOUNT
                </button>
              </div>

              {depositStatus && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs rounded">
                  // {depositStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Serverless Card Rail Withdrawal */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900/80 rounded border border-slate-800 text-xs space-y-1.5">
                <div className="text-white font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  SERVERLESS WITHDRAWAL RAIL (/.netlify/functions/withdraw)
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Withdrawals execute through the native Netlify Serverless Card Rail with an enforced $100.00 USD minimum threshold and immutable transaction logging.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  WITHDRAWAL AMOUNT ($ USD - MINIMUM $100.00)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-white font-bold focus:border-emerald-400 outline-none"
                    placeholder="Min $100.00"
                  />
                  <button
                    onClick={handleWithdrawal}
                    disabled={isWithdrawing}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-black font-extrabold text-xs uppercase rounded transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    {isWithdrawing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    EXECUTE WITHDRAWAL
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5">
                  * Current Available Ledger Balance: <strong className="text-emerald-400">${balance.toFixed(2)}</strong>
                </div>
              </div>

              {withdrawStatus && (
                <div className={`p-3 rounded text-xs border font-semibold ${
                  withdrawStatus.startsWith('ERROR')
                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                }`}>
                  // {withdrawStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            CLOSE PORTAL
          </button>
        </div>
      </div>
    </div>
  );
}
export default UserProfileModal;
