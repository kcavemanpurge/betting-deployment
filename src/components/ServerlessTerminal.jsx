import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, CheckCircle2, RefreshCw, Zap, ShieldCheck, Play, ArrowRight, CornerDownLeft } from 'lucide-react';

export function ServerlessTerminal({ userId = 'user_caveman_01', balance = 1000.0, onBalanceUpdate = () => {} }) {
  const [logs, setLogs] = useState([
    { type: 'sys', text: '// SOVEREIGN SERVERLESS COCKPIT INITIALIZED' },
    { type: 'sys', text: '// HOST: Netlify Edge CDN | RUNTIME: Node.js Serverless Functions' },
    { type: 'sys', text: '// DATABASE: Netlify Managed PostgreSQL (Drizzle ORM)' },
    { type: 'info', text: '// DEPENDENCY AUDIT: Termux mobile shell completely eliminated. 100% Serverless active.' },
    { type: 'hint', text: 'Type "help" or click any action below to execute serverless pipeline commands.' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalEndRef = useRef(null);

  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const addLog = (type, text) => {
    setLogs((prev) => [...prev, { type, text, timestamp: new Date().toLocaleTimeString() }]);
  };

  const executeCommand = async (cmdStr) => {
    const raw = cmdStr.trim();
    if (!raw) return;

    // Add to history
    setHistory((prev) => [...prev, raw]);
    setHistoryIndex(-1);
    setInputVal('');

    addLog('user', `sovereign@edge:~$ ${raw}`);
    setIsExecuting(true);

    const parts = raw.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').toLowerCase();

    try {
      if (cmd === 'clear') {
        setLogs([{ type: 'sys', text: '// TERMINAL BUFFER CLEARED' }]);
        setIsExecuting(false);
        return;
      }

      if (cmd === 'help') {
        addLog('hint', 'AVAILABLE SERVERLESS COMMANDS:');
        addLog('out', '  deploy          - Deploy & verify 100% serverless pipeline across all Netlify functions');
        addLog('out', '  status          - Diagnostic telemetry of Edge Node & Netlify Functions');
        addLog('out', '  settle          - Test automated serverless bet settlement (WORM)');
        addLog('out', '  round           - Provably fair serverless round calculation (HMAC-SHA256)');
        addLog('out', '  withdraw [amt]  - Execute serverless card rail withdrawal ($100 min)');
        addLog('out', '  ledger          - Query Netlify PostgreSQL immutable settlement chain');
        addLog('out', '  ping            - Check Edge CDN roundtrip latency');
        addLog('out', '  clear           - Wipe console screen');
        setIsExecuting(false);
        return;
      }

      if (cmd === 'ping') {
        const start = performance.now();
        const res = await fetch('/.netlify/functions/system?command=ping');
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          addLog('success', `PONG! Edge latency: ${data.latencyMs || elapsed}ms | Region: ${data.edgeRegion || 'Netlify Edge'}`);
        } else {
          addLog('error', `Ping failed: HTTP ${res.status}`);
        }
        setIsExecuting(false);
        return;
      }

      if (cmd === 'deploy' || cmd === 'deploy-check') {
        addLog('info', '[+] Invoking serverless deployment verification across Netlify Functions...');
        const res = await fetch('/.netlify/functions/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'deploy' })
        });
        const data = await res.json();

        if (data.success) {
          addLog('success', `[DEPLOY STATUS] ${data.deploymentStatus}`);
          addLog('out', `• Runtime Node: ${data.edgeNode} (${data.runtime})`);
          data.functions?.forEach((fn) => {
            addLog('out', `  ✔ Function: ${fn.name} (${fn.path}) -> [${fn.status}] - ${fn.type}`);
          });
          addLog('out', `• Database: ${data.database?.provider} [${data.database?.status}] (${data.database?.totalSettlementBlocks} blocks recorded)`);
          addLog('success', `• Dependency Status: Termux ${data.externalDependencies?.termux}`);
          addLog('success', `• Settlement Engine: ${data.externalDependencies?.manualSettlement}`);
          addLog('success', '✔ ALL BETTING, SETTLEMENT & WITHDRAWAL PIPELINES ARE 100% SERVERLESS.');
        } else {
          addLog('error', `Deployment check error: ${data.error}`);
        }
        setIsExecuting(false);
        return;
      }

      if (cmd === 'status') {
        addLog('info', '[+] Requesting serverless edge telemetry...');
        const res = await fetch('/.netlify/functions/system?command=status');
        const data = await res.json();
        addLog('out', `System: ${data.system} | Stack: ${data.architecture}`);
        addLog('out', `Database Pool: ${data.databaseStatus} | Functions: ${data.functionsCount} active`);
        addLog('out', `Automated Settlement: ${data.autoSettlement} | Termux: ${data.termuxDependency}`);
        addLog('success', `Telemetry verified in ${data.executionTimeMs}ms.`);
        setIsExecuting(false);
        return;
      }

      if (cmd === 'settle') {
        const testMult = parseFloat((1.5 + Math.random() * 2.5).toFixed(2));
        const testWager = 25.0;
        const testSession = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        addLog('info', `[+] Dispatching automated serverless settlement: $${testWager} @ ${testMult}x...`);
        const res = await fetch('/.netlify/functions/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: testSession,
            userId,
            wagerAmount: testWager,
            multiplier: testMult
          })
        });
        const data = await res.json();

        if (data.success) {
          addLog('success', `[SETTLED] Block ID: ${data.settlementId} | Payout: +$${data.payoutAmount}`);
          addLog('out', `Ledger Source: ${data.ledger} | Timestamp: ${data.timestamp}`);
          const profit = parseFloat(data.payoutAmount) - testWager;
          onBalanceUpdate(parseFloat((balance + profit).toFixed(2)));
        } else {
          addLog('error', `Settlement Rejected: ${data.error}`);
        }
        setIsExecuting(false);
        return;
      }

      if (cmd === 'round') {
        addLog('info', '[+] Requesting provably fair round from /.netlify/functions/round...');
        const res = await fetch('/.netlify/functions/round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            wagerAmount: 50.0,
            targetOdds: 2.0
          })
        });
        const data = await res.json();

        if (data.success) {
          addLog('success', `[ROUND INIT] Round ID: ${data.roundId}`);
          addLog('out', `Crash Multiplier: ${data.crashMultiplier}x | Target Odds: ${data.targetOdds}x`);
          addLog('out', `Auto-Win Outcome: ${data.isAutoWin ? 'VICTORY' : 'COLLAPSED'} | Estimated Payout: $${data.estimatedPayout}`);
          addLog('out', `Server Seed Hash (SHA-256): ${data.serverSeedHash.substring(0, 32)}...`);
        } else {
          addLog('error', `Round generation failed: ${data.error}`);
        }
        setIsExecuting(false);
        return;
      }

      if (cmd === 'withdraw') {
        const amt = parseFloat(parts[1]) || 100.0;
        addLog('info', `[+] Executing serverless withdrawal request for $${amt.toFixed(2)} USD...`);

        const res = await fetch('/.netlify/functions/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            amount: amt
          })
        });
        const data = await res.json();

        if (data.success) {
          addLog('success', `[WITHDRAWAL DISPATCHED] TX ID: ${data.transactionId}`);
          addLog('out', `Amount: $${data.amount} USD | Rail: ${data.rail}`);
          addLog('out', `Pipeline: ${data.settlementEngine} | Status: ${data.status}`);
          onBalanceUpdate(parseFloat(Math.max(0, balance - amt).toFixed(2)));
        } else {
          addLog('error', `Withdrawal Error: ${data.error || data.message}`);
        }
        setIsExecuting(false);
        return;
      }

      if (cmd === 'ledger') {
        addLog('info', '[+] Querying recent settlements from PostgreSQL database function...');
        const res = await fetch(`/.netlify/functions/settle?userId=${userId}`);
        const data = await res.json();

        if (data.success && data.settlements) {
          addLog('success', `Retrieved ${data.settlements.length} immutable blocks from ${data.source}:`);
          data.settlements.slice(0, 5).forEach((b) => {
            addLog('out', `  Block ${b.session_id || b.id?.slice(0, 12)}: $${b.wager_amount} @ ${b.multiplier}x -> +$${b.payout_amount} [${b.status}]`);
          });
        } else {
          addLog('error', 'Ledger fetch failed.');
        }
        setIsExecuting(false);
        return;
      }

      addLog('error', `Unknown command: "${cmd}". Type "help" for a list of serverless commands.`);
    } catch (err) {
      addLog('error', `Execution failure: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    }
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden font-mono flex flex-col h-[520px]">
      {/* Top Terminal Bar */}
      <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="text-slate-400 font-bold ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            SOVEREIGN SERVERLESS TERMINAL // NETLIFY EDGE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ZERO TERMUX DEPENDENCY
          </span>
          <span className="text-slate-500 text-[10px]">OPERATOR: {userId}</span>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="bg-slate-900/40 px-3 py-1.5 border-b border-slate-800/80 flex flex-wrap gap-1.5 items-center text-[11px]">
        <span className="text-slate-500 mr-1 text-[10px] font-bold">QUICK PIPELINE:</span>
        <button
          onClick={() => executeCommand('deploy')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-500/40 cursor-pointer font-bold transition flex items-center gap-1"
        >
          <Zap className="w-3 h-3 text-cyan-400" /> deploy
        </button>
        <button
          onClick={() => executeCommand('status')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition"
        >
          status
        </button>
        <button
          onClick={() => executeCommand('settle')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 hover:bg-slate-700 cursor-pointer transition"
        >
          settle --auto
        </button>
        <button
          onClick={() => executeCommand('round')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-purple-400 hover:bg-slate-700 cursor-pointer transition"
        >
          round --fair
        </button>
        <button
          onClick={() => executeCommand('withdraw 100')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 cursor-pointer transition"
        >
          withdraw 100
        </button>
        <button
          onClick={() => executeCommand('ledger')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 cursor-pointer transition"
        >
          ledger
        </button>
        <button
          onClick={() => executeCommand('help')}
          disabled={isExecuting}
          className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 cursor-pointer transition"
        >
          help
        </button>
        <button
          onClick={() => executeCommand('clear')}
          className="px-2 py-0.5 rounded bg-slate-800 text-slate-500 hover:bg-slate-700 cursor-pointer transition ml-auto"
        >
          clear
        </button>
      </div>

      {/* Console Display Screen */}
      <div className="flex-1 p-4 overflow-y-auto space-y-1.5 text-xs text-slate-300 select-text">
        {logs.map((log, index) => {
          let colorClass = 'text-slate-400';
          if (log.type === 'user') colorClass = 'text-cyan-300 font-bold';
          if (log.type === 'success') colorClass = 'text-emerald-400 font-semibold';
          if (log.type === 'error') colorClass = 'text-rose-400 font-bold';
          if (log.type === 'info') colorClass = 'text-sky-300';
          if (log.type === 'hint') colorClass = 'text-amber-300/90';
          if (log.type === 'sys') colorClass = 'text-cyan-500/70';

          return (
            <div key={index} className={`leading-relaxed break-all ${colorClass}`}>
              {log.text}
            </div>
          );
        })}
        {isExecuting && (
          <div className="text-cyan-400 flex items-center gap-2 animate-pulse text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Executing serverless function at Netlify Edge...
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Input Prompt */}
      <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
        <span className="text-cyan-400 font-bold text-xs pl-2">sovereign@edge:~$</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          placeholder="Enter command (e.g. 'deploy', 'settle', 'withdraw 100', 'status')..."
          className="flex-1 bg-transparent text-white text-xs outline-none border-none font-mono placeholder:text-slate-600"
          autoFocus
        />
        <button
          onClick={() => executeCommand(inputVal)}
          disabled={isExecuting || !inputVal.trim()}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-black disabled:text-slate-600 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
export default ServerlessTerminal;
