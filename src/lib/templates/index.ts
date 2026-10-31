import type { AppTemplate } from "../db/schema";
import type { AppSpec } from "../spec";
import { BACKEND_DEPENDENCIES, BACKEND_SCRIPTS, backendFiles } from "./backend";
import { capacitorFiles, capacitorPermissions } from "./capacitor";
import { MANIFEST_PATH, SHARED_GITIGNORE, androidPackageId, buildWorkflow, projectManifest, workflowPath } from "./common";
import { expoFiles } from "./expo";
import { ALLOWED_LIBRARIES } from "./libraries";
import { checkImports, type UnresolvedImport } from "./imports";
import type { GeneratedFile } from "./types";
import { webFiles } from "./web";

export type { GeneratedFile };
export { slugify, workflowFile } from "./common";

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 1_500_000;
const ALLOWED_EXTENSIONS = /\.(tsx?|jsx?|css|json|sql|svg|md|txt)$/;
const SAFE_PATH = /^[A-Za-z0-9_\-./[\]()]+$/;

/** Paths the AI may write to, per template. Everything else is template-owned. */
function isAllowedAiPath(template: AppTemplate, path: string, needsBackend: boolean): boolean {
  if (path === "db/schema.sql" || path.startsWith("server/")) return needsBackend;
  if (template === "expo") return path === "App.tsx" || path.startsWith("src/");
  return path.startsWith("src/") || path.startsWith("public/");
}

const ENTRY_FILES: Record<AppTemplate, string> = { capacitor: "src/App.tsx", expo: "App.tsx", web: "src/App.tsx" };

export function entryFiles(template: AppTemplate, needsBackend: boolean): string[] {
  return needsBackend ? [ENTRY_FILES[template], "server/app.ts"] : [ENTRY_FILES[template]];
}

export interface SanitizeResult {
  files: GeneratedFile[];
  warnings: string[];
  /** Named imports of known libraries that the library does not export (needs a repair round). */
  unresolvedImports: UnresolvedImport[];
}

/** Validates AI-produced files: path traversal, size limits and ownership. */
export function sanitizeAiFiles(
  template: AppTemplate,
  files: GeneratedFile[],
  needsBackend: boolean,
  lockedPaths: Set<string>,
): SanitizeResult {
  const warnings: string[] = [];
  const unresolvedImports: UnresolvedImport[] = [];
  const accepted = new Map<string, GeneratedFile>();
  let totalBytes = 0;

  for (const file of files) {
    const path = file.path.trim().replace(/^\.\/+/, "");
    const segments = path.split("/");
    if (
      !path ||
      path.startsWith("/") ||
      !SAFE_PATH.test(path) ||
      segments.some((s) => s === "" || s === "." || s === "..")
    ) {
      warnings.push(`مسیر نامعتبر رد شد: ${file.path}`);
      continue;
    }
    if (!ALLOWED_EXTENSIONS.test(path)) {
      warnings.push(`نوع فایل مجاز نیست: ${path}`);
      continue;
    }
    if (lockedPaths.has(path) || !isAllowedAiPath(template, path, needsBackend)) {
      warnings.push(`فایل قالب یا خارج از محدوده مجاز نادیده گرفته شد: ${path}`);
      continue;
    }
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > MAX_FILE_BYTES) {
      warnings.push(`فایل بیش از حد بزرگ است: ${path}`);
      continue;
    }
    totalBytes += bytes;
    let content = file.content;
    if (/\.(tsx?|jsx?)$/.test(path)) {
      const checked = checkImports(path, content);
      content = checked.content;
      for (const fix of checked.fixed) warnings.push(`آیکن ناموجود جایگزین شد (${path}): ${fix}`);
      unresolvedImports.push(...checked.unresolved);
    }
    accepted.set(path, { path, content });
  }

  if (accepted.size > MAX_FILES) throw new Error(`تعداد فایل‌های تولیدشده بیش از ${MAX_FILES} است.`);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error("حجم کل کد تولیدشده بیش از حد مجاز است.");
  for (const entry of entryFiles(template, needsBackend)) {
    if (!accepted.has(entry)) throw new Error(`خروجی هوش مصنوعی فایل اصلی ${entry} را ندارد.`);
  }
  return { files: [...accepted.values()], warnings, unresolvedImports };
}

