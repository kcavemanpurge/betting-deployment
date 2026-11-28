# Sovereign Betting & Financial Settlement Platform

A high-performance sovereign betting engine, 5-league virtual sports simulator, and low-latency financial settlement platform built on Netlify Edge CDN, Netlify Serverless Functions, PostgreSQL (Neon / Netlify Database), and Stripe Issuing.

## System Architecture

| Component | Target Hosting / Environment | Tooling & Build Command |
|---|---|---|
| **Frontend Simulation** | Netlify Edge CDN | Vite + React + HTML5 Canvas (`npm run build`) |
| **Serverless Functions** | Netlify Functions (`netlify/functions/`) | Node.js / TypeScript Serverless Engine |
| **Financial & Bet Ledger** | PostgreSQL Managed Database | Drizzle ORM + Connection Pooler |
| **Card Issuing & Wallet** | Stripe API Rails | Virtual Visa/MasterCard Provisioning |
| **Mobile Deployment Node** | Termux / AlmaLinux Container | Git CLI + Netlify CLI (`deploy.sh`) |

## Key Capabilities

1. **Deterministic HTML5 Aviator & Flight Arena**:
   - Zero-latency Canvas trajectory graph with dynamic scanlines, acceleration curve, and real-time multiplier calculations.
   - Procedural Web Audio API sound generator with zero external asset dependencies (synthesized sine-wave climb, dual-harmonic settlement chord, white-noise glitch on vector collapse).
   - Dual-vector betting (`VECTOR 01` manual cashout & `VECTOR 02` auto-cashout triggers).

2. **5-League Virtual Football Simulator (`virtualFiveLeagueSim.ts`)**:
   - Seeded, deterministic multi-league match sequence generator independent of external odds APIs.
   - Team rating matrix (`sim_rating`), scoreline evaluator (`home_goals` vs. `away_goals`), and automated standings updater across `football_leagues_2627` and `football_teams_2627`.

3. **Stripe Issuing & Vault Financial Ledger**:
   - Real-time virtual card provisioning and 3DS verification handling (`stripe-wallet.js`, `stripe-webhook.js`).
   - Unified balance breakdown tracking `promo_balance` ($1,000 grant allocation) vs. `profit_balance` (eligible settled winnings).
   - Solana / Smart Chain withdrawal ledger with explicit `user_wallet` capture, idempotency keys, and `PENDING_MANUAL_APPROVAL` audit queue.

4. **Atomic Backend Settlement Engine (`netlify/functions/settle.js`)**:
   - Server-side WORM (Write Once, Read Many) settlement gatekeeper.
   - Strict `FOR UPDATE` PostgreSQL transaction locks enforcing single-session idempotency and eliminating double-settlement vectors.
   - Auto-computed payout execution updating `bet_settlements`, `financial_ledger`, and `user_balances`.

5. **Deploy-Time Database Migrations**:
   - Pre-compiled Drizzle ORM migrations under `netlify/database/migrations/`.
   - Dual-version schema migrations (`create_bet_settlements` and `add_unified_settlement_and_football`).
   - Indexes on `(user_id, status)` and `(user_id, entry_type)` for sub-millisecond query performance.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate database migrations via Drizzle Kit
npm run db:generate

# Execute database migrations
npm run db:migrate

# Mirror repository across accounts
npm run migrate:repo