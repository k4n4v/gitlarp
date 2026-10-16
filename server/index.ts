import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { api } from "./routes.js";

loadEnv();

const PORT = Number(process.env.PORT ?? 8787);
const VITE_ORIGIN = process.env.VITE_ORIGIN ?? "http://localhost:3000";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: VITE_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.route("/api", api);

app.get("/", (c) =>
  c.json({
    name: "gitlarp",
    message: "Local API is running. Open the Vite UI on port 3000.",
  })
);

console.log(`gitlarp API listening on http://localhost:${PORT}`);
console.log(
  `GITHUB_TOKEN: ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? "configured" : "MISSING"}`
);

serve({ fetch: app.fetch, port: PORT });
