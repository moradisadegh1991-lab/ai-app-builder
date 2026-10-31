import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai";
import { db, schema } from "@/lib/db";
import { attachmentsSchema } from "@/lib/attachments";
import { activePlan } from "@/lib/billing/subscription";
import { HttpError, handleRoute, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";
import { slugify } from "@/lib/templates";

const createSchema = z
  .object({
    idea: z.string().trim().min(15, "ایده را کمی کامل‌تر توضیح دهید.").max(5000),
    attachments: attachmentsSchema.default([]),
    kind: z.enum(["app", "website"]),
    // Apps: Capacitor or Expo. Websites always use the web template.
    template: z.enum(["capacitor", "expo"]).default("capacitor"),
    // Apps only: false = runs only on the phone, true = needs a server/cloud.
    needsCloud: z.boolean().default(false),
    hosting: z.enum(["none", "vps", "vercel"]),
    vpsProvider: z.enum(["own", "oracle", "gcp", "aws"]).optional(),
    aiProvider: z.enum(AI_PROVIDERS),
    name: z.string().trim().max(60).optional(),
  })
  .superRefine((value, ctx) => {
    const online = value.kind === "website" || value.needsCloud;
    if (online && value.hosting === "none") {
      ctx.addIssue({ code: "custom", path: ["hosting"], message: "محل اجرای سرور را انتخاب کنید." });
    }
    if (!online && value.hosting !== "none") {
      ctx.addIssue({ code: "custom", path: ["hosting"], message: "اپ محلی به سرور نیاز ندارد." });
    }
    if (value.hosting === "vps" && !value.vpsProvider) {
      ctx.addIssue({ code: "custom", path: ["vpsProvider"], message: "نوع VPS را انتخاب کنید." });
    }
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
        kind: schema.projects.kind,
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
    const { plan } = await activePlan(user.id);
    if (plan.maxProjects !== null) {
      const [row] = await db()
        .select({ value: count() })
        .from(schema.projects)
        .where(eq(schema.projects.userId, user.id));
      if ((row?.value ?? 0) >= plan.maxProjects) {
        throw new HttpError(
          403,
          `طرح «${plan.name}» حداکثر ${plan.maxProjects.toLocaleString("fa-IR")} پروژه دارد. یک پروژه را حذف کنید یا طرح را ارتقا دهید.`,
        );
      }
    }
    const name = body.name || (body.kind === "website" ? "سایت جدید" : "اپ جدید");
    // Persian names slugify to nothing, so fall back to a short random suffix.
    const slug = `${slugify(body.name ?? "", "app")}-${Math.random().toString(36).slice(2, 7)}`;
    const [project] = await db()
      .insert(schema.projects)
      .values({
        userId: user.id,
        name,
        slug,
        idea: body.idea,
        attachments: body.attachments.length ? body.attachments : null,
        kind: body.kind,
        template: body.kind === "website" ? "web" : body.template,
        needsCloud: body.kind === "website" || body.needsCloud,
        hosting: body.hosting,
        vpsProvider: body.hosting === "vps" ? body.vpsProvider : null,
        aiProvider: body.aiProvider,
      })
      .returning({ id: schema.projects.id });
    return NextResponse.json({ id: project!.id }, { status: 201 });
  });
}
