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
  already_linked: { text: "این حساب GitHub قبلاً به کاربر دیگری وصل شده است.", ok: false },
  state_error: { text: "نشست اتصال منقضی شد؛ دوباره تلاش کنید.", ok: false },
  denied: { text: "GitHub اتصال را نپذیرفت یا لغو شد.", ok: false },
  failed: { text: "اتصال GitHub ناموفق بود؛ دوباره تلاش کنید.", ok: false },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ github?: string; detail?: string }> }) {
  const user = await requirePageUser();
  const { github, detail } = await searchParams;
  const [integrations, providers, usage] = await Promise.all([
    listIntegrations(user.id),
    providerAvailability(user.id),
    usageSummary(user.id),
  ]);
  const githubConnected = integrations.some((i) => i.provider === "github");
  const message = github ? GITHUB_MESSAGES[github] : undefined;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">اتصال‌ها و کلیدها</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            حساب: <span dir="ltr" className="font-mono">{user.email}</span>. همه کلیدها با AES-256-GCM رمزنگاری و فقط سمت
            سرور استفاده می‌شوند و هیچ‌وقت به مرورگر برگردانده نمی‌شوند.
          </p>
        </div>

        {message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              message.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
            }`}
          >
            {message.text}
            {!message.ok && detail && /^[a-z0-9_]{1,60}$/.test(detail) && (
              <>
                {" "}
                (<span dir="ltr">{detail}</span>)
              </>
            )}
          </p>
        )}

        <UsageMeter usage={usage} />

        <section className="card flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">GitHub</h2>
            {githubConnected ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                متصل <span dir="ltr">@{user.githubLogin}</span>
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                متصل نیست
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            کد هر پروژه در یک Repository خصوصی در حساب GitHub خودتان ذخیره و همان‌جا با GitHub Actions ساخته می‌شود.
          </p>
          <div>
            <a href="/api/auth/github" className={githubConnected ? "btn-secondary" : "btn-primary"}>
              {githubConnected ? "اتصال دوباره / تغییر حساب" : "اتصال GitHub"}
            </a>
          </div>
          <GuideToggle id="github" />
        </section>

        <SettingsForm
          initial={integrations
            .filter((i) => i.provider !== "github")
            .map((i) => ({ provider: i.provider, secretHint: i.secretHint, metadata: i.metadata }))}
          providers={providers}
        />
        <GuideToggle id="vercel-neon" label="آموزش تصویری: گرفتن توکن Vercel و کلید Neon" />
      </main>
    </>
  );
}
