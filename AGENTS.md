# AGENTS.md // Sovereign Betting Deployment Architecture Guide

This guide is for AI agents maintaining, extending, or operating the Sovereign Betting Deployment codebase.

## System Overview

The system is a sovereign, provably fair betting simulation and atomic settlement engine designed for Netlify Edge hosting, Netlify Functions (100% serverless), and Netlify Database (PostgreSQL).

## Key Files & Responsibilities

- **`src/components/AviatorEngine.jsx`**: Automated Aviator betting engine featuring automated auto-lock settlement on target odds, hands-free continuous loop mode, instant auto-settle triggers, and integrated serverless withdrawal card rail portal ($100 minimum threshold).
- **`src/components/BettingCanvas.jsx`**: Core vector simulation component. Renders the quadratic vector trajectory curve on an HTML5 `<canvas>`, calculates acceleration, and dispatches automated atomic settlement payloads to `/.netlify/functions/settle`.
- **`src/components/ServerlessTerminal.jsx`**: In-app sovereign serverless terminal allowing operators to deploy, verify, and inspect all Netlify Functions, execute diagnostic checks, test round calculations, and manage ledger transactions without any external shell or Termux dependency.
- **`src/utils/audio.js`**: Synthesizes sound using the browser's native `AudioContext`. Requires zero external MP3/WAV assets, eliminating network latency or broken asset 404s.
- **`src/App.jsx`**: Main cockpit interface featuring simulation controls, in-app serverless terminal, balance management, operator identity switcher, live immutable ledger table, and environment map monitors.
- **`netlify/functions/settle.js`**: Serverless function serving both `POST` (atomic bet settlement) and `GET` (retrieving the recent settlement ledger). Uses `@netlify/database` connection pool with Neon serverless fallback.
- **`netlify/functions/withdraw.js`**: Serverless function executing automated card rail withdrawals with enforced $100 minimum floor and immutable transaction receipts.
- **`netlify/functions/round.js`**: Serverless HMAC-SHA256 provably fair round generator that deterministically calculates crash multipliers and verifies auto-win conditions.
- **`netlify/functions/system.js`**: Serverless node diagnostics and command execution endpoint backing the in-app cockpit terminal.
- **`db/schema.ts`**: Canonical Drizzle ORM schema defining the `bet_settlements` table.
- **`netlify/database/migrations/`**: Generated migration files automatically applied by Netlify during deployment.
- **`schema.sql`**: Raw PostgreSQL script matching `db/schema.ts` for direct database console injection.

## Critical Design Conventions

1. **Database Adapter & Drizzle Beta Tag**:
   Netlify Database adapter requires `drizzle-orm@beta` and `drizzle-kit@beta`. Do not install standard latest versions without the beta tag or Drizzle Netlify adapter imports will break.

2. **Settlement Idempotency (WORM)**:
   The `session_id` column on `bet_settlements` has a `UNIQUE` constraint. `settle.js` begins a transaction, checks `SELECT id FROM bet_settlements WHERE session_id = $1 FOR UPDATE`, and aborts with HTTP 409 if already settled.

3. **Tamper-Proof Payout Calculation**:
   The `payout_amount` column is defined as `GENERATED ALWAYS AS (wager_amount * multiplier) STORED`. Payouts are computed mathematically by PostgreSQL itself, preventing client-side or payload manipulation.

4. **100% Serverless Architecture**:
   All betting, settlement, round generation, and card rail withdrawals run via Netlify Functions. External terminal shells such as Termux and manual client-side settlement interventions are eliminated.
