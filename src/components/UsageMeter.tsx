import Link from "next/link";
import type { UsageSummary } from "@/lib/billing/subscription";
import { UNLIMITED_TOKENS } from "@/lib/billing/plans";

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیون`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("fa-IR")} هزار`;
  return value.toLocaleString("fa-IR");
}

function formatReset(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" });
}

function Bar({ label, used, limit, resetsAt }: { label: string; used: number; limit: number; resetsAt: string | null }) {
  const unlimited = limit >= UNLIMITED_TOKENS;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-slate-500">
          {unlimited ? `${formatTokens(used)} توکن · نامحدود` : `${formatTokens(used)} از ${formatTokens(limit)} توکن`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      {resetsAt && used > 0 && <div className="mt-1 text-[11px] text-slate-500">آزاد شدن کامل: {formatReset(resetsAt)}</div>}
    </div>
  );
}

/** Plan name and the two rolling usage windows (5 hours and 7 days). */
export function UsageMeter({ usage }: { usage: UsageSummary }) {
  return (
    <section className="card flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">طرح {usage.plan.name}</h2>
          <p className="text-xs text-slate-500">
            {usage.currentPeriodEnd
              ? `اعتبار تا ${new Date(usage.currentPeriodEnd).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" })}`
              : usage.plan.priceUsd === 0 && usage.plan.id === "max"
                ? "حساب توسعه‌دهنده"
                : "رایگان و بدون انقضا"}
            {" · "}
            {usage.plan.modelTier === "economy" ? "مدل‌های اقتصادی" : "مدل‌های اصلی"}
          </p>
        </div>
        <Link href="/pricing" className="btn-secondary">
          {usage.plan.id === "free" ? "ارتقای طرح" : "تمدید یا تغییر طرح"}
        </Link>
      </div>
      <Bar label="مصرف ۵ ساعت اخیر" {...usage.window} />
      <Bar label="مصرف ۷ روز اخیر" {...usage.week} />
      <p className="text-[11px] text-slate-500">
        سقف‌ها فقط برای کلیدهای مرکزی پلتفرم است. با وارد کردن کلید API شخصی، محدودیت توکن ندارید.
      </p>
    </section>
  );
}
