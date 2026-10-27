import Link from "next/link";
import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";

export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-extrabold">
          Idea2App <span className="text-brand-600">AI</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            پروژه‌ها
          </Link>
          <Link href="/guides" className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            آموزش‌ها
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            اتصال‌ها و کلیدها
          </Link>
          <Link
            href="/pricing"
            className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-700/30 dark:text-brand-100"
          >
            طرح {plan.name}
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">خروج</button>
          </form>
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="ms-1 size-8 rounded-full" />
          )}
        </nav>
      </div>
    </header>
  );
}
