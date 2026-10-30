
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ProjectItem = {
  id: string;
  name: string;
  idea: string;
  kind: "app" | "website";
  hosting: "none" | "vps" | "vercel";
  status: string;
  updatedAt: Date | string;
};

type Filter = "all" | "app" | "website";

const STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  spec_ready: "تحلیل آماده",
  spec_approved: "تأیید شده",
  generating: "در حال تولید",
  generated: "کد تولید شده",
  pushed: "ارسال به GitHub",
  failed: "ناموفق",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  spec_ready: "border-blue-200 bg-blue-50 text-blue-700",
  spec_approved: "border-indigo-200 bg-indigo-50 text-indigo-700",
  generating: "border-amber-200 bg-amber-50 text-amber-700",
  generated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pushed: "border-violet-200 bg-violet-50 text-violet-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProjectStatus({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const style =
    STATUS_STYLES[status] ??
    "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${style}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ProjectList({ projects }: { projects: ProjectItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return projects.filter((project) => {
      const matchesFilter =
        filter === "all" || project.kind === filter;

      const matchesQuery =
        !normalizedQuery ||
        project.name.toLocaleLowerCase().includes(normalizedQuery) ||
        project.idea.toLocaleLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [projects, query, filter]);

  const filters: { id: Filter; label: string; count: number }[] = [
    {
      id: "all",
      label: "همه پروژه‌ها",
      count: projects.length,
    },
    {
      id: "app",
      label: "اپلیکیشن‌ها",
      count: projects.filter((project) => project.kind === "app").length,
    },
    {
      id: "website",
      label: "وب‌سایت‌ها",
      count: projects.filter((project) => project.kind === "website").length,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو در نام و توضیحات پروژه‌ها..."
            aria-label="جست‌وجوی پروژه‌ها"
            className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-10 ps-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="فیلتر نوع پروژه"
        >
          {filters.map((item) => {
            const active = filter === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={active}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                    active
                      ? "bg-white/15 text-white"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {item.count.toLocaleString("fa-IR")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
            {query ? "⌕" : "▦"}
          </div>

          <h3 className="mt-4 text-sm font-extrabold text-slate-800">
            {projects.length === 0
              ? "هنوز پروژه‌ای ایجاد نکرده‌اید"
              : "پروژه‌ای با این مشخصات پیدا نشد"}
          </h3>

          <p className="mt-2 max-w-sm text-xs leading-7 text-slate-500">
            {projects.length === 0
              ? "اولین پروژه خود را از فرم ساخت پروژه ایجاد کنید."
              : "عبارت جست‌وجو یا فیلتر انتخاب‌شده را تغییر دهید."}
          </p>

          {(query || filter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              پاک کردن جست‌وجو و فیلتر
            </button>
          )}

          {projects.length === 0 && (
            <a href="#new-project" className="btn-primary mt-5">
              ساخت اولین پروژه
              <span aria-hidden="true">←</span>
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-slate-500">
              نمایش{" "}
              <span className="font-bold text-slate-800">
                {filteredProjects.length.toLocaleString("fa-IR")}
              </span>{" "}
              از{" "}
              <span className="font-bold text-slate-800">
                {projects.length.toLocaleString("fa-IR")}
              </span>{" "}
              پروژه
            </p>

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                پاک کردن جست‌وجو
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl transition ${
                      project.kind === "website"
                        ? "bg-sky-50 text-sky-600 group-hover:bg-sky-100"
                        : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                    }`}
                  >
                    {project.kind === "website" ? "◎" : "▣"}
                  </div>

                  <ProjectStatus status={project.status} />
                </div>

                <h3 className="mt-4 truncate text-sm font-extrabold text-slate-900 transition group-hover:text-indigo-700">
                  {project.name}
                </h3>

                <p className="mt-2 line-clamp-2 flex-1 text-xs leading-6 text-slate-500">
                  {project.idea}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span>
                      {project.kind === "website" ? "وب‌سایت" : "اپلیکیشن"}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                      {project.hosting === "vps"
                        ? "VPS"
                        : project.hosting === "vercel"
                          ? "Vercel"
                          : "محلی"}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-indigo-600 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span>باز کردن پروژه</span>
                  <span aria-hidden="true">←</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
