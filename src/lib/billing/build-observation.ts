import type { WorkflowRun } from "../integrations/github";

/** GitHub's run update timestamp is not a billing record or a job finish timestamp. */
export function buildObservation(run: Pick<WorkflowRun, "status" | "run_started_at" | "updated_at" | "run_attempt">) {
  const parse = (value: string | null | undefined) => {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time) : null;
  };
  const start = parse(run.run_started_at), updated = parse(run.updated_at);
  const seconds = start && updated && run.status === "completed" && updated >= start
    ? Math.floor((updated.getTime() - start.getTime()) / 1000) : null;
  return {
    runAttempt: Number.isSafeInteger(run.run_attempt) && (run.run_attempt ?? 0) > 0 ? run.run_attempt : null,
    runStartedAt: start,
    runUpdatedAt: updated,
    reportedElapsedSeconds: seconds !== null && Number.isSafeInteger(seconds) ? seconds : null,
  };
}
