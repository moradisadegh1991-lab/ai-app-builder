import type { GeneratedFile } from "./types";

// One backend for every hosting target: a Hono app (server/app.ts, written by
// the AI) mounted at /api. On a VPS it runs under Node (server/node.ts, behind
// Caddy); on Vercel the same app runs as one function (api/index.ts).
// The database is PostgreSQL via postgres.js: local Postgres on a VPS, Neon on Vercel.
export function backendFiles(): GeneratedFile[] {
  return [
    {
      path: "server/base.ts",
      content: `import { Hono } from "hono";
import { cors } from "hono/cors";

/** Creates the API app: every route lives under /api and answers CORS (the Android app calls it cross-origin). */
export function createApi() {
  const api = new Hono().basePath("/api");
  api.use("*", cors());
  api.get("/health", (c) => c.json({ ok: true }));
  api.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });
  return api;
}
`,
    },
    {
      path: "server/db.ts",
      content: `import postgres from "postgres";

// DATABASE_URL is set by Idea2App: local PostgreSQL on a VPS, Neon on Vercel.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

export const sql = postgres(databaseUrl, { max: 5, prepare: false, idle_timeout: 20 });
`,
    },
    {
      path: "server/node.ts",
      content: `import { serve } from "@hono/node-server";
import { app } from "./app";

// Used on a VPS (systemd service behind Caddy).
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(\`API listening on http://\${info.address}:\${info.port}\`);
});
`,
    },
    {
      path: "api/index.ts",
      content: `import { handle } from "hono/vercel";
import { app } from "../server/app";

// Used on Vercel: vercel.json rewrites /api/* to this single function.
const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
`,
    },
    {
      path: "vercel.json",
      content: JSON.stringify({ rewrites: [{ source: "/api/(.*)", destination: "/api" }] }, null, 2) + "\n",
    },
  ];
}

export const BACKEND_DEPENDENCIES: Record<string, string> = {
  hono: "^4.13.14",
  "@hono/node-server": "^2.1.5",
  postgres: "^3.4.9",
  tsx: "^4.23.15",
};

export const BACKEND_SCRIPTS: Record<string, string> = {
  server: "tsx server/node.ts",
};
