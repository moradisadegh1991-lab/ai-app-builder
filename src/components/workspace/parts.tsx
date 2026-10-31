"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";
import type { StepState } from "./model";

/** Title row of a workspace section. */
export function SectionHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: IconName;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-fg">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-0.5 text-sm leading-7 text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A workspace section: one card with a header and padded body. */
export function Section({ children, ...header }: Parameters<typeof SectionHeader>[0] & { children: ReactNode }) {
  return (
    <section className="panel overflow-hidden shadow-xs">
      <SectionHeader {...header} />
      <div className="p-5">{children}</div>
    </section>
  );
}

const STATE_STYLE: Record<StepState, { icon: IconName | null; className: string; label: string }> = {
  done: { icon: "check", className: "bg-success text-white", label: "انجام شد" },
  current: { icon: null, className: "bg-primary text-primary-fg", label: "مرحله فعلی" },
  todo: { icon: null, className: "border border-line-strong bg-surface text-muted", label: "در انتظار" },
  locked: { icon: "lock", className: "bg-surface-3 text-faint", label: "قفل" },
  error: { icon: "x", className: "bg-danger text-white", label: "نیازمند بررسی" },
  running: { icon: null, className: "bg-info-soft text-info-fg", label: "در حال اجرا" },
};

export function StepMarker({ state, number }: { state: StepState; number?: number }) {
  const style = STATE_STYLE[state];
  return (
    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${style.className}`} title={style.label}>
      {state === "running" ? (
        <span className="spinner !size-3" aria-hidden="true" />
      ) : style.icon ? (
        <Icon name={style.icon} size={12} strokeWidth={2.6} />
      ) : (
        (number ?? "").toLocaleString("fa-IR")
      )}
      <span className="sr-only">{style.label}</span>
    </span>
  );
}

/** Label/value line for summaries. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-end font-medium text-fg">{children}</dd>
    </div>
  );
}

/** Read-only code/command box with a copy button. */
export function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg-2">{label}</span>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>
      <pre className="code-block whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 font-medium text-primary hover:underline ${className}`}>
      {children}
      <Icon name="external" size={13} />
    </a>
  );
}
