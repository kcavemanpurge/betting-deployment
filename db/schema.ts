import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
  text,
  integer,
  serial,
  bigserial,
  jsonb,
  unique,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const betSettlements = pgTable(
  "bet_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    wagerAmount: numeric("wager_amount", { precision: 12, scale: 2 }).notNull(),
    multiplier: numeric("multiplier", { precision: 8, scale: 4 }).notNull(),
    payoutAmount: numeric("payout_amount", { precision: 12, scale: 2 })
      .generatedAlwaysAs(sql`${pgTable} ? wager_amount * multiplier : wager_amount * multiplier`)
      .$type<string>(),
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

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: varchar("user_id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    kycHash: varchar("kyc_hash", { length: 128 }).notNull().unique(),
    withdrawalWallet: varchar("withdrawal_wallet", { length: 128 }).notNull(),
    kycLocked: boolean("kyc_locked").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const userBalances = pgTable(
  "user_balances",
  {
    userId: varchar("user_id", { length: 64 }).primaryKey(),
    promoBalance: numeric("promo_balance", { precision: 14, scale: 4 }).notNull().default("0"),
    profitBalance: numeric("profit_balance", { precision: 14, scale: 4 }).notNull().default("0"),
    dailySpendUsed: numeric("daily_spend_used", { precision: 14, scale: 4 }).notNull().default("0"),
    spendDate: date("spend_date").notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

export const betHistory = pgTable(
  "bet_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    marketType: varchar("market_type", { length: 24 }).notNull(),
    stakeAmount: numeric("stake_amount", { precision: 14, scale: 4 }).notNull(),
    usedPromo: numeric("used_promo", { precision: 14, scale: 4 }).notNull().default("0"),
    usedProfit: numeric("used_profit", { precision: 14, scale: 4 }).notNull().default("0"),
    oddsOrMultiplier: numeric("odds_or_multiplier", { precision: 10, scale: 4 }).notNull(),
    payoutAmount: numeric("payout_amount", { precision: 14, scale: 4 }).notNull().default("0"),
    outcome: varchar("outcome", { length: 20 }).notNull().default("PENDING"),
    selections: jsonb("selections").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_bet_history_user").on(table.userId, table.createdAt),
  ]
);

export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    rail: varchar("rail", { length: 24 }).notNull(),
    userWallet: varchar("user_wallet", { length: 128 }).notNull(),
    settlementWallet: varchar("settlement_wallet", { length: 128 })
      .notNull()
      .default("4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m"),
    contractOrProgramRef: varchar("contract_or_program_ref", { length: 160 }),
    status: varchar("status", { length: 32 }).notNull().default("PENDING_MANUAL_APPROVAL"),
    txRef: varchar("tx_ref", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_withdrawal_requests_user").on(table.userId, table.status),
  ]
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
    rating: integer("rating").notNull().default(75),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    points: integer("points").notNull().default(0),
  },
  (table) => [
    unique("uq_league_team").on(table.leagueCode, table.teamName),
  ]
);

export const footballMatches2627 = pgTable(
  "football_matches_2627",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    leagueCode: text("league_code").notNull().references(() => footballLeagues2627.leagueCode),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeGoals: integer("home_goals").notNull(),
    awayGoals: integer("away_goals").notNull(),
    oddsWallet: text("odds_wallet").notNull().default("4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export type BetSettlement = typeof betSettlements.$inferSelect;
export type NewBetSettlement = typeof betSettlements.$inferInsert;
export type FinancialLedger = typeof financialLedger.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserBalance = typeof userBalances.$inferSelect;
export type BetHistoryRecord = typeof betHistory.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type FootballLeague = typeof footballLeagues2627.$inferSelect;
export type FootballTeam = typeof footballTeams2627.$inferSelect;
export type FootballMatch = typeof footballMatches2627.$inferSelect;
