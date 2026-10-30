import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";
import { StatusBadge } from "@/components/StatusBadge";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-600">
        <span aria-hidden>{icon}</span>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
          {value.toLocaleString("fa-IR")}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-400">
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
  const appProjects = projects.filter((project) => project.kind === "app").length;
  const websiteProjects = projects.filter(
    (project) => project.kind === "website",
  ).length;

  const displayName =
    user.name ?? user.githubLogin ?? user.email.split("@")[0];

  return (
    <>
      <Header user={user} />

      <main className="page-shell page-section">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-64 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-200">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                فضای کاری شما آماده است
              </span>

              <h1 className="mt-5 text-2xl font-extrabold leading-tight sm:text-3xl">
                سلام {displayName} 👋
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                ایده‌تان را تعریف کنید؛ Idea2App AI تحلیل نیازمندی، تولید کد،
                ساخت اپلیکیشن و انتشار آن را مرحله‌به‌مرحله انجام می‌دهد.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <span className="text-xs text-slate-400">
                از ایده تا محصول نهایی
              </span>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="rounded-lg bg-white/10 px-3 py-2">
                  Idea
                </span>
                <span className="text-indigo-300">←</span>
                <span className="rounded-lg bg-brand-600 px-3 py-2">
                  AI Build
                </span>
                <span className="text-indigo-300">←</span>
                <span className="rounded-lg bg-white/10 px-3 py-2">
                  Launch
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="همه پروژه‌ها"
            value={totalProjects}
            description="تعداد کل پروژه‌های ایجادشده"
            icon="▦"
          />
          <StatCard
            label="اپلیکیشن‌ها"
            value={appProjects}
            description="پروژه‌های اندروید"
            icon="▣"
          />
          <StatCard
            label="وب‌سایت‌ها"
            value={websiteProjects}
            description="پروژه‌های تحت وب"
            icon="◎"
          />
        </section>

        <section id="new-project" className="scroll-mt-28">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">CREATE SOMETHING NEW</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                ساخت پروژه جدید
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                نوع محصول و روش انتشار را انتخاب کنید و ایده خود را توضیح دهید.
              </p>
            </div>
          </div>

          <NewProjectForm />
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                پروژه‌های من
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                پروژه‌های قبلی را باز کنید و ادامه دهید.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {totalProjects.toLocaleString("fa-IR")} پروژه
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="card flex flex-col items-center justify-center px-5 py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
                ✨
              </div>
              <h3 className="mt-4 font-bold text-slate-900">
                هنوز پروژه‌ای نساخته‌اید
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                اولین ایده خود را در فرم بالا وارد کنید تا فرایند ساخت محصول
                دیجیتال را شروع کنیم.
              </p>
              <a href="#new-project" className="btn-primary mt-5">
                شروع ساخت اولین پروژه
                <span aria-hidden>←</span>
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card card-hover group flex min-h-48 flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-600 transition group-hover:bg-brand-100">
                      {project.kind === "website" ? "◎" : "▣"}
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <h3 className="mt-4 truncate font-bold text-slate-900 transition group-hover:text-brand-700">
                    {project.name}
                  </h3>

                  <p className="mt-2 line-clamp-2 flex-1 text-xs leading-6 text-slate-500">
                    {project.idea}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                    <span>
                      {project.kind === "website" ? "وب‌سایت" : "اپلیکیشن"}{" "}
                      <span className="mx-1">·</span>
                      {project.hosting === "vps"
                        ? "VPS"
                        : project.hosting === "vercel"
                          ? "Vercel"
                          : "محلی"}
                    </span>

                    <span>
                      {project.updatedAt.toLocaleDateString("fa-IR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}