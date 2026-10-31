"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "./ui/Icon";
import { TONE_BADGE, projectStatus } from "./ui/status";

export type ProjectItem = {
  id: string;
  name: string;
  idea: string;
  kind: "app" | "website";
  hosting: "none" | "vps" | "vercel";
  status: string;
  updatedAt: Date | string;
};

type Filter = "all" | "app" | "website";

const HOSTING_LABEL: Record<ProjectItem["hosting"], string> = { none: "روی گوشی", vps: "VPS", vercel: "Vercel" };

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Tehran" });
}

/** Searchable, filterable list of the user's projects. */
export function ProjectList({ projects }: { projects: ProjectItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return projects.filter(
      (project) =>
        (filter === "all" || project.kind === filter) &&
        (!q || project.name.toLocaleLowerCase().includes(q) || project.idea.toLocaleLowerCase().includes(q)),
    );
  }, [projects, query, filter]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "همه", count: projects.length },
    { id: "app", label: "اپ‌ها", count: projects.filter((project) => project.kind === "app").length },
    { id: "website", label: "وب‌سایت‌ها", count: projects.filter((project) => project.kind === "website").length },
  ];

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <Icon name="grid" />
        </span>
        <p className="font-semibold text-fg">هنوز پروژه‌ای ندارید</p>
        <p className="max-w-sm text-sm leading-7">اولین پروژه را با فرم «پروژهٔ جدید» بسازید؛ هوش مصنوعی از ایده تا نسخهٔ قابل اجرا همراهتان است.</p>
        <a href="#new-project" className="btn-primary mt-2">
          <Icon name="plus" size={16} />
          ساخت اولین پروژه
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو در نام و ایدهٔ پروژه‌ها"
            aria-label="جست‌وجوی پروژه‌ها"
            className="input !ps-9"
          />
        </div>
        <div className="segmented self-start" role="group" aria-label="فیلتر نوع پروژه">
          {filters.map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
              {item.label}
              <span className="text-xs text-faint">{item.count.toLocaleString("fa-IR")}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <Icon name="search" />
          </span>
          <p className="font-semibold text-fg">پروژه‌ای با این مشخصات پیدا نشد</p>
          <button
            type="button"
            className="btn-secondary btn-sm mt-1"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            پاک کردن جست‌وجو و فیلتر
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((project) => {
            const status = projectStatus(project.status);
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="card card-interactive group flex h-full flex-col gap-3 !p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                        project.kind === "website" ? "bg-info-soft text-info-fg" : "bg-primary-soft text-primary-soft-fg"
                      }`}
                    >
                      <Icon name={project.kind === "website" ? "globe" : "smartphone"} size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-fg group-hover:text-primary">{project.name}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {project.kind === "website" ? "وب‌سایت" : "اپ Android"} · {HOSTING_LABEL[project.hosting]}
                      </p>
                    </div>
                    <span className={`${TONE_BADGE[status.tone]} badge-dot`}>{status.label}</span>
                  </div>
                  <p className="line-clamp-2 flex-1 text-sm leading-7 text-fg-2">{project.idea}</p>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <Icon name="clock" size={13} />
                      {formatDate(project.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-primary opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                      باز کردن
                      <Icon name="arrow-left" size={14} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
