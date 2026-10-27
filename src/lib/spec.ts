import { z } from "zod";

// The structured requirements document the AI produces from a raw idea.
// The user reviews and approves it before any code is generated.
export const appSpecSchema = z.object({
  appName: z.string().min(1).max(60),
  summary: z.string().min(1).max(2000),
  language: z.enum(["fa", "en"]).default("fa"),
  targetUsers: z.string().max(500).default(""),
  screens: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        purpose: z.string().max(500),
        elements: z.array(z.string().max(200)).max(30).default([]),
      }),
    )
    .min(1)
    .max(15),
  features: z.array(z.string().max(300)).min(1).max(40),
  dataModel: z
    .array(
      z.object({
        entity: z.string().min(1).max(60),
        fields: z
          .array(z.object({ name: z.string().min(1).max(60), type: z.string().min(1).max(40) }))
          .max(40),
      }),
    )
    .max(20)
    .default([]),
  needsBackend: z.boolean().default(false),
  backendReason: z.string().max(500).default(""),
  devicePermissions: z.array(z.string().max(60)).max(10).default([]),
  designNotes: z.string().max(1000).default(""),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#4f46e5"),
});

export type AppSpec = z.infer<typeof appSpecSchema>;
