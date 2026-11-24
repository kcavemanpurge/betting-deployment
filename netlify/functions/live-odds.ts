import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  index,
  date,
} from "drizzle-orm/pg-core";

export const sportsEvents = pgTable(
  "sports_events",
  {
    eventId: text("event_id").primaryKey(),
    sportKey: text("sport_key").notNull(),
    sportTitle: text("sport_title").notNull(),
    category: text("category").notNull().default("SPORTS"), // 'SPORTS' | 'LIVE' | 'VIRTUAL'
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    commenceTime: timestamp("commence_time", { withTimezone: true }).notNull(),
    isLive: boolean("is_live").notNull().default(false),
    status: text("status").notNull().default("SCHEDULED"), // 'SCHEDULED' | 'LIVE' | 'FINISHED'
    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),
    topPickRank: integer("top_pick_rank"),
    settlementWallet: text("settlement_wallet")
      .notNull()
      .default("4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m"),
    rawPayload: jsonb("raw_payload").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sports_events_sport_live").on(table.sportKey, table.isLive),
    index("idx_sports_events_top_pick").on(table.topPickRank),
  ]
);

export const eventMarkets = pgTable(
  "event_markets",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => sportsEvents.eventId, { onDelete: "cascade" }),
    marketKey: text("market_key").notNull(), // 'H2H' | 'DOUBLE_CHANCE' | 'OVER_UNDER' | 'BTTS'
    marketLabel: text("market_label").notNull(),
    lineValue: numeric("line_value", { precision: 6, scale: 2 }),
    outcomes: jsonb("outcomes").notNull().default([]), // [{ code, label, odds }]
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_event_markets_event").on(table.eventId, table.marketKey),
  ]
);

export const eventHistoryDaily = pgTable(
  "event_history_daily",
  {
    id: text("id").primaryKey(),
    archiveDate: date("archive_date").notNull().defaultNow(),
    eventId: text("event_id").notNull(),
    sportKey: text("sport_key").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    finalHomeScore: integer("final_home_score").notNull().default(0),
    finalAwayScore: integer("final_away_score").notNull().default(0),
    marketsSnapshot: jsonb("markets_snapshot").notNull().default([]),
    settlementWallet: text("settlement_wallet")
      .notNull()
      .default("4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_event_history_date_sport").on(table.archiveDate, table.sportKey),
  ]
);
