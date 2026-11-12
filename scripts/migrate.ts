import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

async function main() {
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  await db().execute(
    sql.raw(`DO $i2a_init$ BEGIN
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint);
    END $i2a_init$;`),
  );
  const baseline = process.argv.indexOf("--baseline-through");
  const baselineTag = baseline < 0 ? undefined : process.argv[baseline + 1];
  const baselineIndex = journal.entries.findIndex((e) => e.tag === baselineTag);
  if (baseline >= 0 && baselineIndex < 0) throw new Error("Unknown --baseline-through migration tag");
  for (const [index, entry] of journal.entries.entries()) {
    const content = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");
    const body = index <= baselineIndex ? "" : content.replaceAll("--> statement-breakpoint", "");
    // One DO statement = one transaction, including DDL and the journal entry.
    // This works through the Neon HTTP driver as well as ordinary PostgreSQL.
    await db().execute(
      sql.raw(`DO $i2a_migration$ BEGIN
      PERFORM pg_advisory_xact_lock(19871204);
      IF NOT EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at>=${entry.when}) THEN
        ${body}
        INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES('${hash}',${entry.when});
      END IF;
      END $i2a_migration$;`),
    );
    console.log(`${index <= baselineIndex ? "Baseline" : "Applied/verified"}: ${entry.tag}`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
