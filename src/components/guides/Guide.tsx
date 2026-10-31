"use client";

import { useState } from "react";
import { GUIDES, type GuideId } from "./data";
import { MockScreen } from "./MockScreen";
import { Icon } from "../ui/Icon";

/** Step-by-step visual guide: one schematic screen per step, with prev/next. */
export function Guide({ id, compact = false }: { id: GuideId; compact?: boolean }) {
  const guide = GUIDES[id];
  const [index, setIndex] = useState(0);
  const step = guide.steps[index]!;
  const last = guide.steps.length - 1;

  return (
    <div className="panel p-4 shadow-xs sm:p-5">
      {!compact && (
        <div className="mb-3">
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <Icon name="book" size={17} className="text-info-fg" />
            {guide.title}
          </h3>
          <p className="text-sm text-fg-2">{guide.summary}</p>
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
                ? "bg-info text-white"
                : i < index
                  ? "bg-info-soft text-info-fg"
                  : "bg-surface text-muted"
            }`}
            title={s.title}
          >
            {(i + 1).toLocaleString("fa-IR")}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="order-2 md:order-1">
          <div className="text-xs text-info-fg">
            مرحله {(index + 1).toLocaleString("fa-IR")} از {guide.steps.length.toLocaleString("fa-IR")}
          </div>
          <h4 className="mb-2 font-bold">{step.title}</h4>
          <p className="text-sm leading-7 text-fg-2">{step.body}</p>
          {step.tip && (
            <p className="mt-3 rounded-lg bg-warning-soft p-2 text-xs leading-6 text-warning-fg">
              <span className="font-semibold">نکته:</span> {step.tip}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <Icon name="arrow-right" size={15} />
              قبلی
            </button>
            <button className="btn-primary" disabled={index === last} onClick={() => setIndex(index + 1)}>
              بعدی
              <Icon name="arrow-left" size={15} />
            </button>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <MockScreen mock={step.mock} />
          <p className="mt-2 text-center text-[11px] text-muted">تصویر نمادین؛ دایره‌های شماره‌دار جای کلیک را نشان می‌دهند.</p>
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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-info-fg hover:underline"
        aria-expanded={open}
      >
        <Icon name={open ? "chevron-down" : "chevron-left"} size={15} />
        <Icon name="book" size={15} />
        {label ?? `آموزش تصویری: ${GUIDES[id].title}`}
      </button>
      {open && (
        <div className="mt-3">
          <Guide id={id} />
        </div>
      )}
    </div>
  );
}
