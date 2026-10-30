
import { desc, eq } from "drizzle-orm";

import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";
import { ProjectList } from "@/components/ProjectList";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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
  icon: string;
  tone: "indigo" | "sky" | "violet";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    sky: "bg-sky-50 text-sky-600 ring-sky-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  };

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/5">
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl ring-1 transition group-hover:scale-105 ${tones[tone]}`}
      >
        <span aria-hidden="true">{icon}</span>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">
          {value.toLocaleString("fa-IR")}
        </p>
        <p className="mt-1 truncate text-[10px] text-slate-400">
          {description}
        </p>
      </div>
    </div>
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

      <main className="page-shell page-section space-y-8">
        {/* Welcome hero */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -left-16 -top-24 -z-10 size-72 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 -z-10 size-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:36px_36px]" />

          <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-indigo-200">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
                فضای کاری شما آماده است
              </span>

              <h1 className="mt-5 text-2xl font-black leading-tight sm:text-3xl">
                سلام {displayName} 👋
              </h1>

              <p className="mt-3 max-w-xl text-xs leading-7 text-slate-300 sm:text-sm sm:leading-8">
                ایده‌ات را تعریف کن؛ Idea2App AI در تحلیل نیازمندی‌ها،
                تولید کد، ساخت اپلیکیشن و آماده‌سازی انتشار همراه توست.
              </p>

              <a
                href="#new-project"
                className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-950/20 transition hover:-translate-y-0.5 hover:bg-indigo-400"
              >
                ساخت پروژه جدید
                <span aria-hidden="true">←</span>
              </a>
            </div>

            <div className="flex shrink-0 flex-col gap-3 lg:items-end">
              <span className="text-[10px] font-semibold text-slate-400">
                FROM IDEA TO PRODUCT
              </span>

              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white">
                <span className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                  Idea
                </span>
                <span className="text-indigo-300">←</span>
                <span className="rounded-lg bg-indigo-600 px-3 py-2 shadow-lg shadow-indigo-950/20">
                  AI Build
                </span>
                <span className="text-indigo-300">←</span>
                <span className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                  Launch
                </span>
              </div>

              <p className="text-[10px] text-slate-400">
                یک محیط یکپارچه برای ساخت و مدیریت محصولات دیجیتال
              </p>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-indigo-600">
                WORKSPACE OVERVIEW
              </p>
              <h2 className="mt-1 text-base font-extrabold text-slate-900">
                نمای کلی فعالیت‌ها
              </h2>
            </div>
            <span className="text-[10px] text-slate-400">
              آمار پروژه‌های شما
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="همه پروژه‌ها"
              value={totalProjects}
              description="تعداد کل پروژه‌های ایجادشده"
              icon="▦"
              tone="indigo"
            />
            <StatCard
              label="اپلیکیشن‌ها"
              value={appProjects}
              description="پروژه‌های اپلیکیشن"
              icon="▣"
              tone="violet"
            />
            <StatCard
              label="وب‌سایت‌ها"
              value={websiteProjects}
              description="پروژه‌های تحت وب"
              icon="◎"
              tone="sky"
            />
          </div>
        </section>

        {/* New project */}
        <section id="new-project" className="scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-indigo-600">
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
              AI Project Builder
            </span>
          </div>

          <NewProjectForm />
        </section>

        {/* Projects */}
        <section id="projects" className="scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-indigo-600">
                YOUR WORKSPACE
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                پروژه‌های من
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                پروژه‌های قبلی را جست‌وجو کن و برای ادامه توسعه باز کن.
              </p>
            </div>

            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">
              {totalProjects.toLocaleString("fa-IR")} پروژه
            </span>
          </div>

          <ProjectList projects={projects} />
        </section>

        {/* Footer note */}
        <div className="flex flex-col justify-between gap-2 border-t border-slate-200 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <span>Idea2App AI · Workspace</span>
          <span>ایده‌ات را بساز، توسعه بده و منتشر کن.</span>
        </div>
      </main>
    </>
  );
}
