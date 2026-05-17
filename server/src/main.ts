import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index";

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.SERVER_PORT) || 3000,
    hostname: "0.0.0.0",
  },
  (i) => console.log(`Server is running on port: ${i.port}`)
);
