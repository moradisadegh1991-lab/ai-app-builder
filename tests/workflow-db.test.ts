import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as schema from "../src/lib/db/schema";
import { enqueueWorkflow, claimRun, taskStore, renewLease, workflowView } from "../src/lib/workflows/queue";
import { reserveUsage, settleUsage } from "../src/lib/workflows/budgets";
import { workOne } from "../src/lib/workflows/worker";
import { appSpecSchema } from "../src/lib/spec";
import { approveSpec } from "../src/lib/pipeline";

const h = vi.hoisted(() => ({ database: null as unknown, agents: vi.fn() }));
vi.mock("../src/lib/db", async () => ({
  db: () => h.database,
  schema: await import("../src/lib/db/schema"),
}));
vi.mock("../src/lib/agents/orchestrator", () => ({ runAgents: h.agents }));
let client: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
let user: schema.User, project: schema.Project;
const input = { kind: "spec", provider: "openai" } as const;
const spec = appSpecSchema.parse({
  appName: "آزمایش",
  summary: "آزمایش صف",
  features: ["ثبت"],
  screens: [{ name: "خانه", purpose: "نمایش" }],
});

beforeAll(async () => {
  client = new PGlite();
  for (const file of readdirSync("drizzle")
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await client.exec(readFileSync(`drizzle/${file}`, "utf8"));
  database = drizzle(client, { schema });
  h.database = database;
}, 30000);
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  [user] = await database.insert(schema.users).values({ email: "test@example.com" }).returning();
  [project] = await database
    .insert(schema.projects)
    .values({
      userId: user!.id,
      name: "Test",
      slug: "test",
      idea: "A test application",
      aiProvider: "openai",
    })
    .returning();
  vi.clearAllMocks();
});

