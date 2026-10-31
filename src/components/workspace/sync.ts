import type { ProjectView } from "@/lib/projects";

// Which long-running server-side work the page must follow, and a guard that stops a slow poll
// response from overwriting newer state. Pure and unit tested; the timers live in useProjectSync.

/** Each kind is an existing endpoint that returns the full project view. */
export type SyncKind = "build" | "cloud" | "project";

export const SYNC_PATH: Record<SyncKind, string> = { build: "/build", cloud: "/cloud", project: "" };

/** Vercel: both "provisioning" (database + project being created) and "deploying" (Vercel build). */
export function vercelDeploymentActive(project: ProjectView): boolean {
  const status = project.deployment?.status;
  return project.hosting === "vercel" && (status === "provisioning" || status === "deploying");
}

export function syncKinds(project: ProjectView): SyncKind[] {
  const kinds: SyncKind[] = [];
  if (project.build !== null && project.build.status !== "completed") kinds.push("build");
  if (vercelDeploymentActive(project)) kinds.push("cloud");
  // VPS: the agent reports on its own; the project view is the only thing to re-read.
  if (project.vps !== null && (project.vps.status === "pending" || project.vps.status === "deploying")) kinds.push("project");
  return kinds;
}

/** One interval for everything: fast enough for deployments, light for builds. */
export function syncIntervalMs(kinds: SyncKind[]): number {
  return kinds.includes("cloud") ? 8_000 : 10_000;
}

export interface PollToken {
  epoch: number;
}

/**
 * A poll response is applied only when no user-started operation began or finished while it was in
 * flight. Operations return the authoritative, newer project view; a poll that overlapped one may
 * carry older data and must be dropped. While an operation runs, polling is paused.
 */
export class ResponseGate {
  private epoch = 0;
  private running = 0;

  beginOperation(): void {
    this.running += 1;
    this.epoch += 1;
  }

  endOperation(): void {
    this.running = Math.max(0, this.running - 1);
    this.epoch += 1;
  }

  /** null = an operation is running: skip this poll. */
  startPoll(): PollToken | null {
    return this.running > 0 ? null : { epoch: this.epoch };
  }

  accept(token: PollToken): boolean {
    return this.running === 0 && token.epoch === this.epoch;
  }
}
