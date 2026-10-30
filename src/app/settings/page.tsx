
import { Header } from "@/components/Header";
import { SettingsForm } from "@/components/SettingsForm";
import { UsageMeter } from "@/components/UsageMeter";
import { GuideToggle } from "@/components/guides/Guide";
import { providerAvailability } from "@/lib/ai";
import { usageSummary } from "@/lib/billing/subscription";
import { listIntegrations } from "@/lib/integrations/store";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const GITHUB_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "GitHub با موفقیت متصل شد.", ok: true },
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

  return (
    <div className="app-shell">
      <Header user={user} />

      <main className="page-container page-section max-w-4xl">
        {/* Heading */}
        <header className="page-heading">
          <div>
            <div className="eyebrow mb-2">ACCOUNT CONFIGURATION</div>

            <h1 className="page-title">
              اتصال‌ها و تنظیمات
            </h1>

            <p className="page-description">
              حساب GitHub، سرویس‌های هوش مصنوعی و زیرساخت انتشار
              پروژه‌ها را مدیریت کنید.
            </p>
          </div>
        </header>

        {/* Account identity */}
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              حساب کاربری
            </p>

            <p
              dir="ltr"
              className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {user.email}
            </p>
          </div>

          <span className="status-pill status-success">
            حساب فعال
          </span>
        </section>

        {/* OAuth feedback */}
        {message && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            }`}
          >
            <div className="font-semibold">
              {message.ok ? "اتصال موفق" : "اتصال ناموفق"}
            </div>

            <p className="mt-1">
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
        )}

        {/* Usage */}
        <section>
          <div className="mb-3">
            <div className="eyebrow mb-1">PLAN & USAGE</div>
            <h2 className="section-title">مصرف و سهمیه</h2>
          </div>

          <UsageMeter usage={usage} />
        </section>

        {/* GitHub integration */}
        <section className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-slate-950 text-xl text-white">
                GH
              </span>

              <div>
                <h2 className="font-extrabold">GitHub</h2>
                <p className="mt-1 text-xs text-slate-500">
                  ذخیره کد و اجرای Build خودکار
                </p>
              </div>
            </div>

            {githubConnected ? (
              <span className="status-pill status-success">
                متصل
                <span dir="ltr">@{user.githubLogin}</span>
              </span>
            ) : (
              <span className="status-pill status-warning">
                متصل نیست
              </span>
            )}
          </div>

          <div className="divider" />

          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            کد هر پروژه در یک Repository خصوصی در حساب GitHub
            خودتان ذخیره می‌شود. GitHub Actions نیز برای ساخت
            خروجی پروژه استفاده خواهد شد.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/auth/github"
              className={githubConnected ? "btn-secondary" : "btn-primary"}
            >
              {githubConnected
                ? "اتصال دوباره یا تغییر حساب"
                : "اتصال حساب GitHub"}
            </a>

            <GuideToggle id="github" />
          </div>
        </section>

        {/* API integrations */}
        <section>
          <div className="mb-4">
            <div className="eyebrow mb-1">API & SERVICES</div>

            <h2 className="section-title">
              سرویس‌ها و کلیدهای API
            </h2>

            <p className="mt-1 text-xs leading-6 text-slate-500">
              کلیدهای شخصی را وارد کنید تا پروژه‌ها با حساب
              سرویس‌های خودتان ساخته و منتشر شوند.
            </p>
          </div>

          <SettingsForm
            initial={integrations
              .filter((integration) => integration.provider !== "github")
              .map((integration) => ({
                provider: integration.provider,
                secretHint: integration.secretHint,
                metadata: integration.metadata,
              }))}
            providers={providers}
          />
        </section>

        {/* Security note */}
        <section className="surface-muted flex items-start gap-3 p-4">
          <span className="text-xl">🔒</span>

          <div>
            <h3 className="text-sm font-bold">
              امنیت کلیدهای API
            </h3>

            <p className="mt-1 text-xs leading-6 text-slate-500">
              کلیدها با AES-256-GCM رمزنگاری می‌شوند و فقط
              در سمت سرور استفاده خواهند شد. مقدار کامل کلید
              ذخیره‌شده به مرورگر بازگردانده نمی‌شود.
            </p>
          </div>
        </section>

        <div>
          <GuideToggle
            id="vercel-neon"
            label="آموزش تصویری دریافت توکن Vercel و کلید Neon"
          />
        </div>
      </main>
    </div>
  );
}
