import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";
import { StatusBadge } from "@/components/StatusBadge";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const projects = await db()
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.updatedAt));

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">سلام {user.name ?? user.githubLogin} 👋</h1>
          <p className="text-slate-600 dark:text-slate-400">ایده‌ات را بنویس تا قدم‌به‌قدم به APK برسیم.</p>
        </div>

        <NewProjectForm />

        <section>
          <h2 className="mb-3 text-lg font-bold">پروژه‌های من</h2>
          {projects.length === 0 ? (
            <p className="card text-sm text-slate-500">هنوز پروژه‌ای نساخته‌ای.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="card transition hover:border-brand-500">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold">{project.name}</h3>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{project.idea}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{project.template === "capacitor" ? "Capacitor" : "Expo"}</span>
                    <span>{project.updatedAt.toLocaleDateString("fa-IR")}</span>
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
