
import { Pool, neonConfig } from "@neondatabase/serverless";

const API = "https://console.neon.tech/api/v2";

export interface NeonProject {
  projectId: string;
  connectionUri: string;
}

interface NeonApiProject {
  id: string;
  name: string;
}

interface NeonListProjectsResponse {
  projects?: NeonApiProject[];
}

interface NeonCreateResponse {
  project?: {
    id?: string;
    name?: string;
  };
  connection_uris?: Array<{
    connection_uri?: string;
  }>;
}

interface NeonConnectionUriResponse {
  uri?: string;
}

function errorMessage(data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return "unknown error";
}

async function neonRequest<T>(
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
      ...options.headers,
    },
  });

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Neon API ${response.status}: ${errorMessage(data)}`,
    );
  }

  return data as T;
}

/**
 * Searches for an existing project using an exact project name.
 *
 * The search parameter is only a filter, so the returned projects
 * are checked again for an exact name match.
 */
async function findNeonProject(
  apiKey: string,
  name: string,
  orgId?: string,
): Promise<NeonApiProject | null> {
  const params = new URLSearchParams({
    search: name,
    limit: "400",
  });

  if (orgId) {
    params.set("org_id", orgId);
  }

  const result = await neonRequest<NeonListProjectsResponse>(
    apiKey,
    `/projects?${params.toString()}`,
  );

  const matches = (result.projects ?? []).filter(
    (project) => project.name === name,
  );

  if (matches.length > 1) {
    throw new Error(
      `Neon: بیش از یک پروژه با نام دقیق "${name}" پیدا شد. ` +
        "برای جلوگیری از اتصال به دیتابیس اشتباه، عملیات متوقف شد.",
    );
  }

  return matches[0] ?? null;
}

/**
 * Retrieves the connection URI for an existing Neon project.
 *
 * Neon can return the URI again without creating another project.
 */
async function getNeonConnectionUri(
  apiKey: string,
  projectId: string,
): Promise<string> {
  const result = await neonRequest<NeonConnectionUriResponse>(
    apiKey,
    `/projects/${encodeURIComponent(projectId)}/connection_uri`,
  );

  if (!result.uri) {
    throw new Error(
      "Neon: بازیابی Connection URI ناموفق بود.",
    );
  }

  return result.uri;
}

/**
 * Creates a dedicated Neon project.
 *
 * This function intentionally does not retry POST automatically.
 * Neon documents project creation as a non-idempotent operation.
 */
export async function createNeonProject(
  apiKey: string,
  name: string,
  orgId?: string,
): Promise<NeonProject> {
  const body = {
    project: {
      name: name.slice(0, 64),
      ...(orgId ? { org_id: orgId } : {}),
    },
  };

  const data = await neonRequest<NeonCreateResponse>(
    apiKey,
    "/projects",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  const projectId = data.project?.id;

  if (!projectId) {
    throw new Error(
      "Neon: شناسه پروژه پس از ساخت برگردانده نشد.",
    );
  }

  const connectionUri =
    data.connection_uris?.[0]?.connection_uri ??
    (await getNeonConnectionUri(apiKey, projectId));

  if (!connectionUri) {
    throw new Error(
      "Neon: آدرس اتصال دیتابیس برگردانده نشد.",
    );
  }

  return {
    projectId,
    connectionUri,
  };
}

/**
 * Gets an existing project or creates it if it does not exist.
 *
 * Important:
 * The supplied name must be deterministic and unique per app project.
 * The caller should include the internal app project ID in the name.
 *
 * If the create request fails because its response was lost, this
 * function searches Neon again before allowing the error to escape.
 */
export async function getOrCreateNeonProject(
  apiKey: string,
  name: string,
  orgId?: string,
): Promise<NeonProject> {
  const safeName = name.trim().slice(0, 64);

  if (!safeName) {
    throw new Error("Neon: نام پروژه معتبر نیست.");
  }

  const existing = await findNeonProject(
    apiKey,
    safeName,
    orgId,
  );

  if (existing) {
    return {
      projectId: existing.id,
      connectionUri: await getNeonConnectionUri(
        apiKey,
        existing.id,
      ),
    };
  }

  try {
    return await createNeonProject(
      apiKey,
      safeName,
      orgId,
    );
  } catch (createError) {
    /*
     * The POST may have succeeded even if the response was lost.
     * Search again before returning the original error.
     */
    try {
      const recovered = await findNeonProject(
        apiKey,
        safeName,
        orgId,
      );

      if (recovered) {
        return {
          projectId: recovered.id,
          connectionUri: await getNeonConnectionUri(
            apiKey,
            recovered.id,
          ),
        };
      }
    } catch (recoveryError) {
      throw new Error(
        `Neon: ساخت پروژه ناموفق بود و بازیابی آن نیز انجام نشد. ` +
          `خطای ساخت: ${
            createError instanceof Error
              ? createError.message
              : String(createError)
          }. خطای بازیابی: ${
            recoveryError instanceof Error
              ? recoveryError.message
              : String(recoveryError)
          }`,
      );
    }

    throw createError;
  }
}

/**
 * Runs the app's schema.sql.
 *
 * Uses the WebSocket Pool (simple query protocol) so a
 * multi-statement script runs in one round trip.
 *
 * Retries while the new compute endpoint is starting.
 */
export async function runSchema(
  connectionUri: string,
  schemaSql: string,
): Promise<void> {
  if (!schemaSql.trim()) return;

  neonConfig.webSocketConstructor ??= globalThis.WebSocket;

  for (let attempt = 0; ; attempt++) {
    const pool = new Pool({
      connectionString: connectionUri,
    });

    try {
      await pool.query(schemaSql);
      return;
    } catch (error) {
      if (attempt >= 3) {
        throw new Error(
          `اجرای schema.sql روی Neon ناموفق بود: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000 * (attempt + 1)),
      );
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
