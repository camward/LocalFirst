import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { desc, sql } from "drizzle-orm";
import pg from "pg";
import { appState } from "./db/schema";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const app = new Hono();

app.use(
  "/*",
  cors({ origin: process.env.CLIENT_URL, allowMethods: ["GET", "POST"] })
);

app.get("/api/state", async (c) => {
  const [row] = await db
    .select()
    .from(appState)
    .orderBy(desc(appState.updatedAt))
    .limit(1);
  return c.json(
    row || { id: crypto.randomUUID(), version: 0, canvas: [], text: "" }
  );
});

app.post("/api/state", async (c) => {
  const body = await c.req.json();
  const [updated] = await db
    .insert(appState)
    .values({
      id: body.id,
      text: body.text,
      canvas: body.canvas,
      version: body.version + 1,
    })
    .onConflictDoUpdate({
      target: appState.id,
      set: {
        text: body.text,
        canvas: body.canvas,
        version: sql`${appState.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return c.json(updated);
});

export default app;
