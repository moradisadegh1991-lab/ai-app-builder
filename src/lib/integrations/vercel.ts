
const API = "https://api.vercel.com";

export class VercelError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "VercelError";
  }
}

async function vercel<T = any>(
  token: string,
  teamId: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(`${API}${path}`);

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new VercelError(
      response.status,
      `Vercel ${method} ${url.pathname} → ${response.status}: ${
        data.error?.message ?? "unknown error"
      }`,
    );
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

interface VercelProjectResponse {
  id: string;
  name: string;
  gitRepository?: {
    type?: string;
    repo?: string;
    repoId?: number;
  } | null;
}

interface VercelProjectResult {
  id: string;
  name: string;
}

function normalizeRepository(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

/**
 * Retrieve an existing Vercel project by ID or name.
 */
export async function getVercelProject(
  token: string,
  teamId: string | undefined,
  idOrName: string,
): Promise<VercelProjectResult> {
  const project = await vercel<VercelProjectResponse>(
    token,
    teamId,
    "GET",
    `/v9/projects/${encodeURIComponent(idOrName)}`,
  );

  return {
    id: project.id,
    name: project.name,
  };
}

/**
 * Retrieve a project and verify that it belongs to the expected GitHub repository.
 */
async function getExistingProjectForRepository(
  token: string,
  teamId: string | undefined,
  projectName: string,
  expectedRepository: string,
): Promise<VercelProjectResult | null> {
  let project: VercelProjectResponse;

  try {
    project = await vercel<VercelProjectResponse>(
      token,
      teamId,
      "GET",
      `/v9/projects/${encodeURIComponent(projectName)}`,
    );
  } catch (error) {
    if (error instanceof VercelError && error.status === 404) {
      return null;
    }

    throw error;
  }

  const actualRepository = normalizeRepository(
    project.gitRepository?.repo,
  );

  const expected = normalizeRepository(expectedRepository);

  if (!actualRepository || actualRepository !== expected) {
    throw new Error(
      `پروژه‌ای با نام "${projectName}" در Vercel وجود دارد، اما به Repository مورد انتظار متصل نیست. ` +
        `Repository مورد انتظار: ${expectedRepository}. ` +
        `برای جلوگیری از اتصال اشتباه، پروژه موجود به‌صورت خودکار استفاده نشد.`,
    );
  }

  return {
    id: project.id,
    name: project.name,
  };
}

/**
 * Create a Vercel project.
 *
 * If a project with the same name already exists:
 * - Reuse it only when it is connected to the expected GitHub repository.
 * - Otherwise throw a clear conflict error.
 *
 * Random project names are intentionally not generated.
 */
export async function createVercelProject(
  token: string,
  teamId: string | undefined,
  options: VercelProjectOptions,
): Promise<VercelProjectResult> {
  try {
    const project = await vercel<VercelProjectResponse>(
      token,
      teamId,
      "POST",
      "/v11/projects",
      {
        name: options.name,
        framework: options.framework,
        buildCommand: options.buildCommand,
        outputDirectory: options.outputDirectory,
        gitRepository: {
          type: "github",
          repo: options.repoFullName,
        },
      },
    );

    return {
      id: project.id,
      name: project.name,
    };
  } catch (error) {
    if (
      error instanceof VercelError &&
      /install the github integration|repository/i.test(error.message)
    ) {
      throw new Error(
        "Vercel به Repository گیت‌هاب دسترسی ندارد. " +
          "در Vercel → Settings → Git، اپ GitHub را نصب کنید " +
          "و دسترسی به همه Repositoryها یا Repository موردنظر را بدهید.",
      );
    }

    if (!(error instanceof VercelError) || error.status !== 409) {
      throw error;
    }

    const existingProject = await getExistingProjectForRepository(
      token,
      teamId,
      options.name,
      options.repoFullName,
    );

    if (existingProject) {
      return existingProject;
    }

    throw new Error(
      `ساخت پروژه Vercel با نام "${options.name}" با خطای تداخل نام مواجه شد، ` +
        "اما پروژه قابل بازیابی نبود. نام پروژه و دسترسی حساب Vercel را بررسی کنید.",
    );
  }
}

/**
 * Create or update a project environment variable.
 */
export async function upsertEnv(
  token: string,
  teamId: string | undefined,
  projectId: string,
  key: string,
  value: string,
): Promise<void> {
  await vercel(
    token,
    teamId,
    "POST",
    `/v10/projects/${projectId}/env?upsert=true`,
    {
      key,
      value,
      type: "encrypted",
      target: ["production", "preview"],
    },
  );
}

/**
 * Trigger a production deployment from GitHub.
 */
export async function deployFromGit(
  token: string,
  teamId: string | undefined,
  projectName: string,
  repoId: number,
  ref: string,
): Promise<{ id: string }> {
  const deployment = await vercel<{
    id: string;
  }>(
    token,
    teamId,
    "POST",
    "/v13/deployments",
    {
      name: projectName,
      project: projectName,
      target: "production",
      gitSource: {
        type: "github",
        repoId,
        ref,
      },
    },
  );

  return {
    id: deployment.id,
  };
}

/**
 * Retrieve deployment status and production URL.
 */
export async function getDeployment(
  token: string,
  teamId: string | undefined,
  deploymentId: string,
): Promise<{
  readyState:
    | "QUEUED"
    | "BUILDING"
    | "INITIALIZING"
    | "READY"
    | "ERROR"
    | "CANCELED";
  productionUrl: string | null;
  errorMessage: string | null;
}> {
  const deployment = await vercel<{
    readyState:
      | "QUEUED"
      | "BUILDING"
      | "INITIALIZING"
      | "READY"
      | "ERROR"
      | "CANCELED";
    alias?: string[];
    errorMessage?: string;
  }>(
    token,
    teamId,
    "GET",
    `/v13/deployments/${deploymentId}`,
  );

  const aliases: string[] = deployment.alias ?? [];

  return {
    readyState: deployment.readyState,

    // The production alias (e.g. my-app.vercel.app) is public.
    // The per-deployment URL may be protected.
    productionUrl: aliases[0]
      ? `https://${aliases[0]}`
      : null,

    errorMessage: deployment.errorMessage ?? null,
  };
}
