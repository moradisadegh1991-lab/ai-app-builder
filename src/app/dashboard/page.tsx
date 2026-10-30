
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";
import { ProjectList } from "@/components/ProjectList";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function SparkleIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" />
    </svg>
  );
}

function ArrowIcon() {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SmartphoneIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  tone: "indigo" | "sky" | "violet";
}) {
  const tones = {
    indigo: {
      icon: "bg-indigo-50 text-indigo-600",
      accent: "bg-indigo-500",
    },
    sky: {
      icon: "bg-sky-50 text-sky-600",
      accent: "bg-sky-500",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600",
      accent: "bg-violet-500",
    },
  };

  const currentTone = tones[tone];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-11 items-center justify-center rounded-xl ${currentTone.icon}`}>
          {icon}
        </div>

        <span className="rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-400">
          WORKSPACE
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-slate-500">
          {label}
        </p>

        <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
          {value.toLocaleString("fa-IR")}
        </p>

        <p className="mt-1 text-[10px] leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <div className={`absolute bottom-0 right-0 h-1 w-0 ${currentTone.accent} transition-all duration-300 group-hover:w-full`} />
    </article>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
          active
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
            : "border border-slate-200 bg-white text-slate-500"
        }`}
      >
        {number}
      </div>

      <div className="min-w-0">
        <h3 className="text-xs font-extrabold text-slate-800">
          {title}
        </h3>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition group-hover:bg-indigo-100 group-hover:text-indigo-700">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-extrabold text-slate-800">
          {title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-slate-500">
          {description}
        </span>
      </span>

      <span className="text-slate-300 transition group-hover:-translate-x-1 group-hover:text-indigo-600">
        <ArrowIcon />
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();

  const projects = await db()
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.updatedAt));

  const totalProjects = projects.length;

  const appProjects = projects.filter(
    (project) => project.kind === "app",
  ).length;

  const websiteProjects = projects.filter(
    (project) => project.kind === "website",
  ).length;

  const displayName =
    user.name ?? user.githubLogin ?? user.email.split("@")[0];

  return (
    <>
      <Header user={user} />

      <main className="page-shell space-y-8 pb-12 pt-7 sm:pt-9">

        {/* Dashboard Heading */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold tracking-wide text-emerald-700">
                WORKSPACE ACTIVE
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              داشبورد شما
            </h1>

            <p className="mt-2 text-xs leading-7 text-slate-500 sm:text-sm">
              سلام {displayName}، به فضای کاری Idea2App AI خوش آمدی.
              از اینجا می‌توانی ایده‌هایت را به محصولات دیجیتال تبدیل کنی.
            </p>
          </div>

          <Link
            href="#new-project"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 sm:self-auto"
          >
            <SparkleIcon />
            شروع پروژه جدید
          </Link>
        </section>

        {/* Main Hero */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -left-24 -top-28 -z-10 size-80 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 right-1/3 -z-10 size-80 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="pointer-events-none absolute inset-0 -z-10 opacity-30">
            <div className="h-full w-full bg-[linear-gradient(to_right,#ffffff0b_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0b_1px,transparent_1px)] bg-[size:34px_34px]" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold text-indigo-200">
                <SparkleIcon />
                AI POWERED APP BUILDER
              </span>

              <h2 className="mt-5 text-2xl font-black leading-relaxed sm:text-3xl">
                ایده‌ات را به یک
                <span className="text-indigo-300"> محصول واقعی </span>
                تبدیل کن.
              </h2>

              <p className="mt-3 max-w-xl text-xs leading-8 text-slate-300 sm:text-sm">
                از تعریف نیازمندی‌ها تا تولید کد و آماده‌سازی انتشار،
                فرایند ساخت محصول را در یک محیط یکپارچه مدیریت کن.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="#new-project"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-indigo-400"
                >
                  ساخت محصول
                  <ArrowIcon />
                </Link>

                <Link
                  href="#projects"
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"
                >
                  مشاهده پروژه‌ها
                </Link>
              </div>
            </div>

            {/* Workflow Visual */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm lg:min-w-[285px]">
              <p className="text-[9px] font-extrabold tracking-[0.18em] text-indigo-200">
                YOUR PRODUCT JOURNEY
              </p>

              <div className="mt-5 space-y-5">
                <WorkflowStep
                  number="01"
                  title="تعریف ایده"
                  description="توضیح نیاز و مشخصات محصول"
                />

                <WorkflowStep
                  number="02"
                  title="تحلیل و تولید"
                  description="تبدیل نیازمندی‌ها به کد"
                  active
                />

                <WorkflowStep
                  number="03"
                  title="انتشار محصول"
                  description="آماده‌سازی و تحویل خروجی"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.18em] text-indigo-600">
                WORKSPACE OVERVIEW
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                نمای کلی فعالیت‌ها
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                خلاصه‌ای از پروژه‌های ثبت‌شده در فضای کاری شما
              </p>
            </div>

            <Link
              href="#projects"
              className="text-[10px] font-bold text-indigo-600 transition hover:text-indigo-800"
            >
              مشاهده همه پروژه‌ها
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="تمام پروژه‌ها"
              value={totalProjects}
              description="مجموع پروژه‌های ایجادشده"
              icon={<GridIcon />}
              tone="indigo"
            />

            <StatCard
              label="اپلیکیشن‌ها"
              value={appProjects}
              description="پروژه‌های اپلیکیشن"
              icon={<SmartphoneIcon />}
              tone="violet"
            />

            <StatCard
              label="وب‌سایت‌ها"
              value={websiteProjects}
              description="پروژه‌های تحت وب"
              icon={<GlobeIcon />}
              tone="sky"
            />
          </div>
        </section>

        {/* Quick Access */}
        <section>
          <div className="mb-4">
            <p className="text-[9px] font-extrabold tracking-[0.18em] text-indigo-600">
              QUICK ACCESS
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              دسترسی سریع
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              href="#new-project"
              icon={<SparkleIcon />}
              title="ساخت پروژه جدید"
              description="شروع یک محصول جدید با هوش مصنوعی"
            />

            <QuickLink
              href="#projects"
              icon={<GridIcon />}
              title="پروژه‌های من"
              description="مدیریت و ادامه پروژه‌های قبلی"
            />

            <QuickLink
              href="/settings"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 1-2.4 2.4 1.7 1.7 0 0 0-2.9 1.2 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.9-1.2A1.7 1.7 0 0 1 5.4 15a1.7 1.7 0 0 0-1.2-2.9 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.2-2.9 1.7 1.7 0 0 1 2.4-2.4 1.7 1.7 0 0 0 2.9-1.2 1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.9 1.2 1.7 1.7 0 0 1 2.4 2.4 1.7 1.7 0 0 0 1.2 2.9 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.2 2.9Z" />
                </svg>
              }
              title="تنظیمات و اتصال‌ها"
              description="مدیریت GitHub و کلیدهای API"
            />
          </div>
        </section>

        {/* New Project */}
        <section id="new-project" className="scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.18em] text-indigo-600">
                CREATE SOMETHING NEW
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                ساخت پروژه جدید
              </h2>

              <p className="mt-1 text-xs leading-6 text-slate-500">
                نوع محصول و روش انتشار را انتخاب کن و ایده‌ات را توضیح بده.
              </p>
            </div>

            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700">
              AI PROJECT BUILDER
            </span>
          </div>

          <NewProjectForm />
        </section>

        {/* Project List */}
        <section id="projects" className="scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.18em] text-indigo-600">
                YOUR WORKSPACE
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                پروژه‌های من
              </h2>

              <p className="mt-1 text-xs leading-6 text-slate-500">
                پروژه‌های قبلی را جست‌وجو کن و برای ادامه توسعه باز کن.
              </p>
            </div>

            <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">
              {totalProjects.toLocaleString("fa-IR")} پروژه
            </span>
          </div>

          <ProjectList projects={projects} />
        </section>

        {/* Footer */}
        <footer className="flex flex-col justify-between gap-3 border-t border-slate-200 py-5 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
              i
            </span>
            <span className="font-bold text-slate-500">
              Idea2App AI
            </span>
            <span>· Workspace</span>
          </div>

          <span>
            ایده‌ات را بساز، توسعه بده و منتشر کن.
          </span>
        </footer>
      </main>
    </>
  );
}
