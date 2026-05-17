import { pgTable, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const appState = pgTable("app_state", {
  id: text("id").primaryKey(),
  text: text("text"),
  canvas: jsonb("canvas"),
  version: integer("version").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
