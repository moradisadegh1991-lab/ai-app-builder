import { env } from "../env";
import type { GeneratedFile } from "../templates/types";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "idea2app-ai",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {
      // keep raw text
    }
    throw new GitHubError(response.status, `GitHub ${method} ${path} → ${response.status}: ${message}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Follows a GitHub download endpoint that answers with a short-lived redirect. */
async function signedRedirect(token: string, path: string, accept: string): Promise<string> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept,
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "idea2app-ai",
    },
    redirect: "manual",
  });
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) return location;
  throw new GitHubError(response.status, `GitHub download ${path} did not return a redirect (${response.status})`);
}

// ------------------------------------------------------------------ OAuth

/** Connecting GitHub: the platform creates repositories and runs workflows for the user. */
export const GITHUB_SCOPES = "repo workflow read:user user:email";
/** Signing in only proves identity, so it asks for no repository access. */
export const GITHUB_LOGIN_SCOPES = "read:user user:email";

export function authorizeUrl(state: string, scope: string = GITHUB_SCOPES): string {
  const params = new URLSearchParams({
    client_id: env.githubClientId(),
    redirect_uri: `${env.appUrl()}/api/auth/github/callback`,
    scope,
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/** A failed GitHub code exchange; `detail` is GitHub's short error code, safe to show the user. */
export class GitHubOAuthError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.githubClientId(),
      client_secret: env.githubClientSecret(),
      code,
      redirect_uri: `${env.appUrl()}/api/auth/github/callback`,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const code = typeof data.error === "string" && /^[a-z_]{1,40}$/.test(data.error) ? data.error : `http_${response.status}`;
    throw new GitHubOAuthError(`GitHub OAuth failed: ${data.error_description ?? data.error ?? response.status}`, code);
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export function getAuthenticatedUser(token: string) {
  return gh<GitHubUser>(token, "GET", "/user");
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * The address to identify a user by: their primary verified e-mail (GitHub returns
 * it even when it is hidden on the profile). A noreply address is never used —
 * it cannot receive login codes or receipts.
 */
export function pickVerifiedEmail(emails: GitHubEmail[]): string | null {
  const usable = emails.filter((e) => e.verified && !e.email.toLowerCase().endsWith("@users.noreply.github.com"));
  const chosen = usable.find((e) => e.primary) ?? usable[0];
  return chosen ? chosen.email.toLowerCase() : null;
}

export async function getVerifiedEmail(token: string): Promise<string | null> {
  return pickVerifiedEmail(await gh<GitHubEmail[]>(token, "GET", "/user/emails"));
}

// ------------------------------------------------------------ repositories

export interface RepoInfo {
  id: number;
  owner: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
}

export async function createRepository(token: string, baseName: string, description: string): Promise<RepoInfo> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const name = attempt === 0 ? baseName : `${baseName}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const repo = await gh(token, "POST", "/user/repos", {
        name,
        description: description.slice(0, 300),
        private: true,
        auto_init: true,
        has_wiki: false,
      });
      return {
        id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch ?? "main",
      };
    } catch (error) {
      // 422 = name already exists on this account; retry with a suffix.
      if (error instanceof GitHubError && error.status === 422) continue;
      throw error;
    }
  }
  throw new Error("ساخت Repository ممکن نشد: نام‌های پیشنهادی همگی تکراری بودند.");
}

