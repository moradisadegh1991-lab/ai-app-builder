"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectView } from "@/lib/projects";
import { Icon } from "../ui/Icon";
import { Section } from "./parts";

type GeneratedFile = { path: string; content: string };

function groupByFolder(files: GeneratedFile[]) {
  const groups = new Map<string, GeneratedFile[]>();
  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    const folder = slash === -1 ? "" : file.path.slice(0, slash);
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
}

function fileName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Generated files: searchable tree on one side, read-only code with line numbers on the other. */
export function CodeSection({
  project,
  disabled,
  onGenerate,
}: {
  project: ProjectView;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const files = useMemo(() => project.generation?.files ?? [], [project.generation?.files]);
  const [selectedPath, setSelectedPath] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedPath((current) => {
      if (files.some((file) => file.path === current)) return current;
      // Open the app entry point first when it exists.
      return (files.find((file) => /(^|\/)App\.tsx$/.test(file.path)) ?? files[0])?.path ?? "";
    });
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((file) => file.path.toLowerCase().includes(q)) : files;
  }, [files, query]);

  const current = files.find((file) => file.path === selectedPath) ?? files[0];

  if (files.length === 0 || !current) {
    return (
      <Section icon="code" title="کد پروژه" description="فایل‌های پروژه پس از تولید کد این‌جا نمایش داده می‌شوند.">
        <div className="empty-state">
          <span className="empty-state-icon">
            <Icon name="code" />
          </span>
          <p className="font-semibold text-fg">هنوز کدی تولید نشده است</p>
          <p className="max-w-md text-sm leading-7">پس از تأیید نیازمندی‌ها، تولید کد را شروع کنید. ممکن است تا چند دقیقه طول بکشد.</p>
          <button type="button" className="btn-primary mt-2" disabled={disabled} onClick={onGenerate}>
            <Icon name="sparkles" size={16} />
            شروع تولید کد
          </button>
        </div>
      </Section>
    );
  }

  const lines = current.content.split("\n");
  const generation = project.generation;

  return (
    <Section
      icon="code"
      title="کد پروژه"
      description={
        <>
          {files.length.toLocaleString("fa-IR")} فایل
          {generation?.model && (
            <>
              {" · "}
              <span className="ltr">{generation.model}</span>
            </>
          )}
        </>
      }
      actions={
        <button type="button" className="btn-secondary btn-sm" disabled={disabled} onClick={onGenerate}>
          <Icon name="refresh" size={14} />
          تولید مجدد کد
        </button>
      }
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="فایل‌های پروژه" className="panel-muted flex max-h-[34rem] min-w-0 flex-col overflow-hidden">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Icon name="search" size={15} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="search"
                className="input !py-1.5 !ps-8 text-xs"
                placeholder="جست‌وجوی فایل"
                aria-label="جست‌وجوی فایل"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" dir="ltr">
            {filtered.length === 0 && <p className="p-3 text-center text-xs text-muted">فایلی پیدا نشد.</p>}
            {groupByFolder(filtered).map(([folder, items]) => (
              <div key={folder || "/"} className="mb-1">
                {folder && (
                  <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-2 font-mono text-[11px] text-faint">
                    <Icon name="folder" size={13} />
                    <span className="truncate">{folder}/</span>
                  </div>
                )}
                {items.map((file) => {
                  const selected = file.path === current.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      aria-current={selected ? "true" : undefined}
                      title={file.path}
                      className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-start font-mono text-xs transition ${
                        folder ? "ps-5" : ""
                      } ${selected ? "bg-primary-soft font-semibold text-primary-soft-fg" : "text-fg-2 hover:bg-surface-3"}`}
                    >
                      <Icon name="file" size={13} className={selected ? "" : "text-faint"} />
                      <span className="truncate">{fileName(file.path)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-code-line bg-code-bg">
          <div className="flex items-center justify-between gap-3 border-b border-code-line px-4 py-2.5" dir="ltr">
            <span className="min-w-0 truncate font-mono text-xs text-code-fg" title={current.path}>
              {current.path}
            </span>
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-code-fg/60">
              <span>{lines.length.toLocaleString("en-US")} lines</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-code-fg/80 transition hover:bg-white/10 hover:text-code-fg"
                onClick={() =>
                  navigator.clipboard.writeText(current.content).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                }
              >
                <Icon name={copied ? "check" : "copy"} size={13} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="scroll-thin max-h-[34rem] min-h-[18rem] overflow-auto" dir="ltr">
            <pre className="min-w-max py-3 text-left font-mono text-xs leading-6 text-code-fg">
              <code>
                {lines.map((line, index) => (
                  <span key={index} className="flex">
                    <span className="sticky left-0 w-12 shrink-0 select-none bg-code-bg pe-3 text-right text-code-fg/30">{index + 1}</span>
                    <span className="pe-6 whitespace-pre">{line || " "}</span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </Section>
  );
}
