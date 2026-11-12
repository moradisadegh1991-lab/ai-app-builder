import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { processAgentRun } from "./native";

/** DB admission is the outbox; the deterministic hook makes redispatch safe. */
export async function dispatchWorkflow(id: string) {
  if (process.env.VERCEL !== "1" && process.env.AGENT_RUNTIME !== "vercel") return;
  try {
    await start(processAgentRun, [id], {
      experimental_hook: { token: `agentic:${id}`, experimental_minRetention: "7 days" },
    });
  } catch (error) {
    if (HookConflictError.is(error)) return;
    // Keep the admitted job recoverable. The owner polling route and cron retry
    // delivery if the process stops between the database commit and start().
    console.error("Could not dispatch agent workflow", id, error instanceof Error ? error.message : String(error));
  }
}
