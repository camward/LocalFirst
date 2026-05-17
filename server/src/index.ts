import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { desc, sql } from "drizzle-orm";
import pg from "pg";
import { appState } from "./db/schema.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/state", async (c) => {
  try {
    const [row] = await db
      .select()
      .from(appState)
      .orderBy(desc(appState.updatedAt))
      .limit(1);

    if (!row) {
      return c.json({
        id: crypto.randomUUID(),
        text: "",
        canvas: [],
        version: 0,
        lastSyncedVersion: 0,
      });
    }

    return c.json({ ...row, lastSyncedVersion: row.version });
  } catch (e) {
    console.error("GET /api/state error:", e);
    return c.json({ error: "Database error" }, 500);
  }
});

app.post("/api/state", async (c) => {
  console.log("📥 POST /api/state");
  try {
    const body = await c.req.json();
    const { id, text, canvas, version } = body;

    const canvasSize = JSON.stringify(canvas).length;
    console.log(
      `📦 Data: id=${id}, version=${version}, textLen=${text?.length}, canvasSize=${canvasSize}b`
    );

    if (!id) return c.json({ error: "id required" }, 400);

    if (!Array.isArray(canvas)) {
      console.warn("⚠️ canvas is not array, forcing []");
    }

    const [updated] = await db
      .insert(appState)
      .values({
        id,
        text: text ?? "",
        canvas: Array.isArray(canvas) ? canvas : [],
        version: typeof version === "number" ? version : 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appState.id,
        set: {
          text: text ?? "",
          canvas: Array.isArray(canvas) ? canvas : [],
          version: sql`${appState.version} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ Success:", { id: updated.id, version: updated.version });
    return c.json({
      id: updated.id,
      text: updated.text,
      canvas: updated.canvas,
      version: updated.version,
    });
  } catch (e: any) {
    console.error("❌ POST error:", {
      name: e.name,
      message: e.message?.substring(0, 500),
      code: e.code,
      detail: e.detail?.substring(0, 300),
      hint: e.hint,
      query: e.query?.substring(0, 200),
    });
    return c.json({ error: e.message || "Sync failed" }, 500);
  }
});

export default app;