export interface RenderInput {
  template: AppTemplate;
  slug: string;
  spec: AppSpec;
  aiFiles: GeneratedFile[];
  requestedLibraries: string[];
}

export interface RenderResult {
  files: GeneratedFile[];
  warnings: string[];
  unresolvedImports: UnresolvedImport[];
}

/** Combines template-owned files with validated AI files into a full repository. */
export function renderProject(input: RenderInput): RenderResult {
  const { template, slug, spec } = input;
  const needsBackend = spec.needsBackend;
  const allowed = ALLOWED_LIBRARIES[template];
  const warnings: string[] = [];

  const dependencies: Record<string, string> = {};
  for (const name of input.requestedLibraries) {
    if (allowed[name]) dependencies[name] = allowed[name];
    else warnings.push(`کتابخانه خارج از فهرست مجاز حذف شد: ${name}`);
  }
  if (needsBackend) Object.assign(dependencies, BACKEND_DEPENDENCIES);

  const ctx = {
    slug,
    packageId: androidPackageId(slug),
    spec,
    dependencies,
    scripts: needsBackend ? BACKEND_SCRIPTS : {},
    androidPermissions:
      template === "capacitor"
        ? capacitorPermissions(dependencies)
        : spec.devicePermissions.filter((p) => /^[A-Z_]+$/.test(p)),
  };

  const appFiles =
    template === "capacitor" ? capacitorFiles(ctx) : template === "web" ? webFiles(ctx) : expoFiles(ctx, needsBackend);

  const templateFiles: GeneratedFile[] = [
    ...appFiles,
    ...(needsBackend ? backendFiles() : []),
    { path: workflowPath(template), content: buildWorkflow(template, slug) },
    { path: MANIFEST_PATH, content: projectManifest(template, needsBackend) },
    { path: ".gitignore", content: SHARED_GITIGNORE },
    { path: "README.md", content: projectReadme(spec, template) },
  ];

  const locked = new Set(templateFiles.map((f) => f.path));
  const sanitized = sanitizeAiFiles(template, input.aiFiles, needsBackend, locked);
  for (const item of sanitized.unresolvedImports) {
    sanitized.warnings.push(`ایمپورت نامعتبر (${item.file}): «${item.name}» در ${item.module} وجود ندارد.`);
  }

  return {
    files: [...templateFiles, ...sanitized.files].sort((a, b) => a.path.localeCompare(b.path)),
    warnings: [...warnings, ...sanitized.warnings],
    unresolvedImports: sanitized.unresolvedImports,
  };
}

const STACKS: Record<AppTemplate, string> = {
  capacitor: "React + Vite + Tailwind CSS + Capacitor (Android)",
  expo: "React Native (Expo, Android)",
  web: "React + Vite + Tailwind CSS (website)",
};

function projectReadme(spec: AppSpec, template: AppTemplate): string {
  const delivery =
    template === "web"
      ? `## Build & hosting

Every push to \`main\` runs the **Build website** workflow (\`npm run build\` → \`dist/\`).
When a VPS is connected, the Idea2App deploy agent on the server pulls each new
commit, builds it and serves it over HTTPS.`
      : `## Getting the APK

Every push to \`main\` runs the **Build Android APK** workflow. The APK is attached
to a GitHub Release named \`build-<run number>\` and uploaded as a workflow artifact.

The APK is signed with a debug key and is meant for testing. Publishing to Google
Play requires a release keystore stored in GitHub Secrets.`;
  const backend = spec.needsBackend
    ? `

## Backend

Hono API in \`server/app.ts\` mounted at \`/api\`, PostgreSQL via postgres.js (\`DATABASE_URL\`),
schema in \`db/schema.sql\`.

- VPS: \`npm run server\` (the deploy agent runs it as a systemd service behind Caddy).
- Vercel: \`api/index.ts\` + \`vercel.json\` run the same app as one function.
`
    : "";
  return `# ${spec.appName}

${spec.summary}

Generated by **Idea2App AI** (${STACKS[template]}).

## Features

${spec.features.map((f) => `- ${f}`).join("\n")}

${delivery}${backend}`;
}
