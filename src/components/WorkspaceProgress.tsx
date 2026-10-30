
"use client";

import type { ProjectView } from "@/lib/projects";

interface WorkspaceProgressProps {
  project: ProjectView;
  githubConnected: boolean;
}

type StepStatus = "complete" | "current" | "locked" | "pending";

interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
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

  const hostingReady =
    project.hosting === "none"
      ? buildSucceeded
      : project.hosting === "vercel"
        ? project.deployment?.status === "ready"
        : project.vps?.status === "online";

  const hostingLocked =
    project.hosting === "none"
      ? !hasCode
      : !project.repo;

  const definitions = [
    {
      id: "analysis",
      title: "تحلیل و طراحی",
      description: "تبدیل ایده به نیازمندی‌ها و مشخصات محصول",
      done: specApproved,
      locked: false,
    },
    {
      id: "code",
      title: "تولید کد",
      description: "ساخت صفحات، قابلیت‌ها و فایل‌های پروژه",
      done: hasCode,
      locked: !specApproved,
    },
    {
      id: "build",
      title: "GitHub و Build",
      description: "ثبت کد در GitHub و ساخت خروجی قابل اجرا",
      done: buildSucceeded,
      locked: !hasCode,
    },
    {
      id: "hosting",
      title:
        project.hosting === "none"
          ? "نصب و اجرای اپ"
          : project.hosting === "vercel"
            ? "انتشار روی Vercel"
            : "استقرار روی VPS",
      description:
        project.hosting === "none"
          ? "دریافت APK و نصب روی گوشی"
          : project.hosting === "vercel"
            ? "راه‌اندازی سایت و سرویس ابری"
            : "نصب و راه‌اندازی پروژه روی سرور",
      done: hostingReady,
      locked: hostingLocked,
    },
  ];

  const completedCount = definitions.filter(
    (step) => step.done,
  ).length;

  const progress = Math.round(
    (completedCount / definitions.length) * 100,
  );

  const currentIndex = definitions.findIndex(
    (step) => !step.done && !step.locked,
  );

  const steps: ProgressStep[] = definitions.map(
    (step, index) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      status: step.done
        ? "complete"
        : step.locked
          ? "locked"
          : index === currentIndex
            ? "current"
            : "pending",
    }),
  );

  const showGithubHint =
    !githubConnected && hasCode && !project.repo;

  return (
    <section
      className="workspace-progress"
      aria-label="پیشرفت ساخت محصول"
    >
      <div className="workspace-progress-heading">
        <div>
          <span className="workspace-progress-eyebrow">
            PROJECT WORKFLOW
          </span>

          <h2>مسیر ساخت محصول</h2>

          <p>
            وضعیت مراحل طراحی، تولید و انتشار پروژه
          </p>
        </div>

        <div className="workspace-progress-summary">
          <strong>
            {progress.toLocaleString("fa-IR")}٪
          </strong>

          <span>
            {completedCount.toLocaleString("fa-IR")} از ۴ مرحله
          </span>
        </div>
      </div>

      <div
        className="workspace-progress-track"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="درصد پیشرفت پروژه"
      >
        <div
          className="workspace-progress-track-value"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="workspace-progress-steps">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`workspace-progress-step is-${step.status}`}
          >
            <div className="workspace-progress-step-marker">
              {step.status === "complete"
                ? "✓"
                : step.status === "locked"
                  ? "🔒"
                  : (index + 1).toLocaleString("fa-IR")}
            </div>

            {index < steps.length - 1 && (
              <div className="workspace-progress-connector" />
            )}

            <div className="workspace-progress-step-content">
              <div className="workspace-progress-step-title">
                {step.title}
              </div>

              <p>{step.description}</p>

              <span className="workspace-progress-step-state">
                {step.status === "complete"
                  ? "تکمیل شده"
                  : step.status === "current"
                    ? "مرحله فعلی"
                    : step.status === "locked"
                      ? "قفل شده"
                      : "در انتظار"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showGithubHint && (
        <div className="workspace-progress-hint" role="status">
          <span aria-hidden="true">i</span>

          <p>
            برای ادامه مسیر، ابتدا حساب GitHub را از بخش
            «اتصال‌ها و کلیدها» متصل کن. سپس می‌توانی کد
            پروژه را در Repository ذخیره و Build را اجرا کنی.
          </p>
        </div>
      )}

      {completedCount === definitions.length && (
        <div className="workspace-progress-hint" role="status">
          <span aria-hidden="true">✓</span>

          <p>
            همه مراحل پروژه با موفقیت تکمیل شده‌اند.
          </p>
        </div>
      )}
    </section>
  );
}
