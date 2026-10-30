
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectView } from "@/lib/projects";
import type { AppSpec } from "@/lib/spec";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";
import { GuideToggle } from "./guides/Guide";
import type { GuideId } from "./guides/data";
import { StatusBadge } from "./StatusBadge";

type Busy = null | "spec" | "approve" | "code" | "github" | "rebuild" | "fix" | "cloud";

const BUSY_MESSAGES: Record<Exclude<Busy, null>, string> = {
  spec: "هوش مصنوعی در حال تحلیل ایده است (معمولاً کمتر از یک دقیقه)…",
  approve: "در حال ذخیره…",
  code: "هوش مصنوعی در حال نوشتن کد است؛ ممکن است تا ۴ دقیقه طول بکشد…",
  github: "در حال ساخت Repository و ثبت کد در GitHub…",
  rebuild: "در حال شروع Build جدید…",
  fix: "هوش مصنوعی در حال بررسی گزارش خطا و اصلاح کد است…",
  cloud: "در حال ساخت دیتابیس Neon و پروژه Vercel…",
};

export function ProjectWorkspace({
  initialProject,
  githubConnected,
}: {
  initialProject: ProjectView;
  githubConnected: boolean;
}) {
  const [project, setProject] = useState(initialProject);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState(initialProject.aiProvider);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(initialProject.lastError);

  useEffect(() => {
    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  const run = useCallback(
    async (kind: Exclude<Busy, null>, url: string, method: string, body?: unknown) => {
      setBusy(kind);
      setError(null);

      try {
        const data = await api<{ project: ProjectView }>(url, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        });

        setProject(data.project);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const base = `/api/projects/${project.id}`;

  // Poll GitHub Actions while a build is running.
  const buildRunning = project.build !== null && project.build.status !== "completed";

  useEffect(() => {
    if (!buildRunning) return;

    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/build`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 10_000);

    return () => clearInterval(timer);
  }, [buildRunning, base]);

  // Poll Vercel while the backend is deploying.
  const deploying = project.deployment?.status === "deploying";

  useEffect(() => {
    if (!deploying) return;

    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/cloud`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 8_000);

    return () => clearInterval(timer);
  }, [deploying, base]);

  // Poll the project while the VPS agent installs or deploys.
  const vpsBusy =
    project.vps !== null &&
    (project.vps.status === "pending" || project.vps.status === "deploying");

  useEffect(() => {
    if (!vpsBusy) return;

    const timer = setInterval(() => {
      api<{ project: ProjectView }>(base)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 10_000);

    return () => clearInterval(timer);
  }, [vpsBusy, base]);

  const specApproved = Boolean(project.specApprovedAt);
  const hasCode =
    Boolean(project.generation?.files.length) &&
    project.generation?.kind !== "spec";

  const isWebsite = project.kind === "website";
  const product = isWebsite ? "سایت" : "اپ";
  const deployFailed = project.vps?.status === "error";

  return (
    <div className="workspace-shell flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>

          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            {project.idea}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="provider" className="text-sm text-slate-500">
            مدل:
          </label>

          <select
            id="provider"
            className="input w-auto"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.label} — {p.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="workspace-notice workspace-notice-loading flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {BUSY_MESSAGES[busy]}
        </div>
      )}

      {error && !busy && (
        <div
          role="alert"
          className="workspace-notice workspace-notice-error rounded-xl px-4 py-3 text-sm whitespace-pre-wrap"
        >
          {error}
        </div>
      )}

      <Step number={1} title="نیازمندی‌ها و طراحی" done={specApproved}>
        <SpecStep
          spec={project.spec}
          approved={specApproved}
          disabled={busy !== null}
          onGenerate={(feedback) =>
            run("spec", `${base}/spec`, "POST", { feedback, provider })
          }
          onApprove={(spec) =>
            run("approve", `${base}/spec`, "PUT", spec ? { spec } : {})
          }
        />
      </Step>

      <Step
        number={2}
        title={`تولید کد ${product}`}
        done={hasCode}
        locked={!specApproved}
      >
        <CodeStep
          project={project}
          disabled={busy !== null || !specApproved}
          onGenerate={() => run("code", `${base}/generate`, "POST", { provider })}
        />
      </Step>

      <Step
        number={3}
        title={isWebsite ? "GitHub و Build سایت" : "GitHub و ساخت APK"}
        done={project.build?.conclusion === "success"}
        locked={!hasCode}
      >
        <BuildStep
          project={project}
          githubConnected={githubConnected}
          disabled={busy !== null || !hasCode}
          onPush={() => run("github", `${base}/github`, "POST")}
          onRebuild={() => run("rebuild", `${base}/build`, "POST")}
          onFix={() => run("fix", `${base}/fix`, "POST", { provider })}
        />
      </Step>

      {project.hosting === "none" ? (
        <Step
          number={4}
          title="اجرا روی گوشی"
          done={project.build?.conclusion === "success"}
          locked={!hasCode}
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            این اپ محلی است و همه داده‌ها روی گوشی ذخیره می‌شوند؛ به سرور یا فضای ابری نیاز ندارد. فقط APK را نصب کنید.
          </p>

          <div className="mt-3">
            <GuideToggle id="install-apk" />
          </div>
        </Step>
      ) : project.hosting === "vercel" ? (
        <Step
          number={4}
          title="اجرا روی Vercel + Neon (رایگان)"
          done={project.deployment?.status === "ready"}
          locked={!project.repo}
        >
          <CloudStep
            project={project}
            disabled={busy !== null || !project.repo}
            onProvision={() => run("cloud", `${base}/cloud`, "POST")}
          />
        </Step>
      ) : (
        <Step
          number={4}
          title={project.vpsProvider === "own" ? "اجرا روی VPS خودتان" : "اجرا روی VPS رایگان"}
          done={project.vps?.status === "online"}
          locked={!project.repo}
        >
          <VpsStep
            project={project}
            disabled={busy !== null || !project.repo}
            onChange={setProject}
            onError={setError}
            onFix={() => run("fix", `${base}/fix`, "POST", { provider })}
            canFix={deployFailed}
          />
        </Step>
      )}
    </div>
  );
}

function Step({
  number,
  title,
  done,
  locked,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`workspace-step card ${locked ? "is-locked" : ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-emerald-500 text-white"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          {done ? "✓" : number.toLocaleString("fa-IR")}
        </span>

        <h2 className="text-lg font-bold">{title}</h2>
      </div>

      {children}
    </section>
  );
}

// ------------------------------------------------------------------ spec

function SpecStep({
  spec,
  approved,
  disabled,
  onGenerate,
  onApprove,
}: {
  spec: AppSpec | null;
  approved: boolean;
  disabled: boolean;
  onGenerate: (feedback?: string) => void;
  onApprove: (edited?: AppSpec) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(
    () => setRawJson(spec ? JSON.stringify(spec, null, 2) : ""),
    [spec],
  );

  if (!spec) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          هوش مصنوعی ایده را به صفحات، قابلیت‌ها، مدل داده و نیاز به سرور تبدیل می‌کند. قبل از تولید کد آن را بررسی و تأیید می‌کنی.
        </p>

        <button
          className="btn-primary"
          disabled={disabled}
          onClick={() => onGenerate()}
        >
          تحلیل ایده با هوش مصنوعی
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-bold">{spec.appName}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {spec.summary}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-bold">صفحات</h4>

          <ul className="space-y-2 text-sm">
            {spec.screens.map((screen) => (
              <li
                key={screen.name}
                className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"
              >
                <span className="font-medium">{screen.name}</span>
                <span className="text-slate-500"> — {screen.purpose}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 text-sm font-bold">قابلیت‌ها</h4>

            <ul className="list-disc space-y-1 ps-5 text-sm">
              {spec.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          {spec.dataModel.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold">مدل داده</h4>

              <ul className="space-y-1 text-sm">
                {spec.dataModel.map((entity) => (
                  <li key={entity.entity}>
                    <span className="font-medium">{entity.entity}</span>:{" "}
                    <span dir="ltr" className="font-mono text-xs text-slate-500">
                      {entity.fields.map((f) => `${f.name}:${f.type}`).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60">
            {spec.needsBackend
              ? "🌐 به سرور و دیتابیس ابری نیاز دارد: "
              : "📱 بدون سرور؛ داده‌ها روی گوشی ذخیره می‌شوند. "}
            <span className="text-slate-500">{spec.backendReason}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="feedback">
          تغییرات موردنظر (اختیاری)
        </label>

        <textarea
          id="feedback"
          className="input min-h-20"
          placeholder="مثلاً: صفحه گزارش سالانه هم اضافه شود؛ ورود کاربر لازم نیست."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">
          ویرایش پیشرفته (JSON)
        </summary>

        <textarea
          dir="ltr"
          className="input mt-2 min-h-64 font-mono text-xs"
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
        />

        {jsonError && <p className="mt-1 text-red-600">{jsonError}</p>}
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={disabled}
          onClick={() => {
            let edited: AppSpec | undefined;

            if (rawJson && rawJson !== JSON.stringify(spec, null, 2)) {
              try {
                edited = JSON.parse(rawJson) as AppSpec;
              } catch {
                return setJsonError("JSON نامعتبر است.");
              }
            }

            setJsonError(null);
            onApprove(edited);
          }}
        >
          {approved ? "ذخیره و تأیید مجدد" : "تأیید نیازمندی‌ها"}
        </button>

        <button
          className="btn-secondary"
          disabled={disabled}
          onClick={() => onGenerate(feedback || undefined)}
        >
          {feedback ? "بازنویسی با این تغییرات" : "تحلیل دوباره"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ code

function CodeStep({
  project,
  disabled,
  onGenerate,
}: {
  project: ProjectView;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const files = project.generation?.files ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  const current =
    files.find((f) => f.path === selected) ??
    files.find((f) => f.path.endsWith("App.tsx")) ??
    files[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={disabled}
          onClick={onGenerate}
        >
          {files.length ? "تولید دوباره کد" : "تولید کد"}
        </button>

        {project.generation && (
          <span className="text-xs text-slate-500">
            {project.generation.kind === "fix" ? "اصلاح‌شده" : "تولیدشده"} با{" "}
            {project.generation.provider} ·{" "}
            <span dir="ltr">{project.generation.model}</span> ·{" "}
            {files.length.toLocaleString("fa-IR")} فایل
          </span>
        )}
      </div>

      {project.generation?.notes && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {project.generation.notes}
        </p>
      )}

      {project.generation?.warnings.length ? (
        <ul className="list-disc rounded-lg bg-amber-50 p-3 ps-8 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {project.generation.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 && current && (
        <div className="grid gap-3 md:grid-cols-[240px_1fr]">
          <ul
            dir="ltr"
            className="max-h-96 overflow-auto rounded-lg border border-slate-200 p-1 font-mono text-xs dark:border-slate-800"
          >
            {files.map((file) => (
              <li key={file.path}>
                <button
                  onClick={() => setSelected(file.path)}
                  className={`w-full truncate rounded px-2 py-1 text-left ${
                    file.path === current.path
                      ? "bg-brand-600 text-white"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {file.path}
                </button>
              </li>
            ))}
          </ul>

          <pre
            dir="ltr"
            className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-left text-xs text-slate-100"
          >
            <code>{current.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- build

function buildStatusText(status: string, isWebsite: boolean) {
  const map: Record<string, string> = {
    waiting: "در انتظار شروع Workflow…",
    queued: "در صف GitHub Actions…",
    in_progress: isWebsite
      ? "در حال Build سایت (حدود ۱ تا ۳ دقیقه)…"
      : "در حال ساخت APK (معمولاً ۵ تا ۱۵ دقیقه)…",
    completed: "پایان یافت",
  };

  return map[status] ?? status;
}

function BuildStep({
  project,
  githubConnected,
  disabled,
  onPush,
  onRebuild,
  onFix,
}: {
  project: ProjectView;
  githubConnected: boolean;
  disabled: boolean;
  onPush: () => void;
  onRebuild: () => void;
  onFix: () => void;
}) {
  const build = project.build;
  const pushedCurrent = project.status === "pushed";
  const isWebsite = project.kind === "website";

  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          برای ذخیره کد و ساخت {isWebsite ? "سایت" : "APK"}، ابتدا حساب GitHub خود را متصل کنید (رایگان).
        </p>

        <div>
          <a href="/api/auth/github" className="btn-primary">
            اتصال GitHub
          </a>
        </div>

        <GuideToggle id="github" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={disabled || pushedCurrent}
          onClick={onPush}
        >
          {project.repo
            ? "ارسال نسخه جدید کد به GitHub"
            : "ساخت Repository و شروع Build"}
        </button>

        {project.repo && (
          <a
            href={project.repo.url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
            dir="ltr"
          >
            {project.repo.owner}/{project.repo.name}
          </a>
        )}
      </div>

      {build && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">
                Build {build.runNumber ? `#${build.runNumber.toLocaleString("fa-IR")}` : ""} —{" "}
                {build.status === "completed"
                  ? build.conclusion === "success"
                    ? "✅ موفق"
                    : build.conclusion === "cancelled"
                      ? "⏹ لغو شد"
                      : "❌ ناموفق"
                  : buildStatusText(build.status, isWebsite)}
              </div>

              <div className="text-xs text-slate-500" dir="ltr">
                commit {build.commitSha.slice(0, 7)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {build.runUrl && (
                <a
                  href={build.runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  گزارش Build
                </a>
              )}

              {build.status === "completed" && (
                <button
                  className="btn-secondary"
                  disabled={disabled}
                  onClick={onRebuild}
                >
                  Build مجدد
                </button>
              )}
            </div>
          </div>

          {build.conclusion === "success" && isWebsite && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              کد سایت سالم Build شد. انتشار روی اینترنت در مرحله بعد انجام می‌شود.
            </p>
          )}

          {build.conclusion === "success" && !isWebsite && build.downloadable && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/api/projects/${project.id}/apk`}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700"
                >
                  ⬇️ دانلود فایل APK
                </a>

                <span className="text-xs text-emerald-800 dark:text-emerald-300">
                  {build.apkName}
                  {build.apkSizeBytes
                    ? ` · ${(build.apkSizeBytes / 1024 / 1024).toFixed(1)} MB`
                    : ""}{" "}
                  — نسخه آزمایشی با امضای Debug
                </span>
              </div>

              <GuideToggle id="install-apk" />
            </div>
          )}

          {build.conclusion === "failure" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-950">
              <button
                className="btn-primary"
                disabled={disabled}
                onClick={onFix}
              >
                🛠 اصلاح خودکار خطا با هوش مصنوعی
              </button>

              <span className="text-xs text-red-800 dark:text-red-300">
                گزارش خطای Build برای مدل ارسال می‌شود و نسخه اصلاح‌شده دوباره Build می‌شود.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- cloud

function CloudStep({
  project,
  disabled,
  onProvision,
}: {
  project: ProjectView;
  disabled: boolean;
  onProvision: () => void;
}) {
  const deployment = project.deployment;
  const needsBackend = project.spec?.needsBackend;
  const isWebsite = project.kind === "website";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-slate-600 dark:text-slate-400">
        {needsBackend
          ? `یک دیتابیس PostgreSQL اختصاصی در Neon ساخته و schema.sql اجرا می‌شود، سپس ${isWebsite ? "سایت و API" : "API"} روی Vercel مستقر می‌شود${
              isWebsite ? "." : " و نشانی آن در Build بعدی APK قرار می‌گیرد."
            }`
          : isWebsite
            ? "سایت روی Vercel منتشر می‌شود و یک نشانی ‎*.vercel.app‎ با HTTPS می‌گیرد."
            : "این اپ بدون سرور کار می‌کند."}
      </p>

      <p className="text-xs text-slate-500">
        پیش‌نیاز: توکن Vercel{needsBackend ? " و کلید Neon" : ""} در صفحه «اتصال‌ها و کلیدها» و نصب اپ GitHub روی حساب Vercel.
      </p>

      <GuideToggle id="vercel-neon" />

      {deployment ? (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="font-medium">
            وضعیت:{" "}
            {{
              provisioning: "در حال آماده‌سازی…",
              deploying: "در حال استقرار روی Vercel…",
              ready: "✅ فعال",
              failed: "❌ ناموفق",
            }[deployment.status] ?? deployment.status}
          </div>

          {deployment.hasDatabase && (
            <div className="text-xs text-slate-500">
              دیتابیس Neon متصل است.
            </div>
          )}

          {deployment.url && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline"
              dir="ltr"
            >
              {deployment.url}
            </a>
          )}

          {deployment.error && (
            <p className="mt-2 whitespace-pre-wrap text-red-600">
              {deployment.error}
            </p>
          )}

          {deployment.status === "failed" && (
            <button
              className="btn-secondary mt-3"
              disabled={disabled}
              onClick={onProvision}
            >
              تلاش دوباره
            </button>
          )}
        </div>
      ) : (
        <div>
          <button
            className="btn-primary"
            disabled={disabled}
            onClick={onProvision}
          >
            {needsBackend
              ? "ساخت دیتابیس Neon و استقرار روی Vercel"
              : "انتشار روی Vercel"}
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- vps

interface InstallInstructions {
  token: string;
  command: string;
  cloudInit: string;
  expiresAt: string;
}

const VPS_GUIDES: Record<string, GuideId> = {
  own: "own-vps",
  oracle: "oracle",
  gcp: "gcp",
  aws: "aws",
};

const VPS_STATUS: Record<string, { text: string; className: string }> = {
  pending: {
    text: "⏳ منتظر اجرای نصب‌کننده روی سرور",
    className: "text-amber-700 dark:text-amber-300",
  },
  deploying: {
    text: "🔄 در حال استقرار…",
    className: "text-sky-700 dark:text-sky-300",
  },
  online: {
    text: "✅ فعال",
    className: "text-emerald-700 dark:text-emerald-300",
  },
  error: {
    text: "❌ استقرار ناموفق",
    className: "text-red-700 dark:text-red-300",
  },
};

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>

        <button
          type="button"
          className="btn-secondary min-h-0 px-2 py-1 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "کپی شد ✓" : "کپی"}
        </button>
      </div>

      <pre
        dir="ltr"
        className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-left text-xs whitespace-pre-wrap break-all text-emerald-300"
      >
        {value}
      </pre>
    </div>
  );
}

function VpsStep({
  project,
  disabled,
  onChange,
  onError,
  onFix,
  canFix,
}: {
  project: ProjectView;
  disabled: boolean;
  onChange: (project: ProjectView) => void;
  onError: (message: string | null) => void;
  onFix: () => void;
  canFix: boolean;
}) {
  const [install, setInstall] = useState<InstallInstructions | null>(null);
  const [busy, setBusy] = useState(false);

  const vps = project.vps;
  const own = project.vpsProvider === "own";
  const guide = VPS_GUIDES[project.vpsProvider ?? "own"] ?? "own-vps";

  async function createCommand() {
    setBusy(true);
    onError(null);

    try {
      const data = await api<{
        install: InstallInstructions;
        project: ProjectView;
      }>(`/api/projects/${project.id}/vps`, {
        method: "POST",
      });

      setInstall(data.install);
      onChange(data.project);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !confirm(
        "اتصال این سرور حذف شود؟ کلید استقرار از GitHub پاک می‌شود؛ خود سرور دست نمی‌خورد.",
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const data = await api<{ project: ProjectView }>(
        `/api/projects/${project.id}/vps`,
        { method: "DELETE" },
      );

      setInstall(null);
      onChange(data.project);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = vps
    ? VPS_STATUS[vps.status] ?? { text: vps.status, className: "" }
    : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-slate-600 dark:text-slate-400">
        ایجنت Idea2App روی سرور نصب می‌شود: کد را با یک کلید فقط‌خواندنی از GitHub می‌گیرد، Build می‌کند
        {project.spec?.needsBackend ? "، PostgreSQL و API را راه می‌اندازد" : ""}، با HTTPS منتشر می‌کند و هر ۲ دقیقه
        Commit جدید را بررسی و خودکار مستقر می‌کند.
      </p>

      <GuideToggle id={guide} />

      {vps && vps.registered && status && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`font-medium ${status.className}`}>
              {status.text}
            </div>

            <div className="text-xs text-slate-500" dir="ltr">
              {vps.hostname} {vps.ip ? `· ${vps.ip}` : ""}
            </div>
          </div>

          {vps.lastMessage && (
            <div className="mt-1 text-xs text-slate-500">
              {vps.lastMessage}
            </div>
          )}

          {vps.url && vps.status === "online" && (
            <a
              href={vps.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-brand-600 underline"
              dir="ltr"
            >
              {vps.url}
            </a>
          )}

          <div className="mt-2 text-xs text-slate-500">
            {vps.deployedCommit && (
              <span dir="ltr" className="font-mono">
                commit {vps.deployedCommit.slice(0, 7)} ·{" "}
              </span>
            )}

            {vps.lastReportAt &&
              `آخرین گزارش: ${new Date(vps.lastReportAt).toLocaleString(
                "fa-IR",
                { timeZone: "Asia/Tehran" },
              )}`}
          </div>

          {vps.stale && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              بیش از ۱۰ دقیقه است که سرور گزارشی نفرستاده؛ ممکن است خاموش یا بدون اینترنت باشد. روی سرور بزنید:{" "}
              <code dir="ltr">sudo idea2app status</code>
            </p>
          )}

          {vps.lastLog && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">
                گزارش آخرین استقرار
              </summary>

              <pre
                dir="ltr"
                className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-left text-[11px] text-slate-200"
              >
                {vps.lastLog}
              </pre>
            </details>
          )}

          {canFix && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-950">
              <button
                className="btn-primary"
                disabled={disabled}
                onClick={onFix}
              >
                🛠 اصلاح خودکار خطا با هوش مصنوعی
              </button>

              <span className="text-xs text-red-800 dark:text-red-300">
                گزارش استقرار برای مدل ارسال می‌شود؛ کد اصلاح‌شده Commit و روی سرور خودکار دوباره مستقر می‌شود.
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={disabled || busy}
              onClick={createCommand}
            >
              نصب روی سرور دیگر / نصب دوباره
            </button>

            <button
              className="btn-danger"
              disabled={busy}
              onClick={disconnect}
            >
              قطع اتصال سرور
            </button>
          </div>
        </div>
      )}

      {(!vps || !vps.registered) && !install && (
        <div className="flex flex-col gap-2">
          {vps && !vps.registered && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {VPS_STATUS.pending!.text}. اگر دستور قبلی را ندارید، دستور تازه بسازید (دستور قبلی باطل می‌شود).
            </p>
          )}

          <div>
            <button
              className="btn-primary"
              disabled={disabled || busy}
              onClick={createCommand}
            >
              {busy
                ? "در حال ساخت…"
                : own
                  ? "ساخت دستور نصب"
                  : "ساخت اسکریپت نصب خودکار"}
            </button>
          </div>
        </div>
      )}

      {install && (
        <div className="flex flex-col gap-4 rounded-xl border border-brand-500/40 p-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            این دستور یک توکن یک‌بارمصرف دارد و تا{" "}
            {new Date(install.expiresAt).toLocaleString("fa-IR", {
              timeZone: "Asia/Tehran",
            })}{" "}
            معتبر است. آن را با کسی به اشتراک نگذارید. بعد از اجرا، این صفحه خودکار وضعیت سرور را نشان می‌دهد.
          </p>

          {own ? (
            <>
              <CopyBox
                label="روی سرور (با SSH) این دستور را اجرا کنید:"
                value={install.command}
              />

              <details>
                <summary className="cursor-pointer text-xs text-slate-500">
                  سرور را تازه می‌سازید؟ اسکریپت cloud-init / user-data
                </summary>

                <div className="mt-2">
                  <CopyBox label="cloud-init" value={install.cloudInit} />
                </div>
              </details>
            </>
          ) : (
            <>
              <CopyBox
                label={`این اسکریپت را هنگام ساخت سرور در ${
                  {
                    oracle: "Initialization script (Oracle)",
                    gcp: "Startup script (Google Cloud)",
                    aws: "User data (AWS)",
                  }[project.vpsProvider ?? "oracle"] ?? "cloud-init"
                } قرار دهید:`}
                value={install.cloudInit}
              />

              <details>
                <summary className="cursor-pointer text-xs text-slate-500">
                  سرور را قبلاً ساخته‌اید؟ دستور SSH
                </summary>

                <div className="mt-2">
                  <CopyBox
                    label="روی سرور اجرا کنید:"
                    value={install.command}
                  />
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
