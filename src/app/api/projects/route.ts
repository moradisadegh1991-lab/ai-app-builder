import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { db, schema } from "@/lib/db";
import { handleRoute, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";
import { slugify } from "@/lib/templates";

const createSchema = z.object({
  idea: z.string().trim().min(15, "ایده را کمی کامل‌تر توضیح دهید.").max(5000),
  template: z.enum(["capacitor", "expo"]).default("capacitor"),
  aiProvider: z.enum(AI_PROVIDERS),
  name: z.string().trim().max(60).optional(),
});

export async function GET() {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const projects = await db()
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        status: schema.projects.status,
        template: schema.projects.template,
        githubRepo: schema.projects.githubRepo,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .where(eq(schema.projects.userId, user.id))
      .orderBy(desc(schema.projects.updatedAt));
    return NextResponse.json({ projects });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireApiUser();
    const body = await readJson(request, (v) => createSchema.parse(v));
    const name = body.name || "اپ جدید";
    // Persian names slugify to nothing, so fall back to a short random suffix.
    const slug = `${slugify(body.name ?? "", "app")}-${Math.random().toString(36).slice(2, 7)}`;
    const [project] = await db()
      .insert(schema.projects)
      .values({ userId: user.id, name, slug, idea: body.idea, template: body.template, aiProvider: body.aiProvider })
      .returning({ id: schema.projects.id });
    return NextResponse.json({ id: project!.id }, { status: 201 });
  });
}