async function getBranchHead(token: string, owner: string, repo: string, branch: string): Promise<string> {
  // A freshly auto-initialised repository can take a moment to expose its ref.
  for (let attempt = 0; ; attempt++) {
    try {
      const ref = await gh(token, "GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
      return ref.object.sha as string;
    } catch (error) {
      if (attempt >= 5 || !(error instanceof GitHubError) || (error.status !== 404 && error.status !== 409)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Commits a full snapshot of the project in a single commit using the Git
 * Data API (one tree + one commit instead of one commit per file). Files not
 * in the snapshot are removed.
 */
export async function commitSnapshot(
  token: string,
  repo: { owner: string; name: string; branch: string },
  files: GeneratedFile[],
  message: string,
): Promise<string> {
  const base = `/repos/${repo.owner}/${repo.name}`;
  const parentSha = await getBranchHead(token, repo.owner, repo.name, repo.branch);
  const tree = await gh(token, "POST", `${base}/git/trees`, {
    tree: files.map((file) => ({
      path: file.path,
      mode: file.executable ? "100755" : "100644",
      type: "blob",
      content: file.content,
    })),
  });
  const commit = await gh(token, "POST", `${base}/git/commits`, {
    message,
    tree: tree.sha,
    parents: [parentSha],
  });
  await gh(token, "PATCH", `${base}/git/refs/heads/${repo.branch}`, { sha: commit.sha, force: false });
  return commit.sha as string;
}

export async function setRepositoryVariable(token: string, owner: string, repo: string, name: string, value: string) {
  try {
    await gh(token, "PATCH", `/repos/${owner}/${repo}/actions/variables/${name}`, { name, value });
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    await gh(token, "POST", `/repos/${owner}/${repo}/actions/variables`, { name, value });
  }
}

// ----------------------------------------------------------------- actions

export interface WorkflowRun {
  id: number;
  run_number: number;
  html_url: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  path: string;
  event: string;
  created_at: string;
}

export async function dispatchWorkflow(token: string, owner: string, repo: string, workflowFile: string, ref: string) {
  await gh(token, "POST", `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, { ref });
}

/** Newest run of the given workflow for a commit, created after `notBefore`. */
export async function findWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  workflowFile: string,
  headSha: string,
  notBefore: Date,
): Promise<WorkflowRun | null> {
  const data = await gh<{ workflow_runs: WorkflowRun[] }>(
    token,
    "GET",
    `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?head_sha=${headSha}&per_page=20`,
  );
  // Allow for clock skew between this server and GitHub.
  const threshold = notBefore.getTime() - 60_000;
  const runs = data.workflow_runs
    .filter((run) => new Date(run.created_at).getTime() >= threshold)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return runs[0] ?? null;
}

export async function getWorkflowRun(token: string, owner: string, repo: string, runId: number) {
  return gh<WorkflowRun>(token, "GET", `/repos/${owner}/${repo}/actions/runs/${runId}`);
}

export async function findRunArtifact(token: string, owner: string, repo: string, runId: number) {
  const data = await gh<{ artifacts: { id: number; name: string; size_in_bytes: number; expired: boolean }[] }>(
    token,
    "GET",
    `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
  );
  return data.artifacts.find((a) => !a.expired) ?? null;
}

export async function findReleaseApk(token: string, owner: string, repo: string, tag: string) {
  try {
    const release = await gh<{ assets: { id: number; name: string; size: number }[] }>(
      token,
      "GET",
      `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    );
    return release.assets.find((asset) => asset.name.endsWith(".apk")) ?? null;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/** Last lines of the failed job's log, used as context for AI auto-fix. */
export async function failedJobLog(token: string, owner: string, repo: string, runId: number, maxLines = 150) {
  const jobs = await gh<{ jobs: { id: number; name: string; conclusion: string | null }[] }>(
    token,
    "GET",
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
  );
  const failed = jobs.jobs.find((job) => job.conclusion === "failure") ?? jobs.jobs[0];
  if (!failed) return "";
  const url = await signedRedirect(token, `/repos/${owner}/${repo}/actions/jobs/${failed.id}/logs`, "application/vnd.github+json");
  const response = await fetch(url);
  if (!response.ok) return "";
  const lines = (await response.text()).split(/\r?\n/);
  // Strip the leading timestamp GitHub adds to each line to save tokens.
  return lines
    .slice(-maxLines)
    .map((line) => line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/, ""))
    .join("\n");
}

export function releaseAssetDownloadUrl(token: string, owner: string, repo: string, assetId: number) {
  return signedRedirect(token, `/repos/${owner}/${repo}/releases/assets/${assetId}`, "application/octet-stream");
}

export function artifactDownloadUrl(token: string, owner: string, repo: string, artifactId: number) {
  return signedRedirect(token, `/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, "application/vnd.github+json");
}

// ------------------------------------------------------------- deploy keys

/** Adds a read-only SSH deploy key (used by the VPS agent to pull the code). */
export async function addDeployKey(token: string, owner: string, repo: string, title: string, key: string) {
  const data = await gh<{ id: number }>(token, "POST", `/repos/${owner}/${repo}/keys`, { title, key, read_only: true });
  return data.id;
}

export async function deleteDeployKey(token: string, owner: string, repo: string, keyId: number) {
  try {
    await gh(token, "DELETE", `/repos/${owner}/${repo}/keys/${keyId}`);
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 404) throw error;
  }
}
