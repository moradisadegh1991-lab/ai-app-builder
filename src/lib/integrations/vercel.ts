const API = "https://api.vercel.com";

export class VercelError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function vercel<T = any>(token: string, teamId: string | undefined, method: string, path: string, body?: unknown) {
  const url = new URL(`${API}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new VercelError(response.status, `Vercel ${method} ${url.pathname} → ${response.status}: ${data.error?.message ?? "unknown error"}`);
  }
  return data as T;
}

export interface VercelProjectOptions {
  name: string;
  repoFullName: string;
  framework: "vite" | null;
  buildCommand?: string;
  outputDirectory?: string;
}

export async function createVercelProject(token: string, teamId: string | undefined, options: VercelProjectOptions) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const name = attempt === 0 ? options.name : `${options.name}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const project = await vercel(token, teamId, "POST", "/v11/projects", {
        name,
        framework: options.framework,
        buildCommand: options.buildCommand,
        outputDirectory: options.outputDirectory,
        gitRepository: { type: "github", repo: options.repoFullName },
      });
      return { id: project.id as string, name: project.name as string };
    } catch (error) {
      if (error instanceof VercelError && error.status === 409) continue;
      if (error instanceof VercelError && /install the github integration|repository/i.test(error.message)) {
        throw new Error(
          "Vercel به Repository گیت‌هاب دسترسی ندارد. در Vercel → Settings → Git، اپ GitHub را نصب کنید و دسترسی به همه Repositoryها (یا این Repository) را بدهید.",
        );
      }
      throw error;
    }
  }
  throw new Error("ساخت پروژه Vercel ممکن نشد: نام تکراری است.");
}

export async function upsertEnv(token: string, teamId: string | undefined, projectId: string, key: string, value: string) {
  await vercel(token, teamId, "POST", `/v10/projects/${projectId}/env?upsert=true`, {
    key,
    value,
    type: "encrypted",
    target: ["production", "preview"],
  });
}

export async function deployFromGit(
  token: string,
  teamId: string | undefined,
  projectName: string,
  repoId: number,
  ref: string,
) {
  const deployment = await vercel(token, teamId, "POST", "/v13/deployments", {
    name: projectName,
    project: projectName,
    target: "production",
    gitSource: { type: "github", repoId, ref },
  });
  return { id: deployment.id as string };
}

export async function getDeployment(token: string, teamId: string | undefined, deploymentId: string) {
  const deployment = await vercel(token, teamId, "GET", `/v13/deployments/${deploymentId}`);
  const aliases: string[] = deployment.alias ?? [];
  return {
    readyState: deployment.readyState as "QUEUED" | "BUILDING" | "INITIALIZING" | "READY" | "ERROR" | "CANCELED",
    // The production alias (e.g. my-app.vercel.app) is public; the per-deployment URL may be protected.
    productionUrl: aliases[0] ? `https://${aliases[0]}` : null,
    errorMessage: (deployment.errorMessage as string | undefined) ?? null,
  };
}

export async function getVercelProject(token: string, teamId: string | undefined, idOrName: string) {
  const project = await vercel(token, teamId, "GET", `/v9/projects/${encodeURIComponent(idOrName)}`);
  return { id: project.id as string, name: project.name as string };
}
