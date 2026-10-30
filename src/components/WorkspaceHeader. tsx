
"use client";

import type { ProjectView } from "@/lib/projects";
import type { ProviderInfo } from "./api";
import { StatusBadge } from "./StatusBadge";

type WorkspaceHeaderProps = {
  project: ProjectView;
  providers: ProviderInfo[];
  provider: ProviderInfo["id"];
  onProviderChange: (provider: ProviderInfo["id"]) => void;
};

export function WorkspaceHeader({
  project,
  providers,
  provider,
  onProviderChange,
}: WorkspaceHeaderProps) {
  const isWebsite = project.kind === "website";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />

      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
              <span className="size-2 rounded-full bg-indigo-500" />
              {isWebsite ? "WEB PROJECT" : "APP PROJECT"}
            </span>

            <StatusBadge status={project.status} />
          </div>

          <h1 className="break-words text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {project.name}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            {project.idea}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
              <span aria-hidden="true">✦</span>
              توسعه با هوش مصنوعی
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
              <span aria-hidden="true">{isWebsite ? "⌘" : "▣"}</span>
              {isWebsite ? "وب‌سایت" : "اپلیکیشن"}
            </span>
          </div>
        </div>

        <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60 lg:w-72">
          <label
            htmlFor="workspace-ai-provider"
            className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            مدل هوش مصنوعی
          </label>

          <select
            id="workspace-ai-provider"
            className="input w-full"
            value={provider}
            onChange={(event) =>
              onProviderChange(
                event.target.value as ProviderInfo["id"]
              )
            }
          >
            {providers.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={!item.available}
              >
                {item.label} — {item.model}
                {!item.available ? " (غیرفعال)" : ""}
              </option>
            ))}
          </select>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            مدل انتخاب‌شده برای عملیات بعدی تحلیل و تولید کد استفاده می‌شود.
          </p>
        </div>
      </div>
    </section>
  );
}
