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
