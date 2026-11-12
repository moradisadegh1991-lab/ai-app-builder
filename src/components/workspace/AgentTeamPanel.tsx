"use client";

import type { ProjectView } from "@/lib/projects";
import { AGENT_LABELS } from "@/lib/agents/contracts";
import { useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { api } from "../api";

const ROLE_ICONS: Record<string, IconName> = {
  architect: "layers",
  designer: "pencil",
  frontend: "monitor",
  backend: "database",
  reviewer: "shield",
  debugger: "hammer",
  verifier: "check-circle",
  publisher: "git-branch",
};

const STATUS: Record<string, string> = {
  queued: "در صف",
  running: "در حال انجام",
  succeeded: "انجام شد",
  failed: "نیاز به بررسی",
  cancelled: "متوقف شد",
};
export function AgentTeamPanel({ workflow, base }: { workflow: ProjectView["workflow"]; base: string }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  if (!workflow) return null;
  const report = workflow.evaluation?.report as
    | {
        review?: {
          summary: string;
          issues: { severity: string; evidence: string; fix: string }[];
        };
        verification?: {
          checks: { name: string; status: string; detail: string }[];
        };
      }
    | undefined;
  const active = ["queued", "running"].includes(workflow.status);
  const completed = workflow.tasks.filter((task) => task.status === "succeeded").length;
  const badge =
    workflow.status === "failed"
      ? "badge-danger"
      : active
        ? "badge-info"
        : workflow.status === "succeeded"
          ? "badge-success"
          : "";
  return (
    <section className="panel p-4 shadow-xs" aria-label="تیم تخصصی هوش مصنوعی">
      <div className="flex items-center justify-between gap-2">
        <div className="agent-panel-heading">
          <span className="agent-panel-avatar">
            <Icon name="sparkles" size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-fg">تیم ساخت تو</h2>
            <p className="mt-1 text-[10px] text-muted">هر تخصص، یک قدم رو به جلو</p>
          </div>
        </div>
        <span role="status" className={`badge ${badge}`}>
          {STATUS[workflow.status] ?? workflow.status}
        </span>
      </div>
      {workflow.status === "queued" && (
        <p className="mt-3 text-xs leading-6 text-muted">
          درخواست ثبت شد. تیم پس از رسیدن نوبت شروع می‌کند؛ می‌توانید صفحه را ببندید.
        </p>
      )}
      {workflow.tasks.length > 0 && (
        <div>
          <div className="agent-progress-label">
            <span>مراحل ثبت‌شده</span>
            <span>
              {completed.toLocaleString("fa-IR")} از {workflow.tasks.length.toLocaleString("fa-IR")}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="پیشرفت مراحل ثبت‌شده"
            aria-valuemin={0}
            aria-valuemax={workflow.tasks.length}
            aria-valuenow={completed}
            className="progress"
          >
            <span style={{ width: `${(completed / workflow.tasks.length) * 100}%` }} />
          </div>
        </div>
      )}
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {workflow.tasks.map((task) => (
          <li key={task.id} className="agent-task" data-status={task.status}>
            <span className="agent-task-icon">
              {task.status === "running" ? (
                <span className="spinner !size-3" />
              ) : (
                <Icon
                  name={
                    task.status === "succeeded"
                      ? "check"
                      : task.status === "failed"
                        ? "alert-circle"
                        : (ROLE_ICONS[task.role] ?? "sparkles")
                  }
                  size={14}
                  className={
                    task.status === "succeeded" ? "text-success-fg" : task.status === "failed" ? "text-danger-fg" : ""
                  }
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 font-semibold leading-6">
                  {AGENT_LABELS[task.role as keyof typeof AGENT_LABELS] ?? task.role}
                </span>
                <span className={`shrink-0 text-[10px] ${task.status === "failed" ? "text-danger-fg" : "text-muted"}`}>
                  {STATUS[task.status] ?? task.status}
                </span>
              </div>
              {task.model && (
                <span className="mt-1 block truncate text-[10px] text-muted" dir="ltr">
                  {task.model}
                </span>
              )}
              {task.error && (
                <p className="mt-1 text-[11px] leading-5 text-danger-fg" dir="auto">
                  {task.error}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {workflow.error && (
        <p role="alert" className="mt-3 text-xs leading-6 text-danger-fg" dir="auto">
          {workflow.error}
        </p>
      )}
      {report && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold">گزارش ارزیابی کیفیت</summary>
          {report.review?.summary && <p className="mt-2 leading-6">{report.review.summary}</p>}
          {report.verification?.checks.map((check, index) => (
            <div key={index} className="mt-2 rounded border border-line p-2">
              <span dir="auto">
                {check.name}:{" "}
                {check.status === "passed" ? "موفق" : check.status === "skipped" ? "انجام نشده" : "ناموفق"}
              </span>
              {check.detail && (
                <pre dir="auto" className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted">
                  {check.detail}
                </pre>
              )}
            </div>
          ))}
          {report.review?.issues.map((issue, index) => (
            <p key={index} className="mt-2 leading-6">
              {issue.evidence}
              <br />
              {issue.fix}
            </p>
          ))}
        </details>
      )}
      {workflow.screenshots.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {workflow.screenshots.map((s) => (
            <a
              key={`${s.taskId}-${s.name}`}
              href={`${base}/workflow?task=${s.taskId}&screenshot=${encodeURIComponent(s.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary"
            >
              <img
                loading="lazy"
                alt={s.name === "mobile" ? "تصویر واقعی صفحه در موبایل" : "تصویر واقعی صفحه در دسکتاپ"}
                src={`${base}/workflow?task=${s.taskId}&screenshot=${encodeURIComponent(s.name)}`}
                className="aspect-video w-full rounded-lg border border-line object-cover object-top"
              />
              {s.name === "mobile" ? "موبایل" : "دسکتاپ"}
            </a>
          ))}
        </div>
      )}
      {active && (
        <button
          type="button"
          className="btn-secondary btn-sm mt-4 w-full sm:w-auto"
          disabled={cancelling}
          onClick={async () => {
            setCancelling(true);
            setCancelError("");
            try {
              await api(`${base}/workflow`, { method: "DELETE" });
            } catch (error) {
              setCancelError(error instanceof Error ? error.message : "توقف تیم انجام نشد؛ دوباره تلاش کنید.");
            } finally {
              setCancelling(false);
            }
          }}
        >
          {cancelling ? <span className="spinner" /> : <Icon name="x" size={14} />}
          {cancelling ? "در حال توقف…" : "توقف اجرای تیم"}
        </button>
      )}
      {cancelError && (
        <p role="alert" className="mt-2 text-xs leading-6 text-danger-fg">
          {cancelError}
        </p>
      )}
    </section>
  );
}
