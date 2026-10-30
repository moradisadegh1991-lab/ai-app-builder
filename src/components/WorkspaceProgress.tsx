
"use client";

import type { ProjectView } from "@/lib/projects";

interface WorkspaceProgressProps {
  project: ProjectView;
  githubConnected: boolean;
}

type StepState = "complete" | "current" | "pending" | "locked" | "error";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  action: string;
  done: boolean;
  locked: boolean;
  failed: boolean;
}

function getState(step: WorkflowStep, currentIndex: number, index: number): StepState {
  if (step.failed) return "error";
  if (step.done) return "complete";
  if (step.locked) return "locked";
  if (index === currentIndex) return "current";
  return "pending";
}

const STATE_LABELS: Record<StepState, string> = {
  complete: "تکمیل شده",
  current: "اقدام بعدی",
  pending: "در انتظار",
  locked: "قفل شده",
  error: "نیازمند بررسی",
};

const STATE_STYLES: Record<StepState, string> = {
  complete:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  current:
    "border-indigo-200 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  pending:
    "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  locked:
    "border-slate-200 bg-slate-50 text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-900/50",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

function StepIcon({
  state,
  number,
}: {
  state: StepState;
  number: number;
}) {
  if (state === "complete") return <span aria-hidden="true">✓</span>;
  if (state === "error") return <span aria-hidden="true">!</span>;
  if (state === "locked") return <span aria-hidden="true">🔒</span>;

  return <span>{number.toLocaleString("fa-IR")}</span>;
}

export function WorkspaceProgress({
  project,
  githubConnected,
}: WorkspaceProgressProps) {
  const specApproved = Boolean(project.specApprovedAt);

  const hasCode =
    Boolean(project.generation?.files.length) &&
    project.generation?.kind !== "spec";

  const buildSucceeded =
    project.build?.status === "completed" &&
    project.build?.conclusion === "success";

  const buildFailed =
    project.build?.status === "completed" &&
    project.build?.conclusion !== "success";

  const deploymentReady = project.deployment?.status === "ready";
  const deploymentFailed = project.deployment?.status === "error";

  const vpsReady = project.vps?.status === "online";
  const vpsFailed = project.vps?.status === "error";

  const hostingReady =
    project.hosting === "none"
      ? buildSucceeded
      : project.hosting === "vercel"
        ? deploymentReady
        : vpsReady;

  const hostingFailed =
    project.hosting === "none"
      ? buildFailed
      : project.hosting === "vercel"
        ? deploymentFailed
        : vpsFailed;

  const hostingLocked =
    project.hosting === "none"
      ? !hasCode
      : !project.repo;

  const definitions: WorkflowStep[] = [
    {
      id: "analysis",
      title: "تحلیل و طراحی",
      description: "تبدیل ایده به نیازمندی‌ها، صفحات و مدل داده",
      action: specApproved
        ? "مشاهده نیازمندی‌ها"
        : "تحلیل ایده با هوش مصنوعی",
      done: specApproved,
      locked: false,
      failed: false,
    },
    {
      id: "code",
      title: "تولید کد",
      description: "ساخت صفحات، قابلیت‌ها و فایل‌های پروژه",
      action: "تولید کد پروژه",
      done: hasCode,
      locked: !specApproved,
      failed: false,
    },
    {
      id: "build",
      title: "GitHub و Build",
      description: "ثبت کد در مخزن و ساخت خروجی قابل اجرا",
      action: project.repo
        ? "مشاهده Build"
        : "اتصال GitHub و ثبت کد",
      done: buildSucceeded,
      locked: !hasCode,
      failed: buildFailed,
    },
    {
      id: "hosting",
      title:
        project.hosting === "none"
          ? "اجرای اپ روی گوشی"
          : project.hosting === "vercel"
            ? "انتشار روی Vercel"
            : "استقرار روی VPS",
      description:
        project.hosting === "none"
          ? "دریافت خروجی و نصب اپلیکیشن"
          : project.hosting === "vercel"
            ? "راه‌اندازی وب‌سایت و سرویس ابری"
            : "نصب و اجرای پروژه روی سرور",
      action:
        project.hosting === "none"
          ? "راهنمای نصب اپ"
          : project.hosting === "vercel"
            ? "مدیریت استقرار"
            : "مدیریت سرور",
      done: hostingReady,
      locked: hostingLocked,
      failed: hostingFailed,
    },
  ];

  const completedCount = definitions.filter((step) => step.done).length;

  const progress = Math.round(
    (completedCount / definitions.length) * 100,
  );

  const currentIndex = definitions.findIndex(
    (step) => !step.done && !step.locked && !step.failed,
  );

  const failedIndex = definitions.findIndex((step) => step.failed);

  const nextIndex = failedIndex >= 0 ? failedIndex : currentIndex;

  const nextStep =
    nextIndex >= 0 ? definitions[nextIndex] : null;

  const states = definitions.map((step, index) =>
    getState(step, currentIndex, index),
  );

  const allCompleted = completedCount === definitions.length;

  const showGithubHint =
    !githubConnected && hasCode && !project.repo;

  const buildInProgress =
    project.build !== null &&
    project.build.status !== "completed";

  const deploymentInProgress =
    project.deployment?.status === "deploying";

  const vpsInProgress =
    project.vps?.status === "pending" ||
    project.vps?.status === "deploying";

  const running =
    buildInProgress || deploymentInProgress || vpsInProgress;

  function navigateToStep(index: number) {
    const workspace = document.querySelector(".workspace-shell");
    const stepElements = workspace?.querySelectorAll(".workspace-step");
    const target = stepElements?.item(index);

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    target.classList.add("workspace-step-highlight");

    window.setTimeout(() => {
      target.classList.remove("workspace-step-highlight");
    }, 1600);
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      aria-label="پیشرفت ساخت محصول"
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              PROJECT WORKFLOW
            </span>

            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
                در حال اجرا
              </span>
            )}
          </div>

          <h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
            مسیر ساخت محصول
          </h2>

          <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
            از تحلیل ایده تا تولید کد، Build و انتشار نهایی
          </p>
        </div>

        <div className="flex min-w-24 flex-col items-end">
          <strong className="text-3xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
            {progress.toLocaleString("fa-IR")}٪
          </strong>

          <span className="mt-1 text-[10px] text-slate-400">
            {completedCount.toLocaleString("fa-IR")} از ۴ مرحله
          </span>
        </div>
      </div>

      {/* Main progress */}
      <div className="relative mt-5">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="درصد پیشرفت پروژه"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Workflow cards */}
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {definitions.map((step, index) => {
          const state = states[index];
          const clickable = !step.locked;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!clickable}
              onClick={() => navigateToStep(index)}
              className={`group flex min-w-0 flex-col rounded-2xl border p-4 text-start transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed ${STATE_STYLES[state]}`}
              aria-label={`رفتن به مرحله ${step.title}، وضعیت ${STATE_LABELS[state]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex size-9 items-center justify-center rounded-xl border text-sm font-black ${STATE_STYLES[state]}`}
                >
                  <StepIcon state={state} number={index + 1} />
                </span>

                <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold dark:bg-slate-950/40">
                  {STATE_LABELS[state]}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-extrabold text-slate-900 dark:text-white">
                {step.title}
              </h3>

              <p className="mt-1 min-h-10 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                {step.description}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-current/10 pt-3">
                <span className="truncate text-[10px] font-bold">
                  {step.action}
                </span>

                <span className="text-sm opacity-60" aria-hidden="true">
                  ←
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Next action */}
      {!allCompleted && nextStep && (
        <div
          className={`relative mt-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            nextStep.failed
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
              : "border-indigo-100 bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/30"
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm dark:bg-slate-900">
              {nextStep.failed ? "⚠️" : "✦"}
            </span>

            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {nextStep.failed ? "اقدام موردنیاز" : "پیشنهاد برای ادامه"}
              </p>

              <h3 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                {nextStep.failed
                  ? `بررسی مرحله ${nextStep.title}`
                  : nextStep.title}
              </h3>

              <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-400">
                {nextStep.failed
                  ? "این مرحله با خطا مواجه شده است. جزئیات خطا را در بخش مربوطه بررسی کنید."
                  : nextStep.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateToStep(nextIndex)}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            رفتن به مرحله
            <span aria-hidden="true">←</span>
          </button>
        </div>
      )}

      {/* GitHub connection hint */}
      {showGithubHint && (
        <div className="relative mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="text-lg" aria-hidden="true">
            🔗
          </span>

          <div>
            <p className="text-xs font-extrabold">
              اتصال GitHub برای ادامه لازم است
            </p>

            <p className="mt-1 text-[10px] leading-6">
              برای ثبت کد پروژه در Repository و اجرای Build، ابتدا حساب GitHub
              را از بخش «اتصال‌ها و کلیدها» متصل کنید.
            </p>
          </div>
        </div>
      )}

      {/* Running hint */}
      {running && (
        <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <span className="size-2 animate-pulse rounded-full bg-sky-500" />

          <p className="text-[10px] leading-6">
            یکی از عملیات‌های پروژه در حال اجراست. وضعیت مراحل پس از دریافت
            اطلاعات جدید به‌روزرسانی می‌شود.
          </p>
        </div>
      )}

      {/* Completion */}
      {allCompleted && (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">
            ✓
          </span>

          <div>
            <h3 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
              تمام مراحل پروژه تکمیل شده‌اند
            </h3>

            <p className="mt-1 text-[10px] leading-5 text-emerald-700 dark:text-emerald-400">
              محصول آماده استفاده یا بررسی نهایی است.
            </p>
          </div>
        </div>
      )}

      {/* Repository and deployment links */}
      {(project.repo || project.deployment?.url) && (
        <div className="relative mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {project.repo && (
            <a
              href={project.repo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <span aria-hidden="true">⌘</span>
              مشاهده Repository
              <span aria-hidden="true">↗</span>
            </a>
          )}

          {project.deployment?.url && (
            <a
              href={project.deployment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-700 transition hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              <span aria-hidden="true">🌐</span>
              مشاهده نسخه منتشرشده
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
