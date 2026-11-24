-- Core settlement ledger for zero-friction bet processing
CREATE TABLE IF NOT EXISTS bet_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    wager_amount NUMERIC(12, 2) NOT NULL CHECK (wager_amount >= 0),
    multiplier NUMERIC(8, 4) NOT NULL CHECK (multiplier >= 1.0000),
    payout_amount NUMERIC(12, 2) GENERATED ALWAYS AS (wager_amount * multiplier) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_settlements ON bet_settlements(user_id, status);

-- Unified settlement and cross-chain financial ledger
CREATE TABLE IF NOT EXISTS financial_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 4) NOT NULL,
    hot_wallet_address TEXT,
    gas_fee_paid NUMERIC(14, 8) DEFAULT 0,
    tx_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_user ON financial_ledger(user_id, entry_type);

-- User balances table for multi-rail accounting
CREATE TABLE IF NOT EXISTS user_balances (
    user_id VARCHAR(64) PRIMARY KEY,
    available_balance NUMERIC(14, 2) NOT NULL DEFAULT 1000.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Top 5 Football Leagues (2026/2027) tables
CREATE TABLE IF NOT EXISTS football_leagues_2627 (
  league_code TEXT PRIMARY KEY,
  league_name TEXT NOT NULL,
  country TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2026/2027'
);

CREATE TABLE IF NOT EXISTS football_teams_2627 (
  id SERIAL PRIMARY KEY,
  league_code TEXT NOT NULL REFERENCES football_leagues_2627(league_code),
  team_name TEXT NOT NULL,
  sim_rating INTEGER NOT NULL DEFAULT 75,
  sim_wins INTEGER NOT NULL DEFAULT 0,
  sim_draws INTEGER NOT NULL DEFAULT 0,
  sim_losses INTEGER NOT NULL DEFAULT 0,
  sim_points INTEGER NOT NULL DEFAULT 0,
  UNIQUE (league_code, team_name)
);

CREATE TABLE IF NOT EXISTS football_sim_matches_2627 (
  id BIGSERIAL PRIMARY KEY,
  league_code TEXT NOT NULL REFERENCES football_leagues_2627(league_code),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  odds_wallet TEXT NOT NULL DEFAULT '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m',
  simulated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
