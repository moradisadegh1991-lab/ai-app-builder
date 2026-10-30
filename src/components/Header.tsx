
import Link from "next/link";
import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";
import { HeaderNavigation } from "./HeaderNavigation";

function BrandMark() {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-brand-600 to-violet-700 text-white shadow-lg shadow-indigo-600/20 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-indigo-600/30">
      <span className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-white/30" />
      <span className="relative text-xl font-black tracking-tighter">
        i
      </span>
      <span className="absolute bottom-2 right-2 size-1.5 rounded-full bg-cyan-300 shadow-sm" />
    </span>
  );
}

function UserAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const initial = displayName.slice(0, 1).toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`تصویر پروفایل ${displayName}`}
        className="size-9 rounded-xl border border-slate-200 object-cover"
      />
    );
  }

  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-100 text-sm font-extrabold text-indigo-700"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function PlanIcon() {
  return (
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
      <path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z" />
      <path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="17"
      height="17"
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
  );
}

export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);

  const displayName =
    user.name ?? user.githubLogin ?? user.email.split("@")[0];

  return (
    <header className="app-header">
      <div className="page-shell">
        <div className="flex min-h-[72px] items-center justify-between gap-3">

          {/* Brand */}
          <Link
            href="/dashboard"
            className="group flex min-w-0 shrink-0 items-center gap-3"
            aria-label="Idea2App AI - داشبورد"
          >
            <BrandMark />

            <span className="flex min-w-0 flex-col leading-tight">
              <span className="whitespace-nowrap text-[15px] font-black tracking-tight text-slate-950 sm:text-base">
                Idea2App
                <span className="text-indigo-600"> AI</span>
              </span>

              <span className="mt-1 hidden text-[10px] font-medium tracking-wide text-slate-400 sm:block">
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
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
              title="مشاهده طرح و تعرفه‌ها"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm transition group-hover:scale-105">
                <PlanIcon />
              </span>

              <span className="hidden sm:inline">
                طرح {plan.name}
              </span>

              <span className="sm:hidden">
                {plan.name}
              </span>
            </Link>

            {/* User Profile */}
            <div className="hidden items-center gap-2.5 border-s border-slate-200 ps-3 sm:flex">
              <UserAvatar
                avatarUrl={user.avatarUrl}
                displayName={displayName}
              />

              <span className="flex max-w-32 flex-col">
                <span className="truncate text-xs font-bold text-slate-700">
                  {displayName}
                </span>
                <span className="mt-0.5 max-w-32 truncate text-[10px] text-slate-400">
                  {user.email}
                </span>
              </span>
            </div>

            {/* Logout */}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-xs font-bold text-slate-500 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                title="خروج از حساب کاربری"
                aria-label="خروج از حساب کاربری"
              >
                <LogoutIcon />
                <span className="hidden sm:inline">خروج</span>
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
