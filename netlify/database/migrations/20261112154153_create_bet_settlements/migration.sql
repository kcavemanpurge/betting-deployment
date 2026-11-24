CREATE TABLE IF NOT EXISTS "bet_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" varchar(64) NOT NULL UNIQUE,
	"user_id" varchar(64) NOT NULL,
	"wager_amount" numeric(12, 2) NOT NULL CHECK (wager_amount >= 0),
	"multiplier" numeric(8, 4) NOT NULL CHECK (multiplier >= 1.0000),
	"payout_amount" numeric(12, 2) GENERATED ALWAYS AS (wager_amount * multiplier) STORED,
	"status" varchar(20) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'REJECTED')),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_settlements" ON "bet_settlements" ("user_id", "status");
