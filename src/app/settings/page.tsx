
import Link from "next/link";
import { Header } from "@/components/Header";
import { SettingsForm } from "@/components/SettingsForm";
import { UsageMeter } from "@/components/UsageMeter";
import { GuideToggle } from "@/components/guides/Guide";
import { ServiceHealthPanel } from "@/components/ServiceHealthPanel";
import { providerAvailability } from "@/lib/ai";
import { usageSummary } from "@/lib/billing/subscription";
import { listIntegrations } from "@/lib/integrations/store";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const GITHUB_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: {
    text: "GitHub با موفقیت متصل شد.",
    ok: true,
  },
  already_linked: {
    text: "این حساب GitHub قبلاً به کاربر دیگری وصل شده است.",
    ok: false,
  },
  state_error: {
    text: "نشست اتصال منقضی شد؛ دوباره تلاش کنید.",
    ok: false,
  },
  denied: {
    text: "GitHub اتصال را نپذیرفت یا لغو شد.",
    ok: false,
  },
  failed: {
    text: "اتصال GitHub ناموفق بود؛ دوباره تلاش کنید.",
    ok: false,
  },
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>

      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function SettingsNav() {
  const items = [
    { href: "#github", label: "اتصال GitHub" },
    { href: "#api-keys", label: "کلیدهای API" },
    { href: "#services", label: "وضعیت سرویس‌ها" },
    { href: "#security", label: "امنیت حساب" },
    { href: "#usage", label: "مصرف و سهمیه" },
  ];

  return (
    <nav
      aria-label="بخش‌های تنظیمات"
      className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string; detail?: string }>;
}) {
  const user = await requirePageUser();
  const { github, detail } = await searchParams;

  const [integrations, providers, usage] = await Promise.all([
    listIntegrations(user.id),
    providerAvailability(user.id),
    usageSummary(user.id),
  ]);

  const githubConnected = integrations.some(
    (integration) => integration.provider === "github",
  );

  const message = github ? GITHUB_MESSAGES[github] : undefined;

  const infrastructureIntegrations = integrations.filter(
    (integration) =>
      integration.provider === "vercel" ||
      integration.provider === "neon",
  );

  const aiIntegrations = integrations.filter(
    (integration) =>
      integration.provider === "openai" ||
      integration.provider === "anthropic" ||
      integration.provider === "gemini",
  );

  return (
    <div className="app-shell">
      <Header user={user} />

      <main className="page-container page-section max-w-6xl">
        {/* Page heading */}
        <header className="mb-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
                <span className="size-1.5 rounded-full bg-brand-500" />
                ACCOUNT CONTROL CENTER
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                تنظیمات حساب
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                اتصال‌ها، کلیدهای دسترسی، وضعیت سرویس‌ها و تنظیمات
                امنیتی حساب Idea2App AI را از یک پنل مدیریت کنید.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span aria-hidden="true">←</span>
              بازگشت به داشبورد
            </Link>
          </div>
        </header>

        {/* Account summary */}
        <section className="mb-6 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-lg font-black text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {(user.name ?? user.email).slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400">
                  حساب کاربری
                </p>

                <p
                  dir="ltr"
                  className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white"
                >
                  {user.email}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                حساب فعال
              </span>

              {user.githubLogin && (
                <span
                  dir="ltr"
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  @{user.githubLogin}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-400">
              اتصال GitHub
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  githubConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />

              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                {githubConnected ? "متصل" : "نیازمند اتصال"}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {githubConnected
                ? "امکان استفاده از مخازن و Build"
                : "برای ساخت و ذخیره کد متصل شوید"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-400">
              اتصال‌های ذخیره‌شده
            </p>

            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {integrations.length}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              شامل GitHub و کلیدهای سرویس
            </p>
          </div>
        </section>

        {/* Section navigation */}
        <div className="mb-8">
          <SettingsNav />
        </div>

        {/* OAuth feedback */}
        {message && (
          <div
            role="status"
            className={`mb-8 rounded-2xl border p-4 ${
              message.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg" aria-hidden="true">
                {message.ok ? "✓" : "!"}
              </span>

              <div>
                <p className="text-sm font-bold">
                  {message.ok ? "اتصال موفق" : "اتصال ناموفق"}
                </p>

                <p className="mt-1 text-xs leading-6">
                  {message.text}

                  {!message.ok &&
                    detail &&
                    /^[a-z0-9_]{1,60}$/.test(detail) && (
                      <>
                        {" "}
                        (<span dir="ltr">{detail}</span>)
                      </>
                    )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-10">
          {/* GitHub */}
          <section id="github" className="scroll-mt-24">
            <SectionHeading
              eyebrow="SOURCE CONTROL"
              title="اتصال GitHub"
              description="حساب GitHub برای ذخیره کد پروژه‌ها، ساخت Repository خصوصی و اجرای گردش کار Build استفاده می‌شود."
            />

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-xl font-black text-white shadow-lg shadow-slate-950/10">
                    GH
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      GitHub Account
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {githubConnected
                        ? "حساب GitHub به Idea2App متصل است."
                        : "هنوز حساب GitHub متصل نشده است."}
                    </p>

                    {githubConnected && user.githubLogin && (
                      <p
                        dir="ltr"
                        className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200"
                      >
                        @{user.githubLogin}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                    githubConnected
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      githubConnected ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />

                  {githubConnected ? "متصل" : "متصل نیست"}
                </span>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-xs leading-6 text-slate-500 dark:text-slate-400">
                    برای اتصال یا تغییر حساب، فرایند رسمی OAuth اجرا می‌شود.
                    مجوزهای دسترسی توسط GitHub مدیریت می‌شوند.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="/api/auth/github"
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      {githubConnected
                        ? "اتصال مجدد / تغییر حساب"
                        : "اتصال حساب GitHub"}
                    </a>

                    <GuideToggle id="github" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* API keys */}
          <section id="api-keys" className="scroll-mt-24">
            <SectionHeading
              eyebrow="API CREDENTIALS"
              title="کلیدهای API و زیرساخت"
              description="کلیدهای اختصاصی سرویس‌های انتشار و هوش مصنوعی را مدیریت کنید. مقدار کلید ذخیره‌شده قابل مشاهده نیست و برای جایگزینی باید کلید جدید وارد شود."
            />

            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30">
              <div className="flex items-start gap-3">
                <span className="text-lg" aria-hidden="true">
                  ⓘ
                </span>

                <div>
                  <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
                    مدیریت اتصال‌های شخصی
                  </p>

                  <p className="mt-1 text-xs leading-6 text-sky-800/80 dark:text-sky-300/80">
                    اگر کلید شخصی ثبت کنید، سیستم مطابق منطق فعلی از آن
                    استفاده می‌کند. در صورت نبود کلید شخصی، کلید مرکزی
                    پلتفرم در صورت پیکربندی در دسترس خواهد بود.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-sm font-extrabold text-slate-800 dark:text-slate-200">
                زیرساخت و انتشار
              </h3>

              <SettingsForm
                initial={infrastructureIntegrations.map((integration) => ({
                  provider: integration.provider,
                  secretHint: integration.secretHint,
                  metadata: integration.metadata,
                }))}
                providers={providers}
                serviceGroup="infrastructure"
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-extrabold text-slate-800 dark:text-slate-200">
                ارائه‌دهندگان هوش مصنوعی
              </h3>

              <SettingsForm
                initial={aiIntegrations.map((integration) => ({
                  provider: integration.provider,
                  secretHint: integration.secretHint,
                  metadata: integration.metadata,
                }))}
                providers={providers}
                serviceGroup="ai"
              />
            </div>
          </section>

          {/* Service status */}
          <section id="services" className="scroll-mt-24">
            <SectionHeading
              eyebrow="SYSTEM HEALTH"
              title="وضعیت سرویس‌ها"
              description="وضعیت پیکربندی سرویس‌های اصلی و دسترسی پایگاه داده را مشاهده کنید."
            />

            <ServiceHealthPanel />
          </section>

          {/* Security */}
          <section id="security" className="scroll-mt-24">
            <SectionHeading
              eyebrow="ACCOUNT SECURITY"
              title="امنیت حساب"
              description="اطلاعات مربوط به نشست ورود و حفاظت از اطلاعات حساس حساب."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-lg dark:bg-emerald-950">
                    🔐
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      حفاظت از کلیدها
                    </h3>

                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      رمزنگاری در سمت سرور
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-7 text-slate-500 dark:text-slate-400">
                  کلیدهای API با AES-256-GCM رمزنگاری می‌شوند. مقدار کامل
                  کلید ذخیره‌شده به مرورگر بازگردانده نمی‌شود و فقط
                  نشانه ماسک‌شده آن در رابط کاربری نمایش داده می‌شود.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-lg dark:bg-indigo-950">
                    🛡️
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      نشست ورود
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      کوکی امن و HttpOnly
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-7 text-slate-500 dark:text-slate-400">
                  نشست حساب در کوکی HttpOnly نگهداری می‌شود. زمان اعتبار
                  نشست فعلی طبق تنظیمات سیستم هفت روز است. در محیط
                  Production، ویژگی Secure نیز فعال می‌شود.
                </p>

                <form action="/api/auth/logout" method="post" className="mt-4">
                  <button
                    type="submit"
                    className="inline-flex min-h-9 items-center rounded-xl border border-red-200 px-3 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    خروج از حساب کاربری
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs leading-7 text-slate-500 dark:text-slate-400">
                در نسخه فعلی، امکان تغییر رمز عبور، مشاهده نشست‌های فعال
                دیگر یا لغو دسترسی GitHub از داخل این صفحه پیاده‌سازی
                نشده است. این بخش صرفاً وضعیت و سازوکارهای موجود را
                نمایش می‌دهد.
              </p>
            </div>
          </section>

          {/* Usage */}
          <section id="usage" className="scroll-mt-24">
            <SectionHeading
              eyebrow="PLAN & USAGE"
              title="مصرف و سهمیه"
              description="میزان استفاده از سرویس‌های هوش مصنوعی و محدودیت‌های طرح فعال."
            />

            <UsageMeter usage={usage} />
          </section>

          {/* Guides */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              راهنما و مستندات اتصال
            </h3>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              برای دریافت توکن‌های زیرساخت و راه‌اندازی سرویس‌ها از
              راهنماهای مربوط استفاده کنید.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <GuideToggle
                id="vercel-neon"
                label="آموزش دریافت توکن Vercel و کلید Neon"
              />

              <GuideToggle id="github" label="راهنمای اتصال GitHub" />
            </div>
          </section>
        </div>

        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-[11px] text-slate-400 dark:border-slate-800">
          Idea2App AI · Account Settings
        </footer>
      </main>
    </div>
  );
}
