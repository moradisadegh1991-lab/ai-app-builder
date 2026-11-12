import { NewProjectForm } from "./NewProjectForm";
import { ProjectList, type ProjectItem } from "./ProjectList";
import { Icon, type IconName } from "./ui/Icon";

function StatCard({ label, value, icon, hint }: { label: string; value: number; icon: IconName; hint: string }) {
  return (
    <div className="dashboard-stat">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className="dashboard-stat-icon !size-9 shrink-0">
          <Icon name={icon} size={19} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-fg">{value.toLocaleString("fa-IR")}</div>
      <p className="mt-1 hidden text-[11px] text-muted sm:block">{hint}</p>
    </div>
  );
}

export function DashboardContent({ projects, displayName }: { projects: ProjectItem[]; displayName: string }) {
  const apps = projects.filter((project) => project.kind === "app").length;
  const websites = projects.length - apps;
  const onGitHub = projects.filter((project) => project.status === "pushed").length;

  const newProject = (
    <section id="new-project" className="scroll-mt-24">
      <div className="card !p-5 sm:!p-6">
        <NewProjectForm />
      </div>
    </section>
  );

  return (
    <>
      <main id="main-content" className="page-container flex flex-col gap-8 py-8">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">استودیوی شخصی تو</span>
            <h1 className="page-title">سلام {displayName}، امروز چه می‌سازی؟</h1>
            <p className="page-subtitle">یک ایدهٔ تازه شروع کن، یا به ساختن پروژه‌هایت ادامه بده.</p>
          </div>
          <a href="#new-project" className="btn-primary self-start sm:self-auto">
            <Icon name="plus" size={16} />
            شروع یک ایدهٔ تازه
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="projects-title" className="section-title">
                فضای ایده‌های من
              </h2>
              <p className="mt-1 text-sm text-muted">از اولین طرح تا آخرین نسخه، همه‌چیز همین‌جاست.</p>
            </div>
            <span className="badge">{projects.length.toLocaleString("fa-IR")} پروژه</span>
          </div>
          <ProjectList projects={projects} />
        </section>

        {projects.length > 0 && newProject}
      </main>
    </>
  );
}
