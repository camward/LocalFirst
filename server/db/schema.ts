import {
  pgTable,
  text,
  jsonb,
  uuid,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const appState = pgTable("app_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  text: text("text"),
  canvas:
    jsonb("canvas").$type<Array<{ points: { x: number; y: number }[] }>>(),
  version: integer("version").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
