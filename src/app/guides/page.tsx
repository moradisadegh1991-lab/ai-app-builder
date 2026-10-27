import { Header } from "@/components/Header";
import { Guide } from "@/components/guides/Guide";
import { GUIDES, type GuideId } from "@/components/guides/data";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ORDER: GuideId[] = ["github", "install-apk", "own-vps", "oracle", "gcp", "aws", "vercel-neon", "payment", "login"];

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const user = await requirePageUser();
  const { g } = await searchParams;
  const selected = (ORDER as string[]).includes(g ?? "") ? (g as GuideId) : "github";

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">آموزش‌های تصویری</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            هر مرحله با یک تصویر نمادین از صفحه‌ای که می‌بینید و جای دقیق کلیک توضیح داده شده است.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {ORDER.map((id) => (
            <a
              key={id}
              href={`/guides?g=${id}`}
              className={`rounded-full px-3 py-1.5 text-sm ${
                id === selected ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {GUIDES[id].title}
            </a>
          ))}
        </nav>
        <Guide key={selected} id={selected} />
      </main>
    </>
  );
}
