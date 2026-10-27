import type { AppTemplate } from "../db/schema";
import type { AppSpec } from "../spec";
import { BACKEND_DEPENDENCIES, backendFiles } from "./backend";
import { capacitorFiles, capacitorPermissions } from "./capacitor";
import { SHARED_GITIGNORE, WORKFLOW_PATH, androidPackageId, buildWorkflow } from "./common";
import { expoFiles } from "./expo";
import { ALLOWED_LIBRARIES } from "./libraries";
import type { GeneratedFile } from "./types";

export type { GeneratedFile };
export { WORKFLOW_FILE, slugify } from "./common";

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 1_500_000;
const ALLOWED_EXTENSIONS = /\.(tsx?|jsx?|css|json|sql|svg|md|txt)$/;
const SAFE_PATH = /^[A-Za-z0-9_\-./[\]()]+$/;

/** Paths the AI may write to, per template. Everything else is template-owned. */
function isAllowedAiPath(template: AppTemplate, path: string, needsBackend: boolean): boolean {
  if (path === "db/schema.sql") return needsBackend;
  if (path.startsWith("api/")) return needsBackend && !path.startsWith("api/_lib/");
  if (template === "capacitor") return path.startsWith("src/") || path.startsWith("public/");
  return path === "App.tsx" || path.startsWith("src/");
}

const ENTRY_FILE: Record<AppTemplate, string> = { capacitor: "src/App.tsx", expo: "App.tsx" };

export interface SanitizeResult {
  files: GeneratedFile[];
  warnings: string[];
}

/** Validates AI-produced files: path traversal, size limits and ownership. */
export function sanitizeAiFiles(
  template: AppTemplate,
  files: GeneratedFile[],
  needsBackend: boolean,
  lockedPaths: Set<string>,
): SanitizeResult {
  const warnings: string[] = [];
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
    accepted.set(path, { path, content: file.content });
  }

  if (accepted.size > MAX_FILES) throw new Error(`تعداد فایل‌های تولیدشده بیش از ${MAX_FILES} است.`);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error("حجم کل کد تولیدشده بیش از حد مجاز است.");
  if (!accepted.has(ENTRY_FILE[template])) {
    throw new Error(`خروجی هوش مصنوعی فایل اصلی ${ENTRY_FILE[template]} را ندارد.`);
  }
  return { files: [...accepted.values()], warnings };
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
    androidPermissions:
      template === "capacitor"
        ? capacitorPermissions(dependencies)
        : spec.devicePermissions.filter((p) => /^[A-Z_]+$/.test(p)),
  };

  const templateFiles: GeneratedFile[] = [
    ...(template === "capacitor" ? capacitorFiles(ctx) : expoFiles(ctx, needsBackend)),
    ...(needsBackend ? backendFiles() : []),
    { path: WORKFLOW_PATH, content: buildWorkflow(template, slug) },
    { path: ".gitignore", content: SHARED_GITIGNORE },
    { path: "README.md", content: projectReadme(spec, template) },
  ];

  const locked = new Set(templateFiles.map((f) => f.path));
  const sanitized = sanitizeAiFiles(template, input.aiFiles, needsBackend, locked);

  return {
    files: [...templateFiles, ...sanitized.files].sort((a, b) => a.path.localeCompare(b.path)),
    warnings: [...warnings, ...sanitized.warnings],
  };
}

function projectReadme(spec: AppSpec, template: AppTemplate): string {
  const stack = template === "capacitor" ? "React + Vite + Tailwind CSS + Capacitor" : "React Native (Expo)";
  return `# ${spec.appName}

${spec.summary}

Generated by **Idea2App AI** (${stack}).

## Features

${spec.features.map((f) => `- ${f}`).join("\n")}

## Getting the APK

Every push to \`main\` runs the **Build Android APK** workflow. The APK is attached
to a GitHub Release named \`build-<run number>\` and uploaded as a workflow artifact.

The APK is signed with a debug key and is meant for testing. Publishing to Google
Play requires a release keystore stored in GitHub Secrets.
${spec.needsBackend ? "\n## Backend\n\nServerless API in `api/` (Vercel Functions) with a Neon PostgreSQL database (`db/schema.sql`).\nThe app reads the backend URL from the `API_URL` repository variable at build time.\n" : ""}`;
}
