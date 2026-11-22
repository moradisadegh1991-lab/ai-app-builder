import { cp, mkdir } from "node:fs/promises";

// Next's standalone build omits these static assets; copy them without touching releases.
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
