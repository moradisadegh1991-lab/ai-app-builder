import { Header } from "@/components/Header";
import { SettingsForm } from "@/components/SettingsForm";
import { platformUsageToday, providerAvailability } from "@/lib/ai";
import { env } from "@/lib/env";
import { listIntegrations } from "@/lib/integrations/store";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser();
  const [integrations, providers, usedToday] = await Promise.all([
    listIntegrations(user.id),
    providerAvailability(user.id),
    platformUsageToday(user.id),
  ]);

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">اتصال‌ها و کلیدها</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            همه کلیدها با AES-256-GCM رمزنگاری و فقط سمت سرور استفاده می‌شوند؛ هیچ‌وقت به مرورگر برگردانده نمی‌شوند.
          </p>
        </div>

        <section className="card text-sm">
          <h2 className="mb-2 font-bold">GitHub</h2>
          <p>
            متصل به حساب <span dir="ltr" className="font-mono">@{user.githubLogin}</span> از طریق ورود OAuth (دسترسی
            ساخت Repository و Workflow).
          </p>
        </section>

        <section className="card text-sm">
          <h2 className="mb-2 font-bold">سهمیه کلید مرکزی هوش مصنوعی</h2>
          <p>
            امروز {usedToday.toLocaleString("fa-IR")} از {env.aiDailyRequestLimit().toLocaleString("fa-IR")} درخواست
            مصرف شده است. با وارد کردن کلید شخصی، سهمیه اعمال نمی‌شود.
          </p>
        </section>

        <SettingsForm
          initial={integrations.map((i) => ({ provider: i.provider, secretHint: i.secretHint, metadata: i.metadata }))}
          providers={providers}
        />
      </main>
    </>
  );
}
