import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { runAgents, type AgentContext, type AgentResult } from "../agents/orchestrator";
import { verifyInSandbox } from "../agents/sandbox";
import {
  currentGeneration,
  fixRoundsSinceGreen,
  MAX_AUTO_FIX_ROUNDS,
  projectAgent,
  getOwnedProject,
} from "../projects";
import { pushToGitHub, syncBuild } from "../pipeline";
import { claimRun, renewLease, taskStore, type ClaimedRun } from "./queue";
import { queryRows } from "./sql";
import { WorkflowYield } from "./yield";

async function finish(run: ClaimedRun, result: AgentResult) {
  const code = result.code;
  const spec = result.spec;
  // Commit the generation and project pointer together, retaining the run's lease
  // until optional publication finishes. A restarted worker detects generation id=run id.
  const saved = await queryRows(sql`with owned as (
    update workflow_runs set base_generation_id=case when ${Boolean(code)} then id else base_generation_id end,updated_at=now()
    where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now()
      and exists(select 1 from projects where id=${run.project_id} and current_generation_id is not distinct from ${run.base_generation_id}::uuid)
    returning id
  ), generation as (
    insert into generation_jobs(id,project_id,kind,provider,model,status,files,ai_files,libraries,warnings,notes,finished_at)
    select id,${run.project_id}::uuid,${run.input.kind}::job_kind,${run.input.provider},${code?.model ?? "architect"},'succeeded',
      ${JSON.stringify(code?.files ?? null)}::jsonb,${JSON.stringify(code?.aiFiles ?? null)}::jsonb,
      ${JSON.stringify(code?.libraries ?? [])}::jsonb,${JSON.stringify(code?.warnings ?? [])}::jsonb,${code?.notes ?? ""},now()
    from owned returning id
  ) update projects set
    current_generation_id=case when ${Boolean(code)} then (select id from generation) else current_generation_id end,
    spec=case when ${Boolean(spec)} then ${JSON.stringify(spec ?? null)}::jsonb else spec end,
    spec_approved_at=case when ${Boolean(spec)} then null else spec_approved_at end,
    name=case when ${Boolean(spec)} then ${spec?.appName ?? ""} else name end,
    status=${spec ? "spec_ready" : "generated"}::project_status,last_error=null,updated_at=now()
    where id=${run.project_id} and exists(select 1 from owned) returning id`);
  if (!saved.length) throw new Error("Workflow ownership or project version changed before saving");
}

async function fail(run: ClaimedRun, error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  await db().execute(sql`with failed as (
    update workflow_runs set status='failed',error=${message},finished_at=now(),updated_at=now(),lease_expires_at=null
    where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now() returning project_id
  ), tasks as (
    update agent_tasks set status='failed',error=coalesce(error,${message}),updated_at=now()
    where run_id=${run.id} and status='running' and exists(select 1 from failed)
  ) update projects set last_error=${message},updated_at=now() where id in(select project_id from failed)`);
}

export async function workOne(
  shutdown?: AbortSignal,
  options: { runId?: string; slice?: boolean; verify?: AgentContext["verify"] } = {},
): Promise<boolean> {
  const run = await claimRun(options.runId);
  if (!run) return false;
  const lease = new AbortController();
  const signal = shutdown ? AbortSignal.any([lease.signal, shutdown]) : lease.signal;
  let renewing: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (renewing) return;
    renewing = renewLease(run)
      .catch((error) => {
        lease.abort(error);
      })
      .finally(() => {
        renewing = undefined;
      });
  }, 20_000);
  try {
    if (run.attempts > 3)
      throw new Error("بازیابی این اجرا پس از سه تلاش متوقف شد؛ گزارش را بررسی و دوباره شروع کنید.");
    const project = await getOwnedProject(run.user_id, run.project_id);
    if (project.currentGenerationId !== run.base_generation_id)
      throw new Error("نسخه پروژه پس از ورود به صف تغییر کرده است.");
    const store = taskStore(run, signal, options.slice);
    const [committed] = await db().select().from(schema.generationJobs).where(eq(schema.generationJobs.id, run.id));
    let failureLog: string | undefined;
    if (run.input.kind === "fix" && !committed) {
      // The current queued/running attempt is already counted.
      if (run.input.auto && (await fixRoundsSinceGreen(project.id)) > MAX_AUTO_FIX_ROUNDS)
        throw new Error("سقف اصلاح خودکار پر شده است.");
      const user = (await db().select().from(schema.users).where(eq(schema.users.id, run.user_id)))[0]!;
      const build = await syncBuild(user, project);
      const agent = await projectAgent(project.id);
      failureLog =
        build?.conclusion === "failure"
          ? (build.failureLog ?? "Build failed; log unavailable")
          : agent?.status === "error"
            ? (agent.lastLog ?? "VPS deployment failed")
            : undefined;
      if (!failureLog) throw new Error("خطای فعالی برای اصلاح وجود ندارد.");
    }
    let result: AgentResult;
    if (committed?.status === "succeeded") {
      result =
        committed.files && committed.aiFiles
          ? {
              code: {
                files: committed.files,
                aiFiles: committed.aiFiles,
                libraries: committed.libraries ?? [],
                warnings: committed.warnings ?? [],
                notes: committed.notes ?? "",
                model: committed.model,
              },
            }
          : { spec: project.spec ?? undefined };
    } else {
      const previous = run.input.kind === "edit" || run.input.kind === "fix" ? await currentGeneration(project) : null;
      result = await runAgents({
        runId: run.id,
        userId: run.user_id,
        project,
        input: run.input,
        store,
        signal,
        existing: previous?.aiFiles ? { aiFiles: previous.aiFiles, libraries: previous.libraries ?? [] } : undefined,
        failureLog,
        verify: options.verify ?? verifyInSandbox,
      });
      signal.throwIfAborted();
      await renewLease(run);
      await finish(run, result);
      if (result.code) run.base_generation_id = run.id;
    }
    // Retain the existing edit/fix behavior: a validated result starts a GitHub build.
    // A publication failure leaves the validated code available for the normal Push button.
    if (result.code && project.githubRepo && (run.input.kind === "edit" || run.input.kind === "fix")) {
      await store.step("publish", "publisher", { generationId: run.id }, async () => {
        await renewLease(run);
        const user = (await db().select().from(schema.users).where(eq(schema.users.id, run.user_id)))[0]!;
        const pushed = await pushToGitHub(
          user,
          await getOwnedProject(run.user_id, run.project_id),
          `${run.input.kind}: specialist team validated changes`,
        );
        return { sha: pushed.lastCommitSha };
      });
    }
    const completed =
      await queryRows(sql`update workflow_runs set status='succeeded',finished_at=now(),updated_at=now(),lease_expires_at=null
      where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now() returning id`);
    if (!completed.length) throw new Error("Workflow lease lost before completion");
  } catch (error) {
    if (error instanceof WorkflowYield && !signal.aborted) {
      // A normal phase boundary does not consume a crash recovery attempt.
      await db().execute(sql`update workflow_runs set status='queued',owner_token=null,lease_expires_at=null,
        attempts=greatest(attempts-1,0),updated_at=now()
        where id=${run.id} and owner_token=${run.owner_token}::uuid and status='running' and lease_expires_at>now()`);
    } else {
      if (!signal.aborted) await fail(run, error);
      console.error("Workflow execution stopped", run.id, error instanceof Error ? error.message : String(error));
    }
  } finally {
    clearInterval(timer);
    await renewing;
  }
  return true;
}
