import { Pool, neonConfig } from "@neondatabase/serverless";

const API = "https://console.neon.tech/api/v2";

export interface NeonProject {
  projectId: string;
  connectionUri: string;
}

/** Creates a dedicated Neon project (one database per generated app). */
export async function createNeonProject(apiKey: string, name: string, orgId?: string): Promise<NeonProject> {
  const response = await fetch(`${API}/projects`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ project: { name: name.slice(0, 64), ...(orgId ? { org_id: orgId } : {}) } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Neon: ساخت پروژه ناموفق بود (${response.status}): ${data.message ?? "unknown error"}`);
  }
  const connectionUri: string | undefined = data.connection_uris?.[0]?.connection_uri;
  if (!data.project?.id || !connectionUri) throw new Error("Neon: آدرس اتصال دیتابیس برگردانده نشد.");
  return { projectId: data.project.id, connectionUri };
}

/**
 * Runs the app's schema.sql. Uses the WebSocket Pool (simple query protocol)
 * so a multi-statement script runs in one round trip. Retries while the new
 * compute endpoint is still starting.
 */
export async function runSchema(connectionUri: string, schemaSql: string) {
  if (!schemaSql.trim()) return;
  neonConfig.webSocketConstructor ??= globalThis.WebSocket;
  for (let attempt = 0; ; attempt++) {
    const pool = new Pool({ connectionString: connectionUri });
    try {
      await pool.query(schemaSql);
      return;
    } catch (error) {
      if (attempt >= 3) throw new Error(`اجرای schema.sql روی Neon ناموفق بود: ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
