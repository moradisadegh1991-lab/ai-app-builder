"use client";

import { useEffect, useRef } from "react";
import { estimateTokens } from "./token-estimate";

/** Illustrative planning ranges, not provider quotes or a usage cap. */
export function CostEstimate({ kind, textLength, screens, needsBackend, attachments, provider, model, disabled, onCancel, onConfirm }: {
  kind: "spec" | "code"; textLength: number; screens: number; needsBackend: boolean; attachments: number; provider: string; model?: string;
  disabled: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: "center", behavior: "auto" }); panel.current?.focus({ preventScroll: true }); }, []);
  const { input, output } = estimateTokens({ kind, textLength, screens, needsBackend, attachments });
  const number = (value: number) => value.toLocaleString("fa-IR");
  return (
    <div ref={panel} tabIndex={-1} className="panel p-5" role="region" aria-labelledby="estimate-title">
      <h3 id="estimate-title" className="text-lg font-bold">برآورد توکن پیش از {kind === "spec" ? "تحلیل ایده" : "ساخت کد"}</h3>
      <p className="mt-2 text-sm text-muted">ارائه‌دهنده: {provider}{model && <> · مدل پیش‌فرض: <span dir="ltr">{model}</span></>}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p className="panel-muted p-3 text-sm">توکن ورودی تقریبی: {number(input[0])} تا {number(input[1])}</p>
        <p className="panel-muted p-3 text-sm">توکن خروجی تقریبی: {number(output[0])} تا {number(output[1])}</p>
      </div>
      <p className="mt-2 text-sm font-semibold">جمع تقریبی: {number(input[0] + output[0])} تا {number(input[1] + output[1])} توکن</p>
      <p className="mt-3 text-sm leading-7 text-muted">این اعداد تخمینی هستند و سقف مصرف تضمین‌شده نیستند. پیچیدگی، پیوست‌ها، مدل‌های تخصصی، تلاش مجدد و اصلاح خطا می‌توانند مصرف واقعی را تغییر دهند. برای محاسبه مبلغ، نرخ ورودی و خروجی تأمین‌کننده را جداگانه بررسی کنید.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={disabled} onClick={onConfirm}>تأیید و شروع</button><button type="button" className="btn-secondary" onClick={onCancel}>انصراف</button></div>
    </div>
  );
}
