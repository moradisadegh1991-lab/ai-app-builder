"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectView } from "@/lib/projects";
import type { AppSpec } from "@/lib/spec";
import { api, type ProviderInfo, type ProvidersResponse } from "./api";
import { GuideToggle } from "./guides/Guide";
import type { GuideId } from "./guides/data";
import { StatusBadge } from "./StatusBadge";
import { WorkspaceProgress } from "./WorkspaceProgress";
import { WorkspaceHeader } from "./WorkspaceHeader";

type Busy =
  | null
  | "spec"
  | "approve"
  | "code"
  | "github"
  | "rebuild"
  | "fix"
  | "edit"
  | "cloud";

const BUSY_MESSAGES: Record<Exclude<Busy, null>, string> = {
  spec: "هوش مصنوعی در حال تحلیل ایده است (معمولاً کمتر از یک دقیقه)…",
  approve: "در حال ذخیره…",
  code: "هوش مصنوعی در حال نوشتن کد است؛ ممکن است تا ۴ دقیقه طول بکشد…",
  github: "در حال ساخت Repository و ثبت کد در GitHub…",
  rebuild: "در حال شروع Build جدید…",
  fix: "هوش مصنوعی در حال بررسی گزارش خطا و اصلاح کد است…",
  edit: "هوش مصنوعی در حال اعمال تغییر روی کد است؛ بعد از آن Build جدید شروع می‌شود…",
  cloud: "در حال ساخت دیتابیس Neon و پروژه Vercel…",
};

// اعتبارسنجی شناسه مدل هوش مصنوعی
function isAiProviderId(
  value: string,
): value is ProviderInfo["id"] {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "gemini"
  );
}

