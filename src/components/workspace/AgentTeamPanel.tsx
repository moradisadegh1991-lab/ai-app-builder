"use client";

import type { ProjectView } from "@/lib/projects";
import { AGENT_LABELS } from "@/lib/agents/contracts";

const STATUS: Record<string, string> = {
  queued: "در صف",
  running: "در حال انجام",
  succeeded: "انجام شد",
  failed: "نیاز به بررسی",
  cancelled: "متوقف شد",
};
export function AgentTeamPanel({ workflow, base }: { workflow: ProjectView["workflow"]; base: string }) {
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
  return (
    <section className="panel p-4 shadow-xs" aria-label="تیم تخصصی هوش مصنوعی" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-fg">تیم تخصصی هوش مصنوعی</h2>
        <span
          className={`badge ${workflow.status === "failed" ? "badge-danger" : active ? "badge-info" : "badge-success"}`}
        >
          {STATUS[workflow.status] ?? workflow.status}
        </span>
      </div>
      {workflow.status === "queued" && (
        <p className="mt-3 text-xs leading-6 text-muted">
          درخواست ثبت شد. تیم پس از رسیدن نوبت شروع می‌کند؛ می‌توانید صفحه را ببندید.
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-2">
        {workflow.tasks.map((task) => (
          <li key={task.id} className="rounded-lg border border-line p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{AGENT_LABELS[task.role as keyof typeof AGENT_LABELS] ?? task.role}</span>
              <span className={task.status === "failed" ? "text-danger-fg" : "text-muted"}>
                {STATUS[task.status] ?? task.status}
              </span>
            </div>
            {task.model && (
              <span className="mt-1 block truncate text-[10px] text-faint" dir="ltr">
                {task.model}
              </span>
            )}
            {task.error && (
              <p className="mt-1 text-[11px] leading-5 text-danger-fg" dir="auto">
                {task.error}
              </p>
            )}
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
          className="btn-secondary btn-sm mt-3"
          onClick={async () => {
            await fetch(`${base}/workflow`, { method: "DELETE" });
          }}
        >
          توقف تیم
        </button>
      )}
    </section>
  );
}
