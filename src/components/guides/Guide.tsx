"use client";

import { useState } from "react";
import { GUIDES, type GuideId } from "./data";
import { MockScreen } from "./MockScreen";

/** Step-by-step visual guide: one schematic screen per step, with prev/next. */
export function Guide({ id, compact = false }: { id: GuideId; compact?: boolean }) {
  const guide = GUIDES[id];
  const [index, setIndex] = useState(0);
  const step = guide.steps[index]!;
  const last = guide.steps.length - 1;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      {!compact && (
        <div className="mb-3">
          <h3 className="font-bold">📘 {guide.title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{guide.summary}</p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="مراحل">
        {guide.steps.map((s, i) => (
          <button
            key={s.title}
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition ${
              i === index
                ? "bg-sky-600 text-white"
                : i < index
                  ? "bg-sky-200 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
                  : "bg-white text-slate-500 dark:bg-slate-800"
            }`}
            title={s.title}
          >
            {(i + 1).toLocaleString("fa-IR")}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="order-2 md:order-1">
          <div className="text-xs text-sky-700 dark:text-sky-300">
            مرحله {(index + 1).toLocaleString("fa-IR")} از {guide.steps.length.toLocaleString("fa-IR")}
          </div>
          <h4 className="mb-2 font-bold">{step.title}</h4>
          <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step.body}</p>
          {step.tip && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              💡 {step.tip}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              → قبلی
            </button>
            <button className="btn-primary" disabled={index === last} onClick={() => setIndex(index + 1)}>
              بعدی ←
            </button>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <MockScreen mock={step.mock} />
          <p className="mt-2 text-center text-[11px] text-slate-500">تصویر نمادین؛ دایره‌های شماره‌دار جای کلیک را نشان می‌دهند.</p>
        </div>
      </div>
    </div>
  );
}

/** A collapsed "show visual guide" toggle for use inside a workflow step. */
export function GuideToggle({ id, label }: { id: GuideId; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
        aria-expanded={open}
      >
        {open ? "▾" : "◂"} 📘 {label ?? `آموزش تصویری: ${GUIDES[id].title}`}
      </button>
      {open && (
        <div className="mt-3">
          <Guide id={id} />
        </div>
      )}
    </div>
  );
}
