CREATE TABLE "financial_ledger" (
	"id" bigserial PRIMARY KEY,
	"user_id" varchar(64) NOT NULL,
	"entry_type" varchar(32) NOT NULL,
	"amount" numeric(14,4) NOT NULL,
	"hot_wallet_address" text,
	"gas_fee_paid" numeric(14,8) DEFAULT '0',
	"tx_hash" text NOT NULL,
	"status" varchar(20) DEFAULT 'CONFIRMED' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "football_leagues_2627" (
	"league_code" text PRIMARY KEY,
	"league_name" text NOT NULL,
	"country" text NOT NULL,
	"season" text DEFAULT '2026/2027' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "football_sim_matches_2627" (
	"id" bigserial PRIMARY KEY,
	"league_code" text NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_goals" integer NOT NULL,
	"away_goals" integer NOT NULL,
	"odds_wallet" text DEFAULT '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m' NOT NULL,
	"simulated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "football_teams_2627" (
	"id" serial PRIMARY KEY,
	"league_code" text NOT NULL,
	"team_name" text NOT NULL,
	"sim_rating" integer DEFAULT 75 NOT NULL,
	"sim_wins" integer DEFAULT 0 NOT NULL,
	"sim_draws" integer DEFAULT 0 NOT NULL,
	"sim_losses" integer DEFAULT 0 NOT NULL,
	"sim_points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uq_league_team" UNIQUE("league_code","team_name")
);
--> statement-breakpoint
CREATE TABLE "user_balances" (
	"user_id" varchar(64) PRIMARY KEY,
	"available_balance" numeric(14,2) DEFAULT '1000.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_financial_ledger_user" ON "financial_ledger" ("user_id","entry_type");--> statement-breakpoint
ALTER TABLE "football_sim_matches_2627" ADD CONSTRAINT "football_sim_matches_2627_5Wcc0U4Eeeek_fkey" FOREIGN KEY ("league_code") REFERENCES "football_leagues_2627"("league_code");--> statement-breakpoint
ALTER TABLE "football_teams_2627" ADD CONSTRAINT "football_teams_2627_LTBUOIMab4At_fkey" FOREIGN KEY ("league_code") REFERENCES "football_leagues_2627"("league_code");