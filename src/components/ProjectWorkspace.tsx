"use client";

import { useCallback, useEffect, useState } from "react";
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
  | "cloud";

const BUSY_MESSAGES: Record<Exclude<Busy, null>, string> = {
  spec: "هوش مصنوعی در حال تحلیل ایده است (معمولاً کمتر از یک دقیقه)…",
  approve: "در حال ذخیره…",
  code: "هوش مصنوعی در حال نوشتن کد است؛ ممکن است تا ۴ دقیقه طول بکشد…",
  github: "در حال ساخت Repository و ثبت کد در GitHub…",
  rebuild: "در حال شروع Build جدید…",
  fix: "هوش مصنوعی در حال بررسی گزارش خطا و اصلاح کد است…",
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
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const base = `/api/projects/${project.id}`;

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
        />
      </Step>

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
