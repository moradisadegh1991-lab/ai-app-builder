import Link from "next/link";
import { CheckoutButtons } from "@/components/CheckoutButtons";
import { Header } from "@/components/Header";
import { Guide } from "@/components/guides/Guide";
import { UsageMeter } from "@/components/UsageMeter";
import { availableGateways } from "@/lib/billing/payments";
import { PLANS, isPaidPlan, priceToman, WINDOW_HOURS } from "@/lib/billing/plans";
import { usageSummary } from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const RESULT_MESSAGES: Record<string, { text: string; className: string }> = {
  paid: { text: "✅ پرداخت موفق بود و طرح جدید فعال شد.", className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  pending: { text: "⏳ پرداخت هنوز تأیید نشده است؛ چند دقیقه دیگر این صفحه را باز کنید.", className: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  failed: { text: "❌ پرداخت انجام نشد یا لغو شد. اگر مبلغی کسر شده، ظرف ۷۲ ساعت به حساب شما برمی‌گردد.", className: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  cancelled: { text: "پرداخت لغو شد.", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

function tokens(value: number) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString("fa-IR")} میلیون`
    : `${(value / 1_000).toLocaleString("fa-IR")} هزار`;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  const usage = user ? await usageSummary(user.id) : null;
  const { payment } = await searchParams;
  const gateways = availableGateways();
  const rate = env.usdToToman();

  return (
    <>
      {user ? (
        <Header user={user} />
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <Link href="/" className="text-lg font-extrabold">
            Idea2App <span className="text-brand-600">AI</span>
          </Link>
        </div>
      )}
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">طرح‌های اشتراک</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            مثل ChatGPT، Claude و Gemini: یک طرح رایگان با سقف مصرف، و طرح‌های ۲۰، ۱۰۰ و ۲۰۰ دلاری با سقف بیشتر و مدل‌های
            قوی‌تر. سقف‌ها روی پنجره‌های {WINDOW_HOURS.toLocaleString("fa-IR")} ساعته و هفتگی شمرده می‌شوند و خودکار آزاد
            می‌شوند.
          </p>
        </div>

        {payment && RESULT_MESSAGES[payment] && (
          <p className={`rounded-xl px-4 py-3 text-sm ${RESULT_MESSAGES[payment].className}`}>{RESULT_MESSAGES[payment].text}</p>
        )}

        {usage && <UsageMeter usage={usage} />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Object.values(PLANS).map((plan) => {
            const current = usage?.plan.id === plan.id;
            const toman = priceToman(plan, rate);
            return (
              <div
                key={plan.id}
                className={`card flex flex-col gap-4 ${plan.highlighted ? "border-brand-500 ring-2 ring-brand-500/30" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-extrabold">{plan.name}</h2>
                    {plan.highlighted && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] text-white">محبوب</span>}
                  </div>
                  <p className="text-xs text-slate-500">{plan.tagline}</p>
                </div>
                <div>
                  {plan.priceUsd === 0 ? (
                    <div className="text-2xl font-extrabold">رایگان</div>
                  ) : (
                    <>
                      <div className="text-2xl font-extrabold">
                        {toman ? `${toman.toLocaleString("fa-IR")} تومان` : `${plan.priceUsd} دلار`}
                      </div>
                      <div className="text-xs text-slate-500">
                        ماهانه (۳۰ روز){toman ? ` · ${plan.priceUsd} دلار` : ""}
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                  <div>
                    هر {WINDOW_HOURS.toLocaleString("fa-IR")} ساعت: <b>{tokens(plan.windowTokens)}</b> توکن
                  </div>
                  <div>
                    هر هفته: <b>{tokens(plan.weeklyTokens)}</b> توکن
                  </div>
                </div>
                <ul className="flex-1 space-y-1.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <div className="rounded-lg bg-emerald-50 py-2 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    طرح فعلی شما
                  </div>
                ) : null}
                {isPaidPlan(plan.id) && (
                  <CheckoutButtons
                    plan={plan.id}
                    gateways={gateways}
                    tomanPrice={toman}
                    usdPrice={plan.priceUsd}
                    loggedIn={Boolean(user)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500">
          پرداخت یک‌باره برای ۳۰ روز است و تمدید خودکار ندارد. خرید دوباره همان طرح به اعتبار فعلی اضافه می‌شود؛ خرید طرح دیگر از
          همان لحظه جایگزین می‌شود. با کلید API شخصی (صفحه «اتصال‌ها و کلیدها») سقف توکن اعمال نمی‌شود.
        </p>

        <Guide id="payment" />
      </main>
    </>
  );
}