describe("migrations and durable execution", () => {
  it("supports a fresh install using the single-statement SQL file", async () => {
    const fresh = new PGlite();
    try {
      await fresh.exec(readFileSync("drizzle/all-in-one.sql", "utf8"));
      await expect(fresh.query("select provisioning_token,lease_expires_at from deployments")).resolves.toHaveProperty(
        "rows",
        [],
      );
      const functions = await fresh.query<{ count: number }>(
        "select count(*)::int as count from pg_proc where proname in ('reserve_ai_usage','complete_payment')",
      );
      expect(functions.rows[0]?.count).toBe(2);
    } finally {
      await fresh.close();
    }
  });
  it("includes the formerly missing deployment lease columns", async () => {
    await expect(database.select().from(schema.deployments)).resolves.toEqual([]);
  });
  it("admits one active workflow per project, including simultaneous enqueue attempts", async () => {
    const results = await Promise.allSettled([
      enqueueWorkflow(user!, project!, input),
      enqueueWorkflow(user!, project!, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await database.select().from(schema.workflowRuns)).toHaveLength(1);
  });
  it("recovers an expired lease and rejects writes from the stale worker", async () => {
    await enqueueWorkflow(user!, project!, input);
    const first = (await claimRun())!;
    await client.query("update workflow_runs set lease_expires_at=now()-interval '1 second' where id=$1", [first.id]);
    const second = (await claimRun())!;
    expect(second.id).toBe(first.id);
    expect(second.owner_token).not.toBe(first.owner_token);
    await expect(renewLease(first)).rejects.toThrow();
    await expect(
      taskStore(first, new AbortController().signal).step("test", "designer", {}, async () => ({})),
    ).rejects.toThrow("lease lost");
    const store = taskStore(second, new AbortController().signal),
      action = vi.fn().mockResolvedValue({ answer: 42 });
    await store.step("test", "designer", {}, action);
    await store.step("test", "designer", {}, action);
    expect(action).toHaveBeenCalledOnce();
    await store.step("test", "designer", { changed: true }, action);
    expect(action).toHaveBeenCalledTimes(2);
  });
  it("exposes task progress and screenshot names without sending image payloads in every poll", async () => {
    await enqueueWorkflow(user!, project!, input);
    const run = (await claimRun())!;
    await taskStore(run, new AbortController().signal).step("verify-0", "verifier", {}, async () => ({
      screenshots: [{ name: "mobile", mime: "image/png", data: "private-png-bytes" }],
    }));
    const view = await workflowView(project!.id);
    expect(view?.screenshots[0]?.name).toBe("mobile");
    expect(JSON.stringify(view)).not.toContain("private-png-bytes");
  });
  it("commits requirements and terminal state through the worker", async () => {
    h.agents.mockResolvedValue({ spec });
    await enqueueWorkflow(user!, project!, input);
    expect(await workOne()).toBe(true);
    const [run] = await database.select().from(schema.workflowRuns);
    const [fresh] = await database.select().from(schema.projects);
    expect(run?.status).toBe("succeeded");
    expect(fresh?.spec?.appName).toBe("آزمایش");
    expect(fresh?.status).toBe("spec_ready");
    expect(await workOne()).toBe(false);
  });
  it("keeps existing project data when a specialist fails", async () => {
    h.agents.mockRejectedValue(new Error("Model unavailable"));
    await enqueueWorkflow(user!, project!, input);
    await workOne();
    const [run] = await database.select().from(schema.workflowRuns);
    const [fresh] = await database.select().from(schema.projects);
    expect(run?.status).toBe("failed");
    expect(fresh?.status).toBe("draft");
    expect(fresh?.lastError).toContain("Model unavailable");
  });
  it("prevents requirements edits while a workflow owns the project", async () => {
    await enqueueWorkflow(user!, project!, input);
    await expect(approveSpec(project!, spec)).rejects.toMatchObject({
      status: 409,
    });
    expect((await database.select().from(schema.projects))[0]?.spec).toBeNull();
  });
  it("saves a validated generation and its project pointer together", async () => {
    await database.execute(
      sql`update projects set spec=${JSON.stringify(spec)}::jsonb,spec_approved_at=now() where id=${project!.id}`,
    );
    [project] = await database.select().from(schema.projects);
    h.agents.mockResolvedValue({
      code: {
        files: [{ path: "src/App.tsx", content: "app" }],
        aiFiles: [{ path: "src/App.tsx", content: "app" }],
        libraries: [],
        warnings: [],
        notes: "Verified",
        model: "test-model",
      },
    });
    const id = await enqueueWorkflow(user!, project!, {
      kind: "code",
      provider: "openai",
    });
    await workOne();
    const [fresh] = await database.select().from(schema.projects);
    expect(fresh?.currentGenerationId).toBe(id);
    expect((await database.select().from(schema.generationJobs))[0]?.status).toBe("succeeded");
    expect((await database.select().from(schema.workflowRuns))[0]?.status).toBe("succeeded");
  });
  it("recovers after saving a generation without repeating the AI calls", async () => {
    const id = await enqueueWorkflow(user!, project!, input);
    await claimRun();
    await database.insert(schema.generationJobs).values({
      id,
      projectId: project!.id,
      kind: "spec",
      provider: "openai",
      model: "test",
      status: "succeeded",
    });
    await database.execute(
      sql`update projects set spec=${JSON.stringify(spec)}::jsonb,status='spec_ready' where id=${project!.id}`,
    );
    await database.execute(sql`update workflow_runs set lease_expires_at=now()-interval '1 second' where id=${id}`);
    await workOne();
    expect(h.agents).not.toHaveBeenCalled();
    expect((await database.select().from(schema.workflowRuns))[0]?.status).toBe("succeeded");
    expect(await database.select().from(schema.generationJobs)).toHaveLength(1);
  });
});

describe("atomic token reservations", () => {
  it("counts in-flight requests and settles measured usage exactly once", async () => {
    const first = await reserveUsage(user!.id, undefined, 60000, true);
    await expect(reserveUsage(user!.id, undefined, 50000, true)).rejects.toMatchObject({ status: 429 });
    const details = {
      provider: "openai",
      model: "test",
      purpose: "code",
      inputTokens: 1000,
      outputTokens: 2000,
    };
    await settleUsage(first, details);
    await settleUsage(first, details);
    expect(await database.select().from(schema.usageRecords)).toHaveLength(1);
    await expect(reserveUsage(user!.id, undefined, 97000, true)).resolves.toBeTypeOf("string");
    await expect(reserveUsage(user!.id, undefined, 1, true)).rejects.toMatchObject({ status: 429 });
  });
  it("enforces a workflow budget even with a personal API key", async () => {
    const runId = await enqueueWorkflow(user!, project!, input);
    await claimRun();
    await client.query("update workflow_runs set max_tokens=10000 where id=$1", [runId]);
    await reserveUsage(user!.id, runId, 6000, false);
    await expect(reserveUsage(user!.id, runId, 5000, false)).rejects.toMatchObject({ status: 429 });
  });
});

describe("payment and subscription transaction", () => {
  it("rolls back payment status when granting the subscription fails, then retries safely", async () => {
    const [payment] = await database
      .insert(schema.payments)
      .values({
        userId: user!.id,
        plan: "plus",
        provider: "stripe",
        amount: 2000,
        currency: "usd",
      })
      .returning();
    await client.exec(
      "CREATE FUNCTION reject_test_subscription() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$; CREATE TRIGGER reject_test_subscription BEFORE INSERT ON subscriptions FOR EACH ROW EXECUTE FUNCTION reject_test_subscription();",
    );
    await expect(client.query("select complete_payment($1,'receipt')", [payment!.id])).rejects.toThrow("test failure");
    expect((await database.select().from(schema.payments))[0]?.status).toBe("pending");
    await client.exec(
      "DROP TRIGGER reject_test_subscription ON subscriptions; DROP FUNCTION reject_test_subscription();",
    );
    await client.query("select complete_payment($1,'receipt')", [payment!.id]);
    const before = (await database.select().from(schema.subscriptions))[0]!.currentPeriodEnd;
    await client.query("select complete_payment($1,'receipt')", [payment!.id]);
    expect((await database.select().from(schema.subscriptions))[0]!.currentPeriodEnd).toEqual(before);
    expect((await database.select().from(schema.payments))[0]?.status).toBe("paid");
  });
  it("extends two separate purchases rather than overwriting their periods", async () => {
    for (let i = 0; i < 2; i++) {
      const [payment] = await database
        .insert(schema.payments)
        .values({
          userId: user!.id,
          plan: "plus",
          provider: "stripe",
          amount: 2000,
          currency: "usd",
          reference: randomUUID(),
        })
        .returning();
      await client.query("select complete_payment($1,'receipt')", [payment!.id]);
    }
    const [sub] = await database.select().from(schema.subscriptions);
    expect(sub!.currentPeriodEnd.getTime() - Date.now()).toBeGreaterThan(59 * 86400000);
  });
});
