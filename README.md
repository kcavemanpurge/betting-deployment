# Sovereign Betting Deployment // Edge Settlement Engine

A high-performance sovereign betting simulation and low-latency edge settlement platform built on Netlify Edge CDN, Netlify Functions, and PostgreSQL (Netlify Database / Drizzle ORM).

## System Architecture

| Component | Target Hosting / Environment | Tooling & Build Command |
|---|---|---|
| **Frontend Simulation** | Netlify Edge CDN | Vite + React + HTML5 Canvas (`npm run build`) |
| **Edge Backend / API** | Netlify Functions (`netlify/functions/settle.js`) | Node.js Edge Runtime (Serverless) |
| **Immutable Ledger** | PostgreSQL Managed Database | Drizzle ORM + Connection Pooler |
| **Mobile Deployment Node** | Termux / Mobile Shell | Git CLI + Netlify CLI (`deploy.sh`) |

## Key Capabilities

1. **Deterministic HTML5 Vector Simulation Engine**:
   - Zero-latency Canvas trajectory graph with dynamic scanlines, acceleration curve, and real-time multiplier calculations.
   - Procedural Web Audio API sound generator with zero external asset dependencies (synthesized sine-wave climb, dual-harmonic settlement chord, white-noise glitch on vector collapse).
   - Configurable stakes ($10, $25, $50, $100, $250, or custom) and automated cashout triggers.

2. **Atomic Edge Settlement Handler (`/.netlify/functions/settle`)**:
   - WORM (Write Once, Read Many) settlement gatekeeper.
   - Strict `FOR UPDATE` transaction locks enforcing single-session idempotency and eliminating double-settlement vectors.
   - Auto-computed generated payout column (`payout_amount = wager_amount * multiplier`) at the database layer.

3. **PostgreSQL Immutable Settlement Ledger**:
   - Drizzle ORM schema defined in `db/schema.ts`.
   - Pre-compiled deploy-time SQL migrations in `netlify/database/migrations/`.
   - Indexing on `(user_id, status)` for sub-millisecond query execution.
   - Standalone `schema.sql` at repository root for raw console execution.

4. **Mobile Terminal Node Dispatch**:
   - Automated `deploy.sh` script for Termux / mobile git staging and push to Netlify.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate database migrations
npm run db:generate

# Migrate repository to a new GitHub account
npm run migrate:repo
```

## Repository Migration

To mirror all commit history, branches, and tags to a new GitHub account:

1. Create a fresh, empty repository in your target GitHub account (do not initialize with README, `.gitignore`, or license).
2. Execute the helper script:
   ```bash
   npm run migrate:repo
   # or directly with parameters:
   ./scripts/migrate-repo.sh <OLD_ACCOUNT> <NEW_ACCOUNT>
   ```
3. Re-link the repository in your Netlify site settings under **Project Settings > Build & Deploy > Continuous Deployment > Repository**.

## Directory Structure

```
├── db/
│   ├── index.ts        # Drizzle ORM Netlify Database client
│   └── schema.ts       # Database table definitions
├── netlify/
│   ├── database/
│   │   └── migrations/ # Automated deploy-time migrations
│   └── functions/
│       └── settle.js   # WORM edge settlement endpoint
├── src/
│   ├── components/
│   │   └── BettingCanvas.jsx # HTML5 Canvas trajectory & bet engine
│   ├── utils/
│   │   └── audio.js    # Web Audio API procedural sound synthesizer
│   ├── App.jsx         # Sovereign terminal dashboard & ledger view
│   ├── index.css       # Tailwind CSS & CRT vector glow styling
│   └── main.jsx        # Application root mount
├── deploy.sh           # Termux mobile deployment script
├── drizzle.config.ts   # Drizzle Kit configuration
├── netlify.toml        # Netlify build & functions configuration
├── schema.sql          # Direct PostgreSQL initialization script
└── vite.config.js      # Vite build & Tailwind configuration
```
