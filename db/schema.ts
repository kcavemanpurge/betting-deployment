import { pgTable, uuid, varchar, numeric, timestamp, index, text, integer, serial, bigserial, jsonb, unique } from "drizzle-orm/pg-core";

export const betSettlements = pgTable(
  "bet_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    wagerAmount: numeric("wager_amount", { precision: 12, scale: 2 }).notNull(),
    multiplier: numeric("multiplier", { precision: 8, scale: 4 }).notNull(),
    payoutAmount: numeric("payout_amount", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 20 }).notNull().default("SETTLED"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_user_settlements").on(table.userId, table.status),
  ]
);

export const financialLedger = pgTable(
  "financial_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    entryType: varchar("entry_type", { length: 32 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    hotWalletAddress: text("hot_wallet_address"),
    gasFeePaid: numeric("gas_fee_paid", { precision: 14, scale: 8 }).default("0"),
    txHash: text("tx_hash").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("CONFIRMED"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_financial_ledger_user").on(table.userId, table.entryType),
  ]
);

export const userBalances = pgTable(
  "user_balances",
  {
    userId: varchar("user_id", { length: 64 }).primaryKey(),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }).notNull().default("1000.00"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

export const footballLeagues2627 = pgTable(
  "football_leagues_2627",
  {
    leagueCode: text("league_code").primaryKey(),
    leagueName: text("league_name").notNull(),
    country: text("country").notNull(),
    season: text("season").notNull().default("2026/2027"),
  }
);

export const footballTeams2627 = pgTable(
  "football_teams_2627",
  {
    id: serial("id").primaryKey(),
    leagueCode: text("league_code").notNull().references(() => footballLeagues2627.leagueCode),
    teamName: text("team_name").notNull(),
    simRating: integer("sim_rating").notNull().default(75),
    simWins: integer("sim_wins").notNull().default(0),
    simDraws: integer("sim_draws").notNull().default(0),
    simLosses: integer("sim_losses").notNull().default(0),
    simPoints: integer("sim_points").notNull().default(0),
  },
  (table) => [
    unique("uq_league_team").on(table.leagueCode, table.teamName),
  ]
);

export const footballSimMatches2627 = pgTable(
  "football_sim_matches_2627",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    leagueCode: text("league_code").notNull().references(() => footballLeagues2627.leagueCode),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeGoals: integer("home_goals").notNull(),
    awayGoals: integer("away_goals").notNull(),
    oddsWallet: text("odds_wallet").notNull().default("4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m"),
    simulatedAt: timestamp("simulated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export type BetSettlement = typeof betSettlements.$inferSelect;
export type NewBetSettlement = typeof betSettlements.$inferInsert;
export type FinancialLedger = typeof financialLedger.$inferSelect;
export type UserBalance = typeof userBalances.$inferSelect;
export type FootballLeague = typeof footballLeagues2627.$inferSelect;
export type FootballTeam = typeof footballTeams2627.$inferSelect;
export type FootballSimMatch = typeof footballSimMatches2627.$inferSelect;
