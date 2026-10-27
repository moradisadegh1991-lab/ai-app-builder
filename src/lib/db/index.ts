import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "../env";
import * as schema from "./schema";

let instance: NeonHttpDatabase<typeof schema> | undefined;

/** Lazily created so builds and tests do not need DATABASE_URL. */
export function db(): NeonHttpDatabase<typeof schema> {
  instance ??= drizzle(neon(env.databaseUrl()), { schema });
  return instance;
}

export { schema };
