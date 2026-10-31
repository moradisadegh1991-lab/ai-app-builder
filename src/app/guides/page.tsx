import Link from "next/link";
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
      <main className="page-container flex flex-col gap-6 py-8">
        <div>
          <h1 className="page-title">آموزش‌های تصویری</h1>
          <p className="page-subtitle">هر مرحله با یک تصویر نمادین از صفحه‌ای که می‌بینید و جای دقیق کلیک توضیح داده شده است.</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="فهرست آموزش‌ها" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:px-0">
            {ORDER.map((id) => (
              <Link
                key={id}
                href={`/guides?g=${id}`}
                aria-current={id === selected ? "page" : undefined}
                className="nav-link shrink-0 lg:whitespace-normal"
              >
                {GUIDES[id].title}
              </Link>
            ))}
          </nav>
          <Guide key={selected} id={selected} />
        </div>
      </main>
    </>
  );
}
