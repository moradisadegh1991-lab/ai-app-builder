"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects";
import { Icon } from "../ui/Icon";
import type { NextAction, SectionId } from "./model";

/** "Edit with AI": describe a change; only the needed files are rewritten and a new build starts. */
function EditWithAi({ disabled, onEdit }: { disabled: boolean; onEdit: (instruction: string) => Promise<boolean> }) {
  const [instruction, setInstruction] = useState("");
  const ready = instruction.trim().length >= 5;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (ready && (await onEdit(instruction))) setInstruction("");
      }}
    >
      <label htmlFor="ai-edit" className="text-sm font-semibold text-fg">
        ویرایش با هوش مصنوعی
      </label>
      <p className="text-xs leading-6 text-muted">مثلاً «رنگ اصلی را سبز کن» یا «صفحهٔ تماس با ما اضافه کن». فقط فایل‌های لازم عوض می‌شوند.</p>
      <textarea
        id="ai-edit"
        className="input min-h-24 resize-y text-sm leading-7"
        placeholder="چه چیزی عوض شود؟"
        value={instruction}
        maxLength={3000}
        onChange={(event) => setInstruction(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit();
        }}
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint">
          <span dir="ltr" className="inline-flex items-center gap-1">
            <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd>
          </span>
        </span>
        <button type="submit" className="btn-primary btn-sm" disabled={disabled || !ready}>
          <Icon name="pencil" size={14} />
          اعمال تغییر
        </button>
      </div>
    </form>
  );
}

/**
 * The assistant column: what is happening now, what to do next, the AI's notes
 * about the latest generation, and chat edits. Everything shown comes from the project data.
 */
export function ActivityPanel({
  project,
  busyMessage,
  next,
  activeSection,
  onNavigate,
  canEdit,
  editDisabled,
  onEdit,
}: {
  project: ProjectView;
  busyMessage: string | null;
  next: NextAction;
  /** The section on screen: a running operation shown there is not repeated in full here. */
  activeSection: SectionId;
  onNavigate: (id: SectionId) => void;
  canEdit: boolean;
  editDisabled: boolean;
  onEdit: (instruction: string) => Promise<boolean>;
}) {
  const generation = project.generation;
  const warnings = generation?.warnings ?? [];

  return (
    <aside aria-label="دستیار و فعالیت" className="flex flex-col gap-4">
      <div className="panel overflow-hidden shadow-xs">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="activity" size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-fg">فعالیت</h2>
        </div>

        <div className="flex flex-col gap-3 p-4" aria-live="polite">
          {busyMessage ? (
            <div role="status" className="alert alert-brand">
              <span className="spinner mt-1" aria-hidden="true" />
              <span className="text-sm">{busyMessage}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(next.section)}
              className="group flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-start transition hover:border-primary-line"
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${next.running ? "bg-info-soft text-info-fg" : "bg-primary-soft text-primary-soft-fg"}`}>
                {next.running ? <span className="spinner" aria-hidden="true" /> : <Icon name="sparkles" size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted">{next.running ? "در حال انجام" : "اقدام پیشنهادی"}</span>
                <span className="block text-sm font-semibold text-fg group-hover:text-primary">{next.title}</span>
                {!(next.running && next.section === activeSection) && <span className="mt-0.5 block text-xs leading-6 text-muted">{next.description}</span>}
              </span>
            </button>
          )}

          {generation && (generation.notes || warnings.length > 0) && (
            <div className="rounded-xl border border-line p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                <span className="shrink-0">یادداشت آخرین تولید</span>
                <span className="ltr min-w-0 truncate font-mono" title={generation.model}>
                  {generation.model}
                </span>
              </div>
              {generation.notes && <p className="text-xs leading-6 text-fg-2">{generation.notes}</p>}
              {warnings.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs font-medium text-warning-fg">{warnings.length.toLocaleString("fa-IR")} هشدار</summary>
                  <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-4 text-[11px] leading-5 text-muted">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="panel p-4 shadow-xs">
          <EditWithAi disabled={editDisabled} onEdit={onEdit} />
        </div>
      )}
    </aside>
  );
}
