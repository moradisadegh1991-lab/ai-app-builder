"use client";

import { useEffect, useRef, useState } from "react";

/** Illustrative planning ranges, not provider quotes or a usage cap. */
export function CostEstimate({ kind, textLength, screens, provider, model, disabled, onCancel, onConfirm }: {
  kind: "spec" | "code"; textLength: number; screens: number; provider: string; model?: string;
  disabled: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const [inputRate, setInputRate] = useState("");
  const [outputRate, setOutputRate] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: "center", behavior: "auto" }); panel.current?.focus({ preventScroll: true }); }, []);
  const complexity = Math.min(8, Math.max(1, screens));
  const input = kind === "spec" ? [2000, 8000 + textLength] : [15000 + complexity * 2000, 60000 + complexity * 6000 + textLength];
  const output = kind === "spec" ? [1000, 8000] : [10000 + complexity * 1000, 55000 + complexity * 3000];
  const ratesValid = inputRate.trim() !== "" && outputRate.trim() !== "" && Number.isFinite(Number(inputRate)) && Number.isFinite(Number(outputRate)) && Number(inputRate) >= 0 && Number(outputRate) >= 0;
  const cost = (a: number, b: number) => ((a * Number(inputRate) + b * Number(outputRate)) / 1000000).toFixed(4);
  const number = (value: number) => value.toLocaleString("fa-IR");
  return (
    <div ref={panel} tabIndex={-1} className="panel p-5" role="region" aria-labelledby="estimate-title">
      <h3 id="estimate-title" className="text-lg font-bold">برآورد پیش از {kind === "spec" ? "تحلیل ایده" : "ساخت کد"}</h3>
      <p className="mt-2 text-sm text-muted">ارائه‌دهنده: {provider}{model && <> · مدل پیش‌فرض: <span dir="ltr">{model}</span></>}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p className="panel-muted p-3 text-sm">توکن ورودی تقریبی: {number(input[0]!)} تا {number(input[1]!)}</p>
        <p className="panel-muted p-3 text-sm">توکن خروجی تقریبی: {number(output[0]!)} تا {number(output[1]!)}</p>
      </div>
      <p className="mt-2 text-sm font-semibold">جمع تقریبی: {number(input[0]! + output[0]!)} تا {number(input[1]! + output[1]!)} توکن</p>
      <p className="mt-3 text-sm leading-7 text-muted">این بازه راهنمای تقریبی است؛ پیچیدگی، پیوست‌ها، مدل‌های تخصصی، تلاش مجدد و اصلاح خطا می‌توانند مصرف را افزایش دهند. سهمیه و سقف واقعی جداگانه اعمال می‌شوند.</p>
      <p className="mt-3 text-sm font-semibold">محاسبهٔ اختیاری هزینه بر اساس نرخ سرویس شما</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">هزینهٔ هر یک میلیون توکن ورودی <input className="input mt-1" type="number" min="0" step="any" value={inputRate} onChange={(e) => setInputRate(e.target.value)} placeholder="نرخ به تومان" /></label>
        <label className="text-sm">هزینهٔ هر یک میلیون توکن خروجی <input className="input mt-1" type="number" min="0" step="any" value={outputRate} onChange={(e) => setOutputRate(e.target.value)} placeholder="نرخ به تومان" /></label>
      </div>
      <p className="mt-2 text-sm" aria-live="polite">{ratesValid ? `هزینهٔ تقریبی: ${cost(input[0]!, output[0]!)} تا ${cost(input[1]!, output[1]!)} تومان` : "نرخ واقعی درگاه در دسترس نیست؛ برای دیدن مبلغ، نرخ‌های سرویس خود را وارد کنید."}</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={disabled} onClick={onConfirm}>تأیید و شروع</button><button type="button" className="btn-secondary" onClick={onCancel}>انصراف</button></div>
    </div>
  );
}
