import { desc, eq } from "drizzle-orm";
import { Header } from "@/components/Header";
import { DashboardContent } from "@/components/DashboardContent";
import type { ProjectItem } from "@/components/ProjectList";
import { db, schema } from "@/lib/db";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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

  const displayName = user.name ?? user.githubLogin ?? user.email.split("@")[0];
  return (
    <>
      <Header user={user} />
      <DashboardContent projects={projects} displayName={displayName} />
    </>
  );
}
