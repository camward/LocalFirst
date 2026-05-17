import { serve } from "@hono/node-server";
import app from "./index";
import dotenv from "dotenv";
dotenv.config();

serve({ fetch: app.fetch, port: Number(process.env.SERVER_PORT) || 3000 });
