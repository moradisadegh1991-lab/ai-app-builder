const LABELS: Record<string, { text: string; className: string }> = {
  draft: { text: "پیش‌نویس", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  spec_ready: { text: "نیازمندی‌ها آماده", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  spec_approved: { text: "نیازمندی‌ها تأیید شد", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  generating: { text: "در حال تولید…", className: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  generated: { text: "کد آماده", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  pushed: { text: "در GitHub", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  failed: { text: "خطا", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? { text: status, className: LABELS.draft!.className };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${label.className}`}>{label.text}</span>;
}
