import type { SQL } from "drizzle-orm";
import { db } from "../db";

/** Both Neon HTTP and postgres.js return the same rows through this boundary. */
export async function queryRows<T>(query: SQL): Promise<T[]> {
  const result = await db().execute(query);
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}
