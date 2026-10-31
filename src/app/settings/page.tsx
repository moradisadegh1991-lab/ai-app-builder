
import Link from "next/link";
import { Header } from "@/components/Header";
import { Icon } from "@/components/ui/Icon";
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
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-fg">
        {title}
      </h2>

      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
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
      className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-fg-2 transition hover:bg-surface-3 hover:text-primary-soft-fg"
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
    <div>
      <Header user={user} />

      <main className="page-container flex !max-w-6xl flex-col gap-10 py-8">
        {/* Page heading */}
        <header className="mb-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-line bg-primary-soft px-3 py-1.5 text-[11px] font-bold text-primary-soft-fg">
                <span className="size-1.5 rounded-full bg-primary" />
                ACCOUNT CONTROL CENTER
              </div>

              <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
                تنظیمات حساب
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                اتصال‌ها، کلیدهای دسترسی، وضعیت سرویس‌ها و تنظیمات
                امنیتی حساب Idea2App AI را از یک پنل مدیریت کنید.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="btn-secondary self-start"
            >
              <span aria-hidden="true">←</span>
              بازگشت به داشبورد
            </Link>
          </div>
        </header>

        {/* Account summary */}
        <section className="mb-6 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-lg font-black text-primary-soft-fg">
                {(user.name ?? user.email).slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-faint">
                  حساب کاربری
                </p>

                <p
                  dir="ltr"
                  className="mt-1 truncate text-sm font-bold text-fg"
                >
                  {user.email}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success-fg">
                حساب فعال
              </span>

              {user.githubLogin && (
                <span
                  dir="ltr"
                  className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] font-semibold text-fg-2"
                >
                  @{user.githubLogin}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold text-faint">
              اتصال GitHub
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  githubConnected ? "bg-success" : "bg-warning"
                }`}
              />

              <span className="text-lg font-extrabold text-fg">
                {githubConnected ? "متصل" : "نیازمند اتصال"}
              </span>
            </div>

            <p className="mt-2 text-xs text-muted">
              {githubConnected
                ? "امکان استفاده از مخازن و Build"
                : "برای ساخت و ذخیره کد متصل شوید"}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold text-faint">
              اتصال‌های ذخیره‌شده
            </p>

            <p className="mt-2 text-2xl font-black tabular-nums text-fg">
              {integrations.length}
            </p>

            <p className="mt-2 text-xs text-muted">
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
                ? "border-success-line bg-success-soft text-success-fg"
                : "border-danger-line bg-danger-soft text-danger-fg"
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

            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg">
                    <Icon name="github" size={24} />
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-fg">
                      GitHub Account
                    </h3>

                    <p className="mt-1 text-xs text-muted">
                      {githubConnected
                        ? "حساب GitHub به Idea2App متصل است."
                        : "هنوز حساب GitHub متصل نشده است."}
                    </p>

                    {githubConnected && user.githubLogin && (
                      <p
                        dir="ltr"
                        className="mt-2 text-sm font-bold text-fg"
                      >
                        @{user.githubLogin}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                    githubConnected
                      ? "bg-success-soft text-success-fg"
                      : "bg-warning-soft text-warning-fg"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      githubConnected ? "bg-success" : "bg-warning"
                    }`}
                  />

                  {githubConnected ? "متصل" : "متصل نیست"}
                </span>
              </div>

              <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-xs leading-6 text-muted">
                    برای اتصال یا تغییر حساب، فرایند رسمی OAuth اجرا می‌شود.
                    مجوزهای دسترسی توسط GitHub مدیریت می‌شوند.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="/api/auth/github"
                      className="btn-primary"
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

            <div className="mb-4 rounded-2xl border border-info-line bg-info-soft p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg" aria-hidden="true">
                  ⓘ
                </span>

                <div>
                  <p className="text-sm font-bold text-info-fg">
                    مدیریت اتصال‌های شخصی
                  </p>

                  <p className="mt-1 text-xs leading-6 text-info-fg">
                    اگر کلید شخصی ثبت کنید، سیستم مطابق منطق فعلی از آن
                    استفاده می‌کند. در صورت نبود کلید شخصی، کلید مرکزی
                    پلتفرم در صورت پیکربندی در دسترس خواهد بود.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-sm font-extrabold text-fg">
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
              <h3 className="mb-3 text-sm font-extrabold text-fg">
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
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-success-soft text-success-fg">
                    <Icon name="key" />
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-fg">
                      حفاظت از کلیدها
                    </h3>

                    <p className="mt-1 text-xs text-success-fg">
                      رمزنگاری در سمت سرور
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-7 text-muted">
                  کلیدهای API با AES-256-GCM رمزنگاری می‌شوند. مقدار کامل
                  کلید ذخیره‌شده به مرورگر بازگردانده نمی‌شود و فقط
                  نشانه ماسک‌شده آن در رابط کاربری نمایش داده می‌شود.
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
                    <Icon name="shield" />
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-fg">
                      نشست ورود
                    </h3>

                    <p className="mt-1 text-xs text-muted">
                      کوکی امن و HttpOnly
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-7 text-muted">
                  نشست حساب در کوکی HttpOnly نگهداری می‌شود. زمان اعتبار
                  نشست فعلی طبق تنظیمات سیستم هفت روز است. در محیط
                  Production، ویژگی Secure نیز فعال می‌شود.
                </p>

                <form action="/api/auth/logout" method="post" className="mt-4">
                  <button
                    type="submit"
                    className="btn-danger btn-sm"
                  >
                    خروج از حساب کاربری
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-xs leading-7 text-muted">
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
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-sm font-extrabold text-fg">
              راهنما و مستندات اتصال
            </h3>

            <p className="mt-2 text-xs leading-6 text-muted">
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

        <footer className="mt-12 border-t border-line py-6 text-center text-[11px] text-faint">
          Idea2App AI · Account Settings
        </footer>
      </main>
    </div>
  );
}
