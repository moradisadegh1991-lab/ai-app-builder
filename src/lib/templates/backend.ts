import type { GeneratedFile } from "./types";

// Shared helpers for Vercel Functions in generated apps (files under api/_lib
// are not deployed as endpoints because of the leading underscore).
export function backendFiles(): GeneratedFile[] {
  return [
    {
      path: "api/_lib/db.ts",
      content: `import { neon } from "@neondatabase/serverless";

// DATABASE_URL is injected into the Vercel project by Idea2App (Neon database).
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

export const sql = neon(databaseUrl);
`,
    },
    {
      path: "api/_lib/http.ts",
      content: `// The Android app runs on https://localhost (Capacitor) or natively (Expo),
// so every endpoint must answer CORS preflight requests.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function readBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
`,
    },
  ];
}

export const BACKEND_DEPENDENCIES: Record<string, string> = {
  "@neondatabase/serverless": "^1.2.0",
};
