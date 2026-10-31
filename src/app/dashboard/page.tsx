import { desc, eq } from "drizzle-orm";
import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";
import { ProjectList, type ProjectItem } from "@/components/ProjectList";
import { Icon, type IconName } from "@/components/ui/Icon";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function StatCard({ label, value, icon, hint }: { label: string; value: number; icon: IconName; hint: string }) {
  return (
    <div className="card flex items-center gap-4 !p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-3 text-fg-2">
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-2xl font-bold tracking-tight text-fg">{value.toLocaleString("fa-IR")}</div>
        <div className="truncate text-[11px] text-faint">{hint}</div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();

  // Only what the list shows: the page must not ship attachments or specs to the browser.
  const projects: ProjectItem[] = await db()
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      idea: schema.projects.idea,
      kind: schema.projects.kind,
      hosting: schema.projects.hosting,
      status: schema.projects.status,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.updatedAt));

  const apps = projects.filter((project) => project.kind === "app").length;
  const websites = projects.length - apps;
  const onGitHub = projects.filter((project) => project.status === "pushed").length;
  const displayName = user.name ?? user.githubLogin ?? user.email.split("@")[0];

  const newProject = (
    <section id="new-project" className="scroll-mt-24">
      <div className="card !p-5 sm:!p-6">
        <NewProjectForm />
      </div>
    </section>
  );

  return (
    <>
      <Header user={user} />
      <main className="page-container flex flex-col gap-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title">سلام {displayName}</h1>
            <p className="page-subtitle">پروژه‌هایت را مدیریت کن یا ایدهٔ تازه‌ای را به اپ و وب‌سایت تبدیل کن.</p>
          </div>
          <a href="#new-project" className="btn-primary self-start sm:self-auto">
            <Icon name="plus" size={16} />
            پروژهٔ جدید
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="همهٔ پروژه‌ها" value={projects.length} icon="layers" hint="در حساب شما" />
          <StatCard label="اپ‌های Android" value={apps} icon="smartphone" hint="APK با GitHub Actions" />
          <StatCard label="وب‌سایت‌ها" value={websites} icon="globe" hint="Vercel یا VPS" />
          <StatCard label="در GitHub" value={onGitHub} icon="git-branch" hint="آخرین نسخه ارسال شده" />
        </div>

        {projects.length === 0 && newProject}

        <section aria-labelledby="projects-title" className="flex flex-col gap-4">
          <div>
            <h2 id="projects-title" className="section-title">
              پروژه‌های من
            </h2>
            <p className="text-sm text-muted">برای ادامهٔ کار، پروژه را باز کنید.</p>
          </div>
          <ProjectList projects={projects} />
        </section>

        {projects.length > 0 && newProject}
      </main>
    </>
  );
}