export function ProjectWorkspace({
  initialProject,
  githubConnected,
}: {
  initialProject: ProjectView;
  githubConnected: boolean;
}) {
  const [project, setProject] = useState(initialProject);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  const [provider, setProvider] = useState<ProviderInfo["id"]>(
    isAiProviderId(initialProject.aiProvider)
      ? initialProject.aiProvider
      : "openai",
  );

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(
    initialProject.lastError,
  );

  useEffect(() => {
    api<ProvidersResponse>("/api/ai/providers")
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  const run = useCallback(
    async (
      kind: Exclude<Busy, null>,
      url: string,
      method: string,
      body?: unknown,
    ) => {
      setBusy(kind);
      setError(null);

      try {
        const data = await api<{ project: ProjectView }>(url, {
          method,
          body:
            body === undefined
              ? undefined
              : JSON.stringify(body),
        });

        setProject(data.project);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const base = `/api/projects/${project.id}`;

  // After a failed build the page repairs it by itself, up to project.autoFix.max rounds in a row.
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const autoFixedBuild = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("i2a_autofix") === "off") setAutoFixEnabled(false);
    } catch {
      // storage unavailable: keep the default
    }
  }, []);

  useEffect(() => {
    const build = project.build;
    if (!autoFixEnabled || busy !== null || !build || build.conclusion !== "failure") return;
    if (project.autoFix.used >= project.autoFix.max || autoFixedBuild.current === build.id) return;
    // Only for a failure that just happened, not an old one found when the page is opened later.
    if (Date.now() - new Date(build.createdAt).getTime() > 60 * 60_000) return;
    autoFixedBuild.current = build.id;
    void run("fix", `${base}/fix`, "POST", { provider, auto: true });
  }, [autoFixEnabled, busy, project.build, project.autoFix, base, provider, run]);

  const buildRunning =
    project.build !== null &&
    project.build.status !== "completed";

  useEffect(() => {
    if (!buildRunning) return;

    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/build`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 10_000);

    return () => clearInterval(timer);
  }, [buildRunning, base]);

  const deploying =
    project.deployment?.status === "deploying";

  useEffect(() => {
    if (!deploying) return;

    const timer = setInterval(() => {
      api<{ project: ProjectView }>(`${base}/cloud`)
        .then((data) => setProject(data.project))
        .catch(() => undefined);
    }, 8_000);

    return () => clearInterval(timer);
  }, [deploying, base]);

  const vpsBusy =
    project.vps !== null &&
    (project.vps.status === "pending" ||
      project.vps.status === "deploying");

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
      <WorkspaceHeader
        project={project}
        providers={providers}
        provider={provider}
        onProviderChange={setProvider}
      />

      <WorkspaceProgress
        project={project}
        githubConnected={githubConnected}
      />

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

      <Step
        number={1}
        title="نیازمندی‌ها و طراحی"
        done={specApproved}
      >
        <SpecStep
          spec={project.spec}
          approved={specApproved}
          disabled={busy !== null}
          onGenerate={(feedback) =>
            run("spec", `${base}/spec`, "POST", {
              feedback,
              provider,
            })
          }
          onApprove={(spec) =>
            run(
              "approve",
              `${base}/spec`,
              "PUT",
              spec ? { spec } : {},
            )
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
          previewUrl={
            project.kind === "website" &&
            project.deployment?.status === "ready"
              ? project.deployment.url ?? null
              : null
          }
          onGenerate={() =>
            run("code", `${base}/generate`, "POST", {
              provider,
            })
          }
        />
      </Step>

      <Step
        number={3}
        title={
          isWebsite
            ? "GitHub و Build سایت"
            : "GitHub و ساخت APK"
        }
        done={
          project.build?.status === "completed" &&
          project.build?.conclusion === "success"
        }
        locked={!hasCode}
      >
        <BuildStep
          project={project}
          githubConnected={githubConnected}
          disabled={busy !== null || !hasCode}
          onPush={() =>
            run("github", `${base}/github`, "POST")
          }
          onRebuild={() =>
            run("rebuild", `${base}/build`, "POST")
          }
          onFix={() =>
            run("fix", `${base}/fix`, "POST", {
              provider,
            })
          }
          autoFix={{
            enabled: autoFixEnabled,
            used: project.autoFix.used,
            max: project.autoFix.max,
            onChange: (value) => {
              setAutoFixEnabled(value);
              try {
                window.localStorage.setItem("i2a_autofix", value ? "on" : "off");
              } catch {
                // storage unavailable: applies to this visit only
              }
            },
          }}
        />
      </Step>

      {hasCode && (
        <EditPanel
          disabled={busy !== null}
          onEdit={(instruction) => run("edit", `${base}/edit`, "POST", { instruction, provider })}
        />
      )}

      {project.hosting === "none" ? (
        <Step
          number={4}
          title="اجرا روی گوشی"
          done={
            project.build?.status === "completed" &&
            project.build?.conclusion === "success"
          }
          locked={!hasCode}
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            این اپ محلی است و همه داده‌ها روی گوشی ذخیره می‌شوند؛
            به سرور یا فضای ابری نیاز ندارد. فقط APK را نصب کنید.
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
            onProvision={() =>
              run("cloud", `${base}/cloud`, "POST")
            }
          />
        </Step>
      ) : (
        <Step
          number={4}
          title={
            project.vpsProvider === "own"
              ? "اجرا روی VPS خودتان"
              : "اجرا روی VPS رایگان"
          }
          done={project.vps?.status === "online"}
          locked={!project.repo}
        >
          <VpsStep
            project={project}
            disabled={busy !== null || !project.repo}
            onChange={setProject}
            onError={setError}
            onFix={() =>
              run("fix", `${base}/fix`, "POST", {
                provider,
              })
            }
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
    <section
      className={`workspace-step card ${locked ? "is-locked" : ""}`}
    >
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

// ------------------------------------------------------------------
// Specification step
// ------------------------------------------------------------------

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
                <span className="text-slate-500">
                  {" "}— {screen.purpose}
                </span>
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
                    <span
                      dir="ltr"
                      className="font-mono text-xs text-slate-500"
                    >
                      {entity.fields
                        .map((f) => `${f.name}:${f.type}`)
                        .join(", ")}
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
            <span className="text-slate-500">
              {spec.backendReason}
            </span>
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

        {jsonError && (
          <p className="mt-1 text-red-600">{jsonError}</p>
        )}
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={disabled}
          onClick={() => {
            let edited: AppSpec | undefined;

            if (
              rawJson &&
              rawJson !== JSON.stringify(spec, null, 2)
            ) {
              try {
                edited = JSON.parse(rawJson) as AppSpec;
              } catch {
                setJsonError("JSON نامعتبر است.");
                return;
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
// ------------------------------------------------------------------
// Code step
// ------------------------------------------------------------------

type CodeView = "code" | "preview" | "split";

function CodeStep({
  project,
  disabled,
  previewUrl,
  onGenerate,
}: {
  project: ProjectView;
  disabled: boolean;
  previewUrl: string | null;
  onGenerate: () => void;
}) {
  const files = project.generation?.files ?? [];

  const [selectedPath, setSelectedPath] = useState("");
  const [activeView, setActiveView] = useState<CodeView>("code");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedPath("");
      return;
    }

    setSelectedPath((current) => {
      if (files.some((file) => file.path === current)) {
        return current;
      }

      return files[0].path;
    });
  }, [files]);

  const current =
    files.find((file) => file.path === selectedPath) ?? files[0];

  const safePreviewUrl =
    previewUrl &&
    (previewUrl.startsWith("https://") ||
      previewUrl.startsWith("http://"))
      ? previewUrl
      : null;

  const canPreview = Boolean(safePreviewUrl);

  if (files.length === 0 || !current) {
    return (
      <div className="code-explorer-empty">
        <div className="code-explorer-empty-icon">
          {"</>"}
        </div>

        <h3>هنوز کدی تولید نشده است</h3>

        <p>
          پس از تأیید نیازمندی‌ها، دکمه تولید کد را بزنید.
          فایل‌های پروژه در این قسمت نمایش داده می‌شوند.
        </p>

        <button
          type="button"
          className="btn-primary"
          disabled={disabled}
          onClick={onGenerate}
        >
          شروع تولید کد
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Code explorer header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">
            فایل‌های تولیدشده پروژه
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            فایل‌ها را انتخاب کنید و محتوای تولیدشده را بررسی کنید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {files.length.toLocaleString("fa-IR")} فایل
          </span>

          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={onGenerate}
          >
            تولید مجدد کد
          </button>
        </div>
      </div>

      {/* View selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={
              activeView === "code"
                ? "btn-primary"
                : "btn-secondary"
            }
            onClick={() => setActiveView("code")}
          >
            مشاهده کد
          </button>

          {canPreview && (
            <>
              <button
                type="button"
                className={
                  activeView === "preview"
                    ? "btn-primary"
                    : "btn-secondary"
                }
                onClick={() => setActiveView("preview")}
              >
                پیش‌نمایش سایت
              </button>

              <button
                type="button"
                className={
                  activeView === "split"
                    ? "btn-primary"
                    : "btn-secondary"
                }
                onClick={() => setActiveView("split")}
              >
                نمایش هم‌زمان
              </button>
            </>
          )}
        </div>

        {safePreviewUrl && (
          <a
            href={safePreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            باز کردن سایت ↗
          </a>
        )}
      </div>

      {/* Code and preview */}
      <div
        className={`grid min-w-0 gap-4 ${
          activeView === "split"
            ? "xl:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {activeView !== "preview" && (
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">
                  FILE
                </div>

                <div
                  className="mt-1 truncate font-mono text-sm font-medium"
                  dir="ltr"
                >
                  {current.path}
                </div>
              </div>

              <span className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                READ ONLY
              </span>
            </div>

            <div className="max-h-[650px] min-h-[350px] overflow-auto bg-slate-950 p-4">
              <pre
                dir="ltr"
                className="whitespace-pre-wrap break-words text-left font-mono text-xs leading-6 text-slate-200"
              >
                <code>{current.content}</code>
              </pre>
            </div>
          </section>
        )}

        {canPreview && activeView !== "code" && safePreviewUrl && (
          <section className="workspace-inline-preview min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="workspace-inline-preview-header">
              <div>
                <h3>پیش‌نمایش سایت</h3>
                <p>نسخه مستقرشده روی سرور</p>
              </div>

              <div className="workspace-inline-preview-actions">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewRefreshKey((value) => value + 1)
                  }
                >
                  بارگذاری مجدد
                </button>

                <a
                  href={safePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  باز کردن در تب جدید ↗
                </a>
              </div>
            </div>

            <div className="workspace-inline-preview-frame">
              <iframe
                key={previewRefreshKey}
                src={safePreviewUrl}
                title="پیش‌نمایش نسخه Deploy شده سایت"
                sandbox="allow-scripts allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="workspace-inline-preview-footer">
              <span>نسخه Deploy شده</span>
              <span dir="ltr">{safePreviewUrl}</span>
            </div>
          </section>
        )}
      </div>

      {/* File explorer */}
      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h4 className="text-sm font-bold">
            ساختار فایل‌های پروژه
          </h4>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const selected = file.path === current.path;

              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => {
                    setSelectedPath(file.path);
                    setActiveView("code");
                  }}
                  className={`min-w-0 rounded-lg px-3 py-2 text-right text-xs transition ${
                    selected
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="block truncate font-mono" dir="ltr">
                    {file.path}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Summary */}
      <div className="code-explorer-summary">
        <span>
          <strong>{files.length.toLocaleString("fa-IR")}</strong>
          {" "}فایل در پروژه
        </span>

        {activeView !== "preview" && (
          <span>
            فایل انتخاب‌شده:
            {" "}
            <strong dir="ltr">{current.path}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

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

/** Describe a change in plain words; the AI edits only the files it needs and a new build starts. */
function EditPanel({ disabled, onEdit }: { disabled: boolean; onEdit: (instruction: string) => Promise<boolean> }) {
  const [instruction, setInstruction] = useState("");
  const ready = instruction.trim().length >= 5;

  return (
    <section className="card flex flex-col gap-3 text-sm">
      <div>
        <h2 className="font-bold">ویرایش با گفتگو</h2>
        <p className="mt-1 text-xs leading-6 text-slate-500">
          تغییر دلخواه را بنویسید؛ مثلاً «رنگ اصلی را سبز کن»، «صفحهٔ تماس با ما اضافه کن» یا «منو را به سه دسته تقسیم کن». هوش مصنوعی فقط فایل‌های لازم را عوض می‌کند و نسخهٔ جدید به GitHub می‌رود.
        </p>
      </div>
      <textarea
        className="input min-h-24 resize-y leading-7"
        aria-label="تغییر مورد نظر"
        placeholder="چه چیزی عوض شود؟"
        value={instruction}
        maxLength={3000}
        onChange={(event) => setInstruction(event.target.value)}
        disabled={disabled}
      />
      <div>
        <button
          className="btn-primary"
          disabled={disabled || !ready}
          onClick={async () => {
            if (await onEdit(instruction)) setInstruction("");
          }}
        >
          ✏️ اعمال تغییر
        </button>
      </div>
    </section>
  );
}

function BuildStep({
  project,
  githubConnected,
  disabled,
  onPush,
  onRebuild,
  onFix,
  autoFix,
}: {
  project: ProjectView;
  githubConnected: boolean;
  disabled: boolean;
  onPush: () => void;
  onRebuild: () => void;
  onFix: () => void;
  autoFix: { enabled: boolean; used: number; max: number; onChange: (value: boolean) => void };
}) {
  const build = project.build;
  const pushedCurrent = project.status === "pushed";
  const isWebsite = project.kind === "website";

  const deployment = project.deployment;
  const deploymentStatus = deployment?.status ?? null;
  const deploymentUrl = deployment?.url ?? null;
  const deploymentError = deployment?.error ?? null;

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
            rel="noopener noreferrer"
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
                Build{" "}
                {build.runNumber
                  ? `#${build.runNumber.toLocaleString("fa-IR")}`
                  : ""}{" "}
                —{" "}
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
                  rel="noopener noreferrer"
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
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
              {deploymentStatus === "ready" && deploymentUrl ? (
                <>
                  <div className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                    <span>✓</span>
                    <span>ساخت کد و انتشار سایت با موفقیت انجام شد.</span>
                  </div>

                  <a
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="break-all text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
                  >
                    {deploymentUrl}
                  </a>
                </>
              ) : deploymentStatus === "failed" ? (
                <div className="flex flex-col gap-2">
                  <div className="font-medium text-red-700 dark:text-red-300">
                    Build موفق بود، اما استقرار سایت با خطا مواجه شده است.
                  </div>

                  {deploymentError ? (
                    <pre
                      dir="auto"
                      className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-red-100 p-3 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-200"
                    >
                      {deploymentError}
                    </pre>
                  ) : (
                    <p className="text-xs text-red-700 dark:text-red-300">
                      جزئیات خطای استقرار در دسترس نیست.
                    </p>
                  )}

                  <p className="text-xs text-red-700 dark:text-red-300">
                    برای بررسی وضعیت استقرار و رفع خطا، به مرحله استقرار ابری مراجعه کنید.
                  </p>
                </div>
              ) : deploymentStatus === "deploying" ||
                deploymentStatus === "provisioning" ? (
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  ✓ کد سایت با موفقیت Build شد.
                  <p className="mt-1 text-xs">
                    استقرار سایت در حال انجام است. لطفاً منتظر بمانید.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  ✓ کد سایت با موفقیت Build شد. برای انتشار، به مرحله استقرار ابری بروید.
                </div>
              )}
            </div>
          )}

          {build.conclusion === "success" &&
            !isWebsite &&
            build.downloadable && (
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

              <label className="flex w-full items-center gap-2 text-xs text-red-800 dark:text-red-300">
                <input
                  type="checkbox"
                  checked={autoFix.enabled}
                  onChange={(event) => autoFix.onChange(event.target.checked)}
                />
                اصلاح خودکار بعد از هر شکست (حداکثر {autoFix.max.toLocaleString("fa-IR")} بار پشت‌سرهم؛ تا الان{" "}
                {autoFix.used.toLocaleString("fa-IR")} بار)
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
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

  const deploymentStatus = deployment?.status ?? null;
  const deploymentUrl = deployment?.url ?? null;
  const deploymentError = deployment?.error ?? null;
  const hasDatabase = deployment?.hasDatabase ?? false;

  const needsBackend = Boolean(project.spec?.needsBackend);
  const isWebsite = project.kind === "website";

  const statusMap: Record<string, string> = {
    provisioning: "در حال آماده‌سازی زیرساخت…",
    deploying: "در حال استقرار روی Vercel…",
    ready: "استقرار با موفقیت انجام شد",
    failed: "استقرار ناموفق بود",
  };

  const statusText = deploymentStatus
    ? statusMap[deploymentStatus] ?? deploymentStatus
    : null;

  const isBusy =
    deploymentStatus === "provisioning" ||
    deploymentStatus === "deploying";

  const isReady =
    deploymentStatus === "ready" && Boolean(deploymentUrl);

  const isFailed = deploymentStatus === "failed";

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-2 font-semibold">
          استقرار و انتشار اپلیکیشن
        </div>

        <p className="text-slate-600 dark:text-slate-400">
          {needsBackend
            ? `یک دیتابیس PostgreSQL اختصاصی در Neon ساخته و schema.sql اجرا می‌شود، سپس ${
                isWebsite ? "سایت و API" : "API"
              } روی Vercel مستقر می‌شود${
                isWebsite
                  ? "."
                  : " و نشانی API در Build بعدی APK قرار می‌گیرد."
              }`
            : isWebsite
              ? "سایت روی Vercel منتشر می‌شود و یک نشانی اختصاصی ‎*.vercel.app‎ با HTTPS دریافت می‌کند."
              : "این اپلیکیشن بدون نیاز به سرور اجرا می‌شود."}
        </p>

        <div className="mt-3 text-xs text-slate-500">
          پیش‌نیاز: توکن Vercel
          {needsBackend ? " و کلید Neon" : ""} در صفحه «اتصال‌ها و کلیدها» و نصب اپ GitHub روی حساب Vercel.
        </div>

        <div className="mt-3">
          <GuideToggle id="vercel-neon" />
        </div>
      </div>

      {!needsBackend && !isWebsite && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="font-medium text-emerald-800 dark:text-emerald-300">
            ✓ این اپلیکیشن نیازی به استقرار ابری ندارد.
          </div>

          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            برای دریافت نسخه قابل نصب، به مرحله Build مراجعه کنید.
          </p>
        </div>
      )}

      {needsBackend || isWebsite ? (
        <>
          {!deployment && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 font-medium">
                هنوز استقراری برای این پروژه ثبت نشده است.
              </div>

              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={onProvision}
              >
                {needsBackend
                  ? "ساخت دیتابیس Neon و استقرار روی Vercel"
                  : "انتشار سایت روی Vercel"}
              </button>
            </div>
          )}

          {deployment && (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold">وضعیت استقرار</div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isReady
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : isFailed
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : isBusy
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {isBusy ? "⏳ " : isReady ? "✓ " : isFailed ? "✕ " : ""}
                  {statusText}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {needsBackend && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-xs text-slate-500">Database</div>
                    <div className="mt-1 font-medium">Neon PostgreSQL</div>

                    <div className="mt-2 text-xs">
                      {hasDatabase ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          ✓ دیتابیس متصل است
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">
                          ⏳ اتصال دیتابیس تأیید نشده است
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="text-xs text-slate-500">Hosting</div>
                  <div className="mt-1 font-medium">Vercel</div>

                  <div className="mt-2 text-xs">
                    {isReady ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        ✓ سایت منتشر شده است
                      </span>
                    ) : isFailed ? (
                      <span className="text-red-700 dark:text-red-300">
                        ✕ استقرار ناموفق
                      </span>
                    ) : (
                      <span className="text-sky-700 dark:text-sky-300">
                        ⏳ در انتظار تکمیل استقرار
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {deploymentUrl && (
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="mb-2 text-xs font-medium text-slate-500">
                    آدرس سایت / API
                  </div>

                  <a
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="block break-all font-medium text-brand-600 underline"
                  >
                    {deploymentUrl}
                  </a>

                  <div className="mt-3">
                    <a
                      href={deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary inline-flex"
                    >
                      باز کردن سایت ↗
                    </a>
                  </div>
                </div>
              )}

              {isReady && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
                  <div className="font-medium text-emerald-800 dark:text-emerald-300">
                    ✓ استقرار با موفقیت انجام شد.
                  </div>

                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    {needsBackend
                      ? "زیرساخت ابری پروژه آماده استفاده است."
                      : "سایت شما روی Vercel منتشر شده و قابل دسترسی است."}
                  </p>
                </div>
              )}

              {isBusy && (
                <div
                  role="status"
                  className="rounded-lg bg-sky-50 p-3 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                >
                  <div className="font-medium">
                    عملیات استقرار در حال اجراست.
                  </div>

                  <p className="mt-1 text-xs">
                    لطفاً تا تکمیل عملیات منتظر بمانید. وضعیت پروژه به‌صورت خودکار به‌روزرسانی می‌شود.
                  </p>
                </div>
              )}

              {isFailed && (
                <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <div className="font-medium text-red-800 dark:text-red-300">
                    استقرار پروژه با خطا مواجه شده است.
                  </div>

                  {deploymentError ? (
                    <pre
                      dir="auto"
                      className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-red-100 p-3 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-200"
                    >
                      {deploymentError}
                    </pre>
                  ) : (
                    <p className="text-xs text-red-700 dark:text-red-300">
                      جزئیات خطای استقرار از سرور دریافت نشده است.
                    </p>
                  )}

                  <p className="text-xs text-red-700 dark:text-red-300">
                    تنظیمات اتصال Vercel و Neon و گزارش اجرای عملیات را بررسی کنید.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
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

const VPS_STATUS: Record<
  string,
  { text: string; className: string }
> = {
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

function CopyBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
  const [install, setInstall] =
    useState<InstallInstructions | null>(null);
  const [busy, setBusy] = useState(false);

  const vps = project.vps;
  const own = project.vpsProvider === "own";
  const guide =
    VPS_GUIDES[project.vpsProvider ?? "own"] ?? "own-vps";

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
    ? VPS_STATUS[vps.status] ?? {
        text: vps.status,
        className: "",
      }
    : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-slate-600 dark:text-slate-400">
        ایجنت Idea2App روی سرور نصب می‌شود: کد را با یک کلید فقط‌خواندنی از GitHub می‌گیرد، Build می‌کند
        {project.spec?.needsBackend
          ? "، PostgreSQL و API را راه می‌اندازد"
          : ""}
        ، با HTTPS منتشر می‌کند و هر ۲ دقیقه Commit جدید را بررسی و خودکار مستقر می‌کند.
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
              `آخرین گزارش: ${new Date(
                vps.lastReportAt,
              ).toLocaleString("fa-IR", {
                timeZone: "Asia/Tehran",
              })}`}
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
                  <CopyBox
                    label="cloud-init"
                    value={install.cloudInit}
                  />
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