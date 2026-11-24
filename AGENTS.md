# AGENTS.md // Sovereign Betting Deployment Architecture Guide

This guide is for AI agents maintaining, extending, or operating the Sovereign Betting Deployment codebase.

## System Overview

The system is a sovereign, provably fair betting simulation and atomic settlement engine designed for Netlify Edge hosting, Netlify Functions (100% serverless), and Netlify Database (PostgreSQL).

## Key Files & Responsibilities

- **`src/components/AviatorEngine.jsx`**: Automated Aviator betting engine featuring calm-down pre-flight countdowns (5s or 3s selector), operator/Ella betting unlock mechanism, automated auto-lock settlement on target odds, hands-free continuous loop mode, instant auto-settle triggers, and integrated serverless withdrawal card rail portal ($100 minimum threshold).
- **`src/components/BettingCanvas.jsx`**: Core vector simulation component. Renders the quadratic vector trajectory curve on an HTML5 `<canvas>`, calculates acceleration, and dispatches automated atomic settlement payloads to `/.netlify/functions/settle`.
- **`src/components/Top5FootballSim.jsx`**: Interactive 2026/2027 European Top 5 football league simulator (EPL, La Liga, Serie A, Bundesliga, Ligue 1) with real-time match engine and standings persistence.
- **`src/components/LiveOddsPortal.jsx`**: Cockpit interface fetching and displaying live verified head-to-head market odds from `/.netlify/functions/live-odds` for top European football fixtures, linked to Netlify Odds Wallet `4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m`.
- **`src/components/ServerlessTerminal.jsx`**: In-app sovereign serverless terminal allowing operators to deploy, verify, and inspect all Netlify Functions, execute diagnostic checks, test round calculations, and manage ledger transactions without any external shell or Termux dependency.
- **`src/utils/audio.js`**: Synthesizes sound using the browser's native `AudioContext`, including countdown ticks (`playCountdownTick`), takeoff whoosh (`playLaunchWhoosh`), climb frequency shifts, cashout chords, and collapse noise bursts.
- **`src/App.jsx`**: Main cockpit interface featuring simulation controls, operator identity switcher (including Ella), in-app serverless terminal, Top 5 Football 26/27 simulator, Live Sports Odds portal, balance management, live immutable ledger table, and environment map monitors.
- **`server/services/unifiedSettlementService.ts`**: Unified cross-chain settlement engine supporting HOT_WALLET, SOLANA, and SMART_CHAIN rails with transactional logging to `financial_ledger` and `user_balances`.
- **`netlify/functions/live-odds.ts`**: Serverless function querying The-Odds-API for real-time sports odds across UK, EU, and US bookmakers with configured odds wallet routing.
- **`netlify/functions/settle.js`**: Serverless function serving both `POST` (atomic bet settlement) and `GET` (retrieving the recent settlement ledger). Uses `@netlify/database` connection pool with Neon serverless fallback.
- **`netlify/functions/withdraw.js`**: Serverless function executing automated card rail withdrawals with enforced $100 minimum floor and immutable transaction receipts.
- **`netlify/functions/round.js`**: Serverless HMAC-SHA256 provably fair round generator that deterministically calculates crash multipliers and verifies auto-win conditions.
- **`netlify/functions/system.js`**: Serverless node diagnostics and command execution endpoint backing the in-app cockpit terminal.
- **`db/schema.ts`**: Canonical Drizzle ORM schema defining `bet_settlements`, `financial_ledger`, `user_balances`, `football_leagues_2627`, `football_teams_2627`, and `football_sim_matches_2627`.
- **`netlify/database/migrations/`**: Generated migration files automatically applied by Netlify during deployment.
- **`top5_2026_27_football.sql`**: Complete SQL schema and seed data for the 2026/2027 season for EPL, La Liga, Serie A, Bundesliga, and Ligue 1.
- **`top5-football.html`**: Standalone browser simulation engine for the Top 5 football leagues with persisted localStorage standings and live match logs.

## Critical Design Conventions

1. **Database Adapter & Drizzle Beta Tag**:
   Netlify Database adapter requires `drizzle-orm@beta` and `drizzle-kit@beta`. Do not install standard latest versions without the beta tag or Drizzle Netlify adapter imports will break.

2. **Settlement Idempotency (WORM)**:
   The `session_id` column on `bet_settlements` has a `UNIQUE` constraint. `settle.js` begins a transaction, checks `SELECT id FROM bet_settlements WHERE session_id = $1 FOR UPDATE`, and aborts with HTTP 409 if already settled.

3. **Tamper-Proof Payout Calculation**:
   The `payout_amount` column is defined as `GENERATED ALWAYS AS (wager_amount * multiplier) STORED`. Payouts are computed mathematically by PostgreSQL itself, preventing client-side or payload manipulation.

4. **Calm-Down Pre-Flight Countdown Engine**:
   Before flight takeoff and after round completion, a configurable (5s or 3s) calm-down countdown provides a dedicated window where betting is unlocked for operators (including Ella) to arm and adjust stakes before the flight project takes off.

5. **100% Serverless Architecture**:
   All betting, settlement, round generation, live odds telemetry, and card rail withdrawals run via Netlify Functions. External terminal shells such as Termux and manual client-side settlement interventions are eliminated.
