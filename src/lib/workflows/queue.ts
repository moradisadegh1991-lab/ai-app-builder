import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../http";
import { enforce } from "../rate-limit";
import { queryRows } from "./sql";
import type { AgentTaskInput } from "../agents/contracts";

export interface ClaimedRun {
  id: string;
  project_id: string;
  user_id: string;
  input: AgentTaskInput;
  previous_status: schema.Project["status"];
  base_generation_id: string | null;
  owner_token: string;
  attempts: number;
  max_tokens: number;
}
export const LEASE_SECONDS = 120;

export async function assertProjectIdle(projectId: string) {
  const active = await queryRows(
    sql`select id from workflow_runs where project_id = ${projectId} and status in ('queued','running') limit 1`,
  );
  if (active.length) throw new HttpError(409, "تیم هوش مصنوعی در حال کار روی این پروژه است.");
}

export async function enqueueWorkflow(user: schema.User, project: schema.Project, input: AgentTaskInput) {
  if (input.kind !== "spec" && (!project.spec || !project.specApprovedAt))
    throw new HttpError(400, "ابتدا نیازمندی‌ها را تأیید کنید.");
  if ((input.kind === "edit" || input.kind === "fix") && !project.currentGenerationId)
    throw new HttpError(400, "کد قبلی پیدا نشد.");
  await enforce("workflow", user.id, 20, 3600, "درخواست ساخت با تیم هوش مصنوعی");
  const maxTokens = Number(process.env.WORKFLOW_MAX_TOKENS ?? 250000);
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1000 || maxTokens > 10_000_000)
    throw new Error("Invalid WORKFLOW_MAX_TOKENS");
  // One SQL statement holds the project lock, rejects a stale caller and inserts at most one active run.
  const runs = await queryRows<{ id: string }>(sql`
    with project as (
      select * from projects where id = ${project.id} and user_id = ${user.id}
      and date_trunc('milliseconds',updated_at) = ${project.updatedAt.toISOString()}::timestamptz for update
    ), inserted as (insert into workflow_runs (project_id,user_id,input,previous_status,base_generation_id,max_tokens)
    select id,user_id,${JSON.stringify(input)}::jsonb,status,current_generation_id,${maxTokens} from project
    on conflict (project_id) where status in ('queued','running') do nothing returning id,project_id)
    update projects set updated_at=now(),last_error=null where id in(select project_id from inserted)
    returning (select id from inserted) as id`);
  if (!runs[0]) throw new HttpError(409, "پروژه تغییر کرده یا عملیاتی در صف است؛ صفحه را تازه کنید.");
  return runs[0].id;
}

/** SKIP LOCKED supports several workers; owner tokens fence out a worker whose lease expired. */
export async function claimRun(): Promise<ClaimedRun | null> {
  const token = randomUUID();
  const runs = await queryRows<ClaimedRun>(sql`
    update workflow_runs set status='running',owner_token=${token}::uuid,
      lease_expires_at=now()+make_interval(secs=>${LEASE_SECONDS}), attempts=attempts+1,updated_at=now()
    where id=(select id from workflow_runs
      where status='queued' or (status='running' and lease_expires_at<now())
      order by created_at for update skip locked limit 1) returning *`);
  return runs[0] ?? null;
}
export async function renewLease(run: ClaimedRun) {
  const rows =
    await queryRows(sql`update workflow_runs set lease_expires_at=now()+make_interval(secs=>${LEASE_SECONDS}),updated_at=now()
    where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now() returning id`);
  if (!rows.length) throw new Error("مالکیت اجرای وظیفه منقضی شده است.");
}
export function ownership(run: ClaimedRun) {
  return sql`exists(select 1 from workflow_runs where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now() for update)`;
}

export function inputHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface TaskStore {
  step<T>(key: string, role: string, input: unknown, action: () => Promise<T>): Promise<T>;
  evaluation(round: number, report: unknown, passed: boolean): Promise<void>;
}
export function taskStore(run: ClaimedRun, signal: AbortSignal): TaskStore {
  return {
    async step<T>(key: string, role: string, input: unknown, action: () => Promise<T>) {
      signal.throwIfAborted();
      const hash = inputHash(input);
      const existing = await queryRows<{
        status: string;
        input_hash: string;
        output: T;
      }>(sql`select status,input_hash,output from agent_tasks where run_id=${run.id} and key=${key}`);
      if (existing[0]?.status === "succeeded" && existing[0].input_hash === hash) return existing[0].output;
      const rows = await queryRows(sql`insert into agent_tasks (run_id,key,role,input_hash)
        select ${run.id}::uuid,${key},${role},${hash} where ${ownership(run)}
        on conflict (run_id,key) do update set status='running',input_hash=excluded.input_hash,output=null,error=null,updated_at=now() returning id`);
      if (!rows.length) throw new Error("Workflow lease lost");
      try {
        const output = await action();
        signal.throwIfAborted();
        const saved =
          await queryRows(sql`update agent_tasks set status='succeeded',output=${JSON.stringify(output)}::jsonb,updated_at=now()
          where run_id=${run.id} and key=${key} and ${ownership(run)} returning id`);
        if (!saved.length) throw new Error("Workflow lease lost");
        return output;
      } catch (error) {
        await db()
          .execute(sql`update agent_tasks set status='failed',error=${String(error).slice(0, 2000)},updated_at=now()
          where run_id=${run.id} and key=${key} and ${ownership(run)}`);
        throw error;
      }
    },
    async evaluation(round, report, passed) {
      await db().execute(sql`insert into evaluations(run_id,round,status,report)
        select ${run.id}::uuid,${round},${passed ? "passed" : "failed"},${JSON.stringify(report)}::jsonb where ${ownership(run)}
        on conflict(run_id,round) do update set status=excluded.status,report=excluded.report`);
    },
  };
}

export async function workflowView(projectId: string) {
  const runs = await queryRows<{
    id: string;
    status: string;
    input: AgentTaskInput;
    error: string | null;
    created_at: Date | string;
  }>(sql`
    select id,status,input,error,created_at from workflow_runs where project_id=${projectId} order by created_at desc limit 1`);
  const run = runs[0];
  if (!run) return null;
  const tasks = await queryRows<{
    id: string;
    role: string;
    status: string;
    error: string | null;
    output: { model?: string; screenshots?: { name: string }[] } | null;
  }>(sql`
    select id,role,status,error,jsonb_build_object('model',output->'model','screenshots',
      coalesce((select jsonb_agg(jsonb_build_object('name',s->>'name')) from jsonb_array_elements(output->'screenshots') s),'[]'::jsonb)) as output
      from agent_tasks where run_id=${run.id} order by created_at,key`);
  const evaluations = await queryRows<{ status: string; report: unknown }>(sql`
    select status,report from evaluations where run_id=${run.id} order by round desc limit 1`);
  return {
    id: run.id,
    status: run.status,
    kind: run.input.kind,
    error: run.error,
    createdAt: new Date(run.created_at).toISOString(),
    tasks: tasks.map((t) => ({
      id: t.id,
      role: t.role,
      status: t.status,
      error: t.error,
      model: t.output?.model ?? null,
    })),
    screenshots: tasks
      .filter((t) => t.role === "verifier" && t.status === "succeeded")
      .slice(-1)
      .flatMap((t) =>
        (t.output?.screenshots ?? []).map((s) => ({
          taskId: t.id,
          name: s.name,
        })),
      ),
    evaluation: evaluations[0] ?? null,
  };
}
