import { z } from "zod";
import type { AiProviderId } from "../ai/types";
import type { GeneratedFile } from "../templates/types";

export const AGENT_ROLES = ["architect", "designer", "frontend", "backend", "reviewer", "debugger"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const AGENT_LABELS: Record<AgentRole | "verifier" | "publisher", string> = {
  architect: "معمار محصول",
  designer: "طراح UI/UX",
  frontend: "توسعه‌دهنده رابط کاربری",
  backend: "توسعه‌دهنده سرور",
  reviewer: "ارزیاب کیفیت",
  debugger: "متخصص رفع خطا",
  verifier: "آزمایش فنی و مرورگر",
  publisher: "ثبت نسخه در GitHub",
};
const text = z.string().min(1).max(2000);
export const journeySchema = z.object({
  name: z.string().min(1).max(120),
  steps: z
    .array(
      z.discriminatedUnion("action", [
        z.object({
          action: z.literal("click"),
          role: z.enum(["button", "link", "tab", "checkbox"]),
          name: z.string().min(1).max(150),
        }),
        z.object({
          action: z.literal("fill"),
          label: z.string().min(1).max(150),
          value: z.string().max(300),
        }),
        z.object({
          action: z.literal("expectText"),
          text: z.string().min(1).max(300),
        }),
      ]),
    )
    .min(1)
    .max(12),
});
export const architectureSchema = z.object({
  summary: text,
  modules: z
    .array(z.object({ name: text, responsibility: text }))
    .min(1)
    .max(20),
  api: z
    .array(
      z.object({
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        path: z.string().regex(/^\/api\//),
        // A bodyless GET/DELETE legitimately has an empty request description.
        request: z.string().max(2000),
        response: text,
      }),
    )
    .max(30),
  acceptance: z.array(text).min(1).max(20),
  journeys: z.array(journeySchema).min(1).max(5),
});
export const designSchema = z.object({
  tokens: z.object({
    colors: z.record(z.string(), z.string().max(100)),
    typography: text,
    spacing: text,
  }),
  components: z
    .array(z.object({ name: text, behavior: text }))
    .min(1)
    .max(25),
  screens: z
    .array(
      z.object({
        name: text,
        layout: text,
        mobile: text,
        desktop: text,
        loading: text,
        empty: text,
        error: text,
        success: text,
      }),
    )
    .min(1)
    .max(15),
  accessibility: z.array(text).min(1).max(15),
});
export const issueSchema = z.object({
  severity: z.enum(["blocking", "warning"]),
  category: z.enum(["code", "ux", "security", "infrastructure"]),
  file: z.string().max(200),
  evidence: text,
  fix: text,
});
export const reviewSchema = z.object({
  summary: text,
  issues: z.array(issueSchema).max(25),
});
export type Architecture = z.infer<typeof architectureSchema>;
export type Design = z.infer<typeof designSchema>;
export type Review = z.infer<typeof reviewSchema>;

export interface Verification {
  status: "passed" | "failed" | "blocked";
  checks: {
    name: string;
    status: "passed" | "failed" | "skipped";
    detail: string;
  }[];
  log: string;
  screenshots: { name: string; mime: string; data: string }[];
}
export interface AgentTaskInput {
  kind: "spec" | "code" | "edit" | "fix";
  provider: AiProviderId;
  feedback?: string;
  instruction?: string;
  auto?: boolean;
}
export function mergeOwnedFiles(
  base: GeneratedFile[],
  next: GeneratedFile[],
  role: "frontend" | "backend" | "debugger",
) {
  const files = new Map(base.map((f) => [f.path, f]));
  for (const file of next) {
    const backend = file.path.startsWith("server/") || file.path === "db/schema.sql";
    const frontend = file.path.startsWith("src/") || file.path.startsWith("public/") || file.path === "App.tsx";
    if ((role === "backend" && !backend) || (role === "frontend" && !frontend) || (!backend && !frontend)) {
      throw new Error(`ایجنت ${role} اجازه تغییر ${file.path} را ندارد.`);
    }
    files.set(file.path, { path: file.path, content: file.content });
  }
  return [...files.values()];
}

/** Runtime-validated provider routing; model tier and key ownership remain enforced by the AI layer. */
export function roleProvider(role: AgentRole, fallback: AiProviderId): AiProviderId {
  const override = process.env[`AGENT_${role.toUpperCase()}_PROVIDER`];
  if (!override) return fallback;
  if (override !== "openai" && override !== "anthropic" && override !== "gemini")
    throw new Error(`Invalid provider for ${role}`);
  return override;
}
