"use client";

import { useEffect, useState } from "react";
import type { AppSpec } from "@/lib/spec";
import { Icon } from "../ui/Icon";
import { Section } from "./parts";

/** Requirements produced by the AI: review, revise with feedback, edit as JSON, approve. */
export function RequirementsSection({
  spec,
  approved,
  disabled,
  onGenerate,
  onApprove,
}: {
  spec: AppSpec | null;
  approved: boolean;
  disabled: boolean;
  onGenerate: (feedback?: string) => void;
  onApprove: (edited?: AppSpec) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => setRawJson(spec ? JSON.stringify(spec, null, 2) : ""), [spec]);

  if (!spec) {
    return (
      <Section icon="list" title="نیازمندی‌ها و طراحی" description="ایده به صفحات، قابلیت‌ها، مدل داده و نیاز به سرور تبدیل می‌شود.">
        <div className="empty-state">
          <span className="empty-state-icon">
            <Icon name="sparkles" />
          </span>
          <p className="font-semibold text-fg">هنوز تحلیلی انجام نشده است</p>
          <p className="max-w-md text-sm leading-7">
            هوش مصنوعی ایده و پیوست‌های شما را می‌خواند و نیازمندی‌های نسخهٔ اول را می‌نویسد. قبل از تولید کد آن را بررسی و تأیید می‌کنید.
          </p>
          <button className="btn-primary mt-2" disabled={disabled} onClick={() => onGenerate()}>
            <Icon name="sparkles" size={16} />
            تحلیل ایده با هوش مصنوعی
          </button>
        </div>
      </Section>
    );
  }

  function approve() {
    let edited: AppSpec | undefined;
    if (rawJson && rawJson !== JSON.stringify(spec, null, 2)) {
      try {
        edited = JSON.parse(rawJson) as AppSpec;
      } catch {
        setJsonError("JSON نامعتبر است.");
        return;
      }
    }
    setJsonError(null);
    onApprove(edited);
  }

  return (
    <Section
      icon="list"
      title="نیازمندی‌ها و طراحی"
      description={approved ? "تأیید شده؛ کد بر اساس همین نیازمندی‌ها ساخته می‌شود." : "بررسی کنید، در صورت نیاز تغییر دهید و تأیید کنید."}
      actions={
        <span className={approved ? "badge badge-success badge-dot" : "badge badge-warning badge-dot"}>
          {approved ? "تأیید شده" : "منتظر تأیید"}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span
            className="size-10 shrink-0 rounded-lg border border-line shadow-xs"
            style={{ background: spec.primaryColor }}
            title={`رنگ اصلی ${spec.primaryColor}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-fg">{spec.appName}</h3>
            <p className="mt-1 text-sm leading-7 text-fg-2">{spec.summary}</p>
            {spec.targetUsers && (
              <p className="mt-1 text-xs text-muted">
                مخاطبان: <span className="text-fg-2">{spec.targetUsers}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-fg">
              صفحات
              <span className="badge">{spec.screens.length.toLocaleString("fa-IR")}</span>
            </h4>
            <ul className="flex flex-col gap-2">
              {spec.screens.map((screen) => (
                <li key={screen.name} className="panel-muted px-3 py-2.5 text-sm">
                  <div className="font-semibold text-fg">{screen.name}</div>
                  <div className="mt-0.5 text-xs leading-6 text-muted">{screen.purpose}</div>
                  {screen.elements.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {screen.elements.slice(0, 8).map((element) => (
                        <span key={element} className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-fg-2 ring-1 ring-line">
                          {element}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-fg">
                قابلیت‌ها
                <span className="badge">{spec.features.length.toLocaleString("fa-IR")}</span>
              </h4>
              <ul className="flex flex-col gap-1.5 text-sm">
                {spec.features.map((feature) => (
                  <li key={feature} className="flex gap-2 leading-7 text-fg-2">
                    <Icon name="check" size={15} className="mt-1.5 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {spec.dataModel.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-bold text-fg">مدل داده</h4>
                <ul className="flex flex-col gap-2">
                  {spec.dataModel.map((entity) => (
                    <li key={entity.entity} className="panel-muted px-3 py-2">
                      <div className="text-sm font-semibold text-fg">{entity.entity}</div>
                      <div className="ltr mt-1 font-mono text-xs leading-6 text-muted">
                        {entity.fields.map((field) => `${field.name}: ${field.type}`).join(", ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={spec.needsBackend ? "alert alert-info" : "alert"}>
              <Icon name={spec.needsBackend ? "cloud" : "smartphone"} className="mt-1" />
              <div>
                <div className="font-semibold">{spec.needsBackend ? "به سرور و دیتابیس ابری نیاز دارد" : "بدون سرور؛ داده‌ها روی دستگاه می‌ماند"}</div>
                {spec.backendReason && <div className="text-xs leading-6 opacity-90">{spec.backendReason}</div>}
              </div>
            </div>

            {spec.designNotes && (
              <div>
                <h4 className="mb-1 text-sm font-bold text-fg">یادداشت طراحی</h4>
                <p className="text-sm leading-7 text-fg-2">{spec.designNotes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="divider" />

        <div>
          <label className="label" htmlFor="spec-feedback">
            تغییرات موردنظر (اختیاری)
          </label>
          <textarea
            id="spec-feedback"
            className="input min-h-24 resize-y leading-7"
            placeholder="مثلاً: صفحه گزارش سالانه هم اضافه شود؛ ورود کاربر لازم نیست."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>

        <details className="group">
          <summary className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
            <Icon name="chevron-left" size={15} className="transition group-open:-rotate-90" />
            ویرایش پیشرفته (JSON)
          </summary>
          <textarea
            dir="ltr"
            aria-label="نیازمندی‌ها به‌صورت JSON"
            className="input mt-2 min-h-72 font-mono text-xs leading-6"
            value={rawJson}
            spellCheck={false}
            onChange={(event) => setRawJson(event.target.value)}
            aria-invalid={jsonError ? true : undefined}
          />
          {jsonError && <p className="mt-1.5 text-sm text-danger-fg">{jsonError}</p>}
        </details>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={disabled} onClick={approve}>
            <Icon name="check" size={16} />
            {approved ? "ذخیره و تأیید مجدد" : "تأیید نیازمندی‌ها"}
          </button>
          <button className="btn-secondary" disabled={disabled} onClick={() => onGenerate(feedback || undefined)}>
            <Icon name="refresh" size={16} />
            {feedback ? "بازنویسی با این تغییرات" : "تحلیل دوباره"}
          </button>
        </div>
      </div>
    </Section>
  );
}
