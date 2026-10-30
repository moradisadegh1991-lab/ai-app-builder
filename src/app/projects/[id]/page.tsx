مسیر فایل: "src/app/projects/[id]/page.tsx"

import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { HttpError } from "@/lib/http";
import { getIntegration } from "@/lib/integrations/store";
import { getOwnedProject, projectView } from "@/lib/projects";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function WorkspaceBreadcrumb() {
  return (
    <nav
      aria-label="مسیر صفحه"
      className="mb-6 flex flex-wrap items-center gap-2 text-sm"
    >
      <Link
        href="/dashboard"
        className="font-medium text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        داشبورد
      </Link>

      <span className="text-slate-300 dark:text-slate-600">/</span>

      <span
        aria-current="page"
        className="font-semibold text-slate-800 dark:text-slate-100"
      >
        فضای کاری پروژه
      </span>
    </nav>
  );
}

function WorkspaceIntro() {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
            <span className="size-2 rounded-full bg-indigo-500" />
            AI Project Workspace
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            از ایده تا محصول نهایی
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            نیازمندی‌ها را بررسی کن، مشخصات محصول را تأیید کن، کد را تولید کن
            و مراحل Build و انتشار پروژه را مدیریت کن.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
        >
          <span aria-hidden="true">←</span>
          بازگشت به داشبورد
        </Link>
      </div>
    </section>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const project = await getOwnedProject(user.id, id).catch((error) => {
    if (error instanceof HttpError && error.status === 404) {
      notFound();
    }

    throw error;
  });

  const [view, githubIntegration] = await Promise.all([
    projectView(project),
    getIntegration(user.id, "github"),
  ]);

  return (
    <div className="app-shell min-h-screen">
      <Header user={user} />

      <main className="page-container page-section mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <WorkspaceBreadcrumb />

        <WorkspaceIntro />

        <div className="min-w-0">
          <ProjectWorkspace
            initialProject={view}
            githubConnected={Boolean(githubIntegration)}
          />
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
          <p>
            Idea2App AI · مدیریت و توسعه هوشمند پروژه
          </p>
        </footer>
      </main>
    </div>
  );
}