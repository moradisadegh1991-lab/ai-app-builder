
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { HttpError } from "@/lib/http";
import { getIntegration } from "@/lib/integrations/store";
import { getOwnedProject, projectView } from "@/lib/projects";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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
    <div className="app-shell">
      <Header user={user} />

      <main className="page-container page-section">
        <ProjectWorkspace
          initialProject={view}
          githubConnected={Boolean(githubIntegration)}
        />
      </main>
    </div>
  );
}
