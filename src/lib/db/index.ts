import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Lazily created so builds and tests do not need DATABASE_URL.
 * Neon is reached over its HTTP driver (ideal for serverless on Vercel); any
 * other PostgreSQL — e.g. the platform self-hosted on a VPS — over TCP.
 */
export function db(): Database {
  if (!instance) {
    const url = env.databaseUrl();
    if (new URL(url).hostname.endsWith(".neon.tech")) {
      instance = drizzleNeon(neon(url), { schema });
    } else {
      // Both drivers expose the same query builder; the code never relies on driver-specific results.
      instance = drizzlePostgres(postgres(url, { max: 10 }), { schema }) as unknown as Database;
    }
  }
  return instance;
}

export { schema };
