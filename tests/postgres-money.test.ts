import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

// Only an explicitly supplied disposable CI database may be used here.
const url = process.env.DISPOSABLE_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL money admission", () => {
  const db = postgres(url ?? "postgres://localhost/unused", { max: 4 });
  const user = randomUUID(), project = randomUUID();
  const limits = { platform_day: 100, platform_month: 100, user_day: 100, user_month: 100, project_day: 100, project_month: 100, run: 100 };
  beforeAll(async () => {
    const [guard] = await db`select current_database() as name`;
    if (guard?.name !== "ideaapp_disposable_test") throw new Error("Refusing non-disposable database");
    await db.unsafe(await readFile("drizzle/all-in-one.sql", "utf8"));
    await db`insert into users(id,email) values(${user},'money-test@example.invalid')`;
    await db`insert into projects(id,user_id,name,slug,idea,ai_provider) values(${project},${user},'test','test','test','openai')`;
  }, 30000);
  afterAll(async () => { await db.end(); });
  it("serializes separate connections competing for the platform limit", async () => {
    const attempt = async () => {
      const id = randomUUID();
      const [row] = await db`select reserve_ai_money(${id}::uuid,${user}::uuid,${project}::uuid,null,100,100000,300000,60,${db.json(limits)}::jsonb) as allowed`;
      return row?.allowed;
    };
    expect((await Promise.all([attempt(), attempt()])).sort()).toEqual([false, true]);
  });
  it("accepts the application Drizzle JSON parameter shape", async () => {
    const result = await drizzle(db).execute(sql`select reserve_ai_money(${randomUUID()}::uuid,${user}::uuid,${project}::uuid,null,100,100000,300000,1,${JSON.stringify(limits)}::jsonb) as allowed`);
    expect(result[0]?.allowed).toBe(true);
  });
  it("does not admit additional spending above the retained reservation", async () => {
    const rows = await drizzle(db).execute(sql`select reserve_ai_money(${randomUUID()}::uuid,${user}::uuid,${project}::uuid,null,100,100000,300000,41,${JSON.stringify(limits)}::jsonb) as allowed`);
    expect(rows[0]?.allowed).toBe(false);
  });
  it("serializes competing free build attempts across connections", async () => {
    const attempt = async () => {
      const [row] = await db`select admit_free_build(${randomUUID()}::uuid,${user}::uuid,${project}::uuid,'push',1) as allowed`;
      return row?.allowed;
    };
    expect((await Promise.all([attempt(), attempt()])).sort()).toEqual([false, true]);
  });

});
