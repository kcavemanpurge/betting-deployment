import { pgTable, uuid, varchar, numeric, timestamp, index } from "drizzle-orm/pg-core";

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

export type BetSettlement = typeof betSettlements.$inferSelect;
export type NewBetSettlement = typeof betSettlements.$inferInsert;
