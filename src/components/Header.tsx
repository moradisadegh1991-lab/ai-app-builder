import Link from "next/link";
import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";

const NAV_ITEMS = [
  { href: "/dashboard", label: "پروژه‌ها", icon: "▦" },
  { href: "/guides", label: "راهنماها", icon: "▤" },
  { href: "/settings", label: "اتصال‌ها و کلیدها", icon: "⌘" },
];

export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);
  const displayName =
    user.name ?? user.githubLogin ?? user.email.split("@")[0];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="page-shell">
        <div className="flex min-h-[68px] items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Idea2App AI - داشبورد"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white shadow-sm shadow-brand-600/20">
              i
            </span>

            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-extrabold tracking-tight text-slate-950">
                Idea2App
                <span className="text-brand-600"> AI</span>
              </span>
              <span className="mt-1 text-[10px] font-medium text-slate-400">
                From idea to application
              </span>
            </span>
          </Link>

          <nav
            aria-label="منوی اصلی"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                <span className="me-2 text-base text-slate-400" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/pricing"
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition hover:border-brand-200 hover:bg-brand-100"
            >
              <span className="size-1.5 rounded-full bg-brand-500" />
              <span>طرح {plan.name}</span>
            </Link>

            <div className="hidden items-center gap-2 border-s border-slate-200 ps-3 sm:flex">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="size-8 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}

              <span className="max-w-28 truncate text-xs font-semibold text-slate-600">
                {displayName}
              </span>
            </div>

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="btn-ghost min-h-9 px-3 text-xs"
                title="خروج از حساب"
              >
                خروج
              </button>
            </form>
          </div>
        </div>

        <nav
          aria-label="منوی موبایل"
          className="-mx-1 flex gap-1 overflow-x-auto border-t border-slate-100 py-2 md:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span className="me-1.5 text-slate-400" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
          <Link href="/pricing" className="nav-link">
            تعرفه‌ها
          </Link>
        </nav>
      </div>
    </header>
  );
}