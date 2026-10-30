
import Link from "next/link";
import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";
import { HeaderNavigation } from "./HeaderNavigation";

export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);

  const displayName =
    user.name ?? user.githubLogin ?? user.email.split("@")[0];

  const avatarInitial = displayName.slice(0, 1).toUpperCase();

  return (
    <header className="app-header">
      <div className="page-shell">
        <div className="flex min-h-[68px] items-center justify-between gap-4">

          {/* Brand */}
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Idea2App AI - داشبورد"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white shadow-md shadow-brand-600/20 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-brand-600/25">
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

          {/* Desktop Navigation */}
          <HeaderNavigation variant="desktop" />

          {/* User Actions */}
          <div className="flex shrink-0 items-center gap-2">

            {/* Subscription */}
            <Link
              href="/pricing"
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition duration-200 hover:border-brand-200 hover:bg-brand-100"
              title="مشاهده طرح و تعرفه‌ها"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
              </span>

              <span>طرح {plan.name}</span>
            </Link>

            {/* User Profile */}
            <div className="hidden items-center gap-2 border-s border-slate-200 ps-3 sm:flex">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={`تصویر پروفایل ${displayName}`}
                  className="size-8 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span
                  className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 text-xs font-extrabold text-brand-700"
                  aria-hidden="true"
                >
                  {avatarInitial}
                </span>
              )}

              <span className="max-w-28 truncate text-xs font-semibold text-slate-600">
                {displayName}
              </span>
            </div>

            {/* Logout */}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="btn-ghost min-h-9 gap-1.5 px-3 text-xs"
                title="خروج از حساب کاربری"
                aria-label="خروج از حساب کاربری"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                </svg>

                <span>خروج</span>
              </button>
            </form>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <HeaderNavigation variant="mobile" />
        </div>
      </div>
    </header>
  );
}
