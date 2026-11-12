import { Sandbox } from "@vercel/sandbox";
import { authorizedMaintenance } from "@/lib/workflows/cron-auth";

export const maxDuration = 60;

/** Clone the trusted tool image with explicit retention, using deployment OIDC.
 * Used by the deployment runbook; cannot accept code or arbitrary snapshots.
 */
export async function POST(request: Request) {
  if (!authorizedMaintenance(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const snapshotId = process.env.VERCEL_AGENT_SNAPSHOT_ID;
  if (!snapshotId) return Response.json({ error: "Snapshot is not configured" }, { status: 503 });
  const sandbox = await Sandbox.create({
    source: { type: "snapshot", snapshotId },
    persistent: false,
    timeout: 60_000,
    networkPolicy: "deny-all",
  });
  try {
    const snapshot = await sandbox.snapshot({ expiration: 0 });
    return Response.json({ snapshotId: snapshot.snapshotId });
  } catch (error) {
    await sandbox.stop().catch(() => undefined);
    throw error;
  }
}
