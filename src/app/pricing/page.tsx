import Link from "next/link";
import { CheckoutButtons } from "@/components/CheckoutButtons";
import { Header } from "@/components/Header";
import { Guide } from "@/components/guides/Guide";
import { UsageMeter } from "@/components/UsageMeter";
import { availableGateways } from "@/lib/billing/payments";
import {
  PLANS,
  isPaidPlan,
  priceToman,
  WINDOW_HOURS,
} from "@/lib/billing/plans";
import { usageSummary } from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const RESULT_MESSAGES: Record<
  string,
  { text: string; className: string }
> = {
  paid: {
    text: "پرداخت موفق بود و طرح جدید فعال شد.",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  pending: {
    text: "پرداخت هنوز تأیید نشده است؛ چند دقیقه دیگر دوباره بررسی کنید.",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
  failed: {
    text: "پرداخت انجام نشد یا لغو شد. اگر مبلغی کسر شده، وضعیت آن را از طریق پشتیبانی درگاه پیگیری کنید.",
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
  },
  cancelled: {
    text: "پرداخت لغو شد.",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
};

function tokens(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fa-IR")} میلیون`;
  }

  return `${(value / 1_000).toLocaleString("fa-IR")} هزار`;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="mt-0.5 size-4 shrink-0 text-emerald-500"
      aria-hidden="true"
    >
      <path
        d="m5 10 3.2 3.2L15.5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      aria-hidden="true"
    >
      <path
        d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);

  const [usage, gateways] = await Promise.all([
    user ? usageSummary(user.id) : Promise.resolve(null),
    Promise.resolve(availableGateways()),
  ]);

  const { payment } = await searchParams;
  const rate = env.usdToToman();

  return (
    <div className="app-shell min-h-screen" dir="rtl">
      {/* Navigation */}
      {user ? (
        <Header user={user} />
      ) : (
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-black tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <SparkleIcon />
            </span>

            <span>
              Idea2App
              <span className="text-brand-600"> AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-brand-600 dark:text-slate-300 sm:inline-flex"
            >
              صفحه اصلی
            </Link>

            <Link href="/#login" className="btn-primary">
              ورود به حساب
            </Link>
          </div>
        </nav>
      )}

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 lg:px-8">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-brand-200/70 bg-white px-6 py-12 shadow-sm dark:border-brand-900/50 dark:bg-slate-900 sm:px-10 lg:px-14">
          <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-80 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
              <SparkleIcon />
              پلن مناسب برای هر مرحله از رشد شما
            </div>

            <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
              ایده‌ات را بساز؛
              <span className="block bg-gradient-to-l from-brand-600 to-violet-500 bg-clip-text text-transparent">
                محدودیت‌ها را کمتر کن
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
              از شروع رایگان تا توسعه حرفه‌ای؛ طرحی را انتخاب کن که با
              حجم استفاده و نیازهای پروژه‌ات هماهنگ باشد.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  ۴ طرح
                </div>
                <div className="text-xs text-slate-500">
                  از رایگان تا حرفه‌ای
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  API شخصی
                </div>
                <div className="text-xs text-slate-500">
                  امکان استفاده از کلید اختصاصی
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  بدون تمدید خودکار
                </div>
                <div className="text-xs text-slate-500">
                  کنترل کامل هزینه‌ها
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Payment result */}
        {payment && RESULT_MESSAGES[payment] && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm leading-7 ${RESULT_MESSAGES[payment].className}`}
          >
            <span className="text-lg">
              {payment === "paid"
                ? "✓"
                : payment === "pending"
                  ? "◷"
                  : "!"}
            </span>

            <p>{RESULT_MESSAGES[payment].text}</p>
          </div>
        )}

        {/* Current usage */}
        {usage && (
          <section className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-bold tracking-widest text-brand-600">
                YOUR SUBSCRIPTION
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                وضعیت اشتراک شما
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                میزان مصرف و سهمیه باقی‌مانده حساب کاربری
              </p>
            </div>

            <UsageMeter usage={usage} />
          </section>
        )}

        {/* Pricing title */}
        <section className="space-y-3 text-center">
          <div className="text-xs font-bold tracking-widest text-brand-600">
            PRICING PLANS
          </div>

          <h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
            طرح اشتراک خود را انتخاب کنید
          </h2>

          <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
            تمام طرح‌ها دسترسی به امکانات اصلی پلتفرم را فراهم می‌کنند.
            تفاوت آن‌ها در میزان مصرف، سطح مدل‌های هوش مصنوعی و امکانات
            اختصاصی است.
          </p>
        </section>

        {/* Plans */}
        <section className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Object.values(PLANS).map((plan) => {
            const current = usage?.plan.id === plan.id;
            const toman = priceToman(plan, rate);

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900 ${
                  plan.highlighted
                    ? "border-brand-500 ring-2 ring-brand-500/20 dark:border-brand-400"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute left-0 top-0 rounded-bl-2xl rounded-tr-2xl bg-brand-600 px-4 py-2 text-[11px] font-bold text-white">
                    پیشنهاد ویژه
                  </div>
                )}

                {/* Plan name */}
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        plan.highlighted
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <SparkleIcon />
                    </span>

                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {plan.name}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {plan.tagline}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5 min-h-20">
                  {plan.priceUsd === 0 ? (
                    <>
                      <div className="text-3xl font-black text-slate-950 dark:text-white">
                        رایگان
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        شروع بدون پرداخت
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-950 dark:text-white">
                          {toman
                            ? toman.toLocaleString("fa-IR")
                            : plan.priceUsd.toLocaleString("fa-IR")}
                        </span>

                        <span className="text-xs font-semibold text-slate-500">
                          {toman ? "تومان" : "دلار"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        ماهانه · اعتبار ۳۰ روزه
                        {toman ? ` · ${plan.priceUsd} دلار` : ""}
                      </p>
                    </>
                  )}
                </div>

                {/* Usage limits */}
                <div className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">
                      سهمیه هر {WINDOW_HOURS.toLocaleString("fa-IR")} ساعت
                    </div>

                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {tokens(plan.windowTokens)}
                      <span className="mr-1 text-xs font-normal text-slate-500">
                        توکن
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-slate-700" />

                  <div>
                    <div className="mb-1 text-xs text-slate-500">
                      سهمیه هفتگی
                    </div>

                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {tokens(plan.weeklyTokens)}
                      <span className="mr-1 text-xs font-normal text-slate-500">
                        توکن
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1">
                  <div className="mb-3 text-xs font-bold text-slate-500">
                    امکانات این طرح
                  </div>

                  <ul className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan action */}
                <div className="mt-6">
                  {current && (
                    <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckIcon />
                      طرح فعلی شما
                    </div>
                  )}

                  {isPaidPlan(plan.id) && (
                    <CheckoutButtons
                      plan={plan.id}
                      gateways={gateways}
                      tomanPrice={toman}
                      usdPrice={plan.priceUsd}
                      loggedIn={Boolean(user)}
                    />
                  )}

                  {!isPaidPlan(plan.id) && !user && (
                    <Link
                      href="/#login"
                      className="btn-secondary block w-full text-center"
                    >
                      شروع رایگان
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Payment information */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 text-2xl">💳</div>

            <h3 className="font-bold text-slate-900 dark:text-white">
              پرداخت امن
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              پرداخت از طریق درگاه‌های فعال پلتفرم انجام می‌شود.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 text-2xl">🔄</div>

            <h3 className="font-bold text-slate-900 dark:text-white">
              مدیریت اعتبار
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              خرید اشتراک به‌صورت یک‌باره است و تمدید خودکار ندارد.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 text-2xl">🔑</div>

            <h3 className="font-bold text-slate-900 dark:text-white">
              کلید API شخصی
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              می‌توانید کلید API سرویس‌های پشتیبانی‌شده را در تنظیمات
              حساب خود ثبت کنید.
            </p>
          </div>
        </section>

        {/* Important subscription rules */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                نکات مهم درباره اشتراک
              </h3>

              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
                <li>
                  پرداخت هر اشتراک برای ۳۰ روز اعتبار دارد و تمدید
                  خودکار انجام نمی‌شود.
                </li>

                <li>
                  خرید مجدد همان طرح به اعتبار فعلی اضافه می‌شود.
                </li>

                <li>
                  خرید طرح دیگر از همان لحظه جایگزین طرح فعلی خواهد شد.
                </li>

                <li>
                  با استفاده از کلید API شخصی، محدودیت توکن مرکزی
                  پلتفرم اعمال نمی‌شود.
                </li>

                <li>
                  سهمیه‌های مصرف در پنجره‌های زمانی مشخص محاسبه شده و
                  پس از پایان بازه آزاد می‌شوند.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Payment guide */}
        <section className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-bold tracking-widest text-brand-600">
              HELP CENTER
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              راهنمای پرداخت و اشتراک
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              مراحل پرداخت و فعال‌سازی اشتراک را مشاهده کنید.
            </p>
          </div>

          <Guide id="payment" />
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 pt-6 text-center dark:border-slate-800">
          <Link
            href="/"
            className="text-sm font-bold text-slate-600 transition hover:text-brand-600 dark:text-slate-400"
          >
            بازگشت به صفحه اصلی Idea2App AI
          </Link>

          <p className="mt-3 text-xs text-slate-400">
            Idea2App AI · Build your next idea
          </p>
        </footer>
      </main>
    </div>
  );
}