import { z } from "zod";

// Data only: no raw HTML, JS, inline CSS, event handlers or arbitrary URLs.
const id = z.string().uuid();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const componentTypes = ["text", "heading", "image", "button", "card", "container", "stack", "grid", "divider"] as const;
const style = z.object({
  color: color.optional(), background: color.optional(),
  fontSize: z.number().int().min(10).max(96).optional(),
  padding: z.number().int().min(0).max(96).optional(),
  margin: z.number().int().min(0).max(96).optional(),
  radius: z.number().int().min(0).max(64).optional(),
  width: z.enum(["auto", "full", "half"]).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  visible: z.boolean().optional(),
}).strict();
const props = z.object({
  text: z.string().max(2000).optional(),
  // Asset references are opaque IDs; delivery must resolve and authorize them separately.
  assetId: id.optional(),
  alt: z.string().max(250).optional(),
}).strict();
export type VisualComponent = { id: string; type: typeof componentTypes[number]; props: z.infer<typeof props>; style: z.infer<typeof style>; children: VisualComponent[] };
const component: z.ZodType<VisualComponent> = z.lazy(() => z.object({
  id, type: z.enum(componentTypes), props, style,
  children: z.array(component).max(50),
}).strict());
const page = z.object({ id, title: z.string().trim().min(1).max(100), route: z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/).max(120), components: z.array(component).max(50) }).strict();
const visualProjectSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().min(0).max(2147483647),
  designTokens: z.object({ primary: color, background: color, direction: z.enum(["rtl", "ltr"]) }).strict(),
  pages: z.array(page).min(1).max(30),
}).strict().superRefine((project, ctx) => {
  const ids = new Set<string>(), routes = new Set<string>();
  let count = 0;
  const addId = (value: string) => { if (ids.has(value)) ctx.addIssue({ code: "custom", message: "Duplicate ID" }); ids.add(value); };
  const visit = (nodes: VisualComponent[], depth: number) => {
    for (const node of nodes) {
      count++; addId(node.id);
      if (depth > 8) { ctx.addIssue({ code: "custom", message: "Maximum component depth exceeded" }); return; }
      if (count > 500) { ctx.addIssue({ code: "custom", message: "Maximum component count exceeded" }); return; }
      if (!["card", "container", "stack", "grid"].includes(node.type) && node.children.length) ctx.addIssue({ code: "custom", message: "Component cannot have children" });
      visit(node.children, depth + 1);
    }
  };
  for (const item of project.pages) {
    addId(item.id);
    if (routes.has(item.route)) ctx.addIssue({ code: "custom", message: "Duplicate route" });
    routes.add(item.route); visit(item.components, 1);
  }
});
export type VisualProject = z.infer<typeof visualProjectSchema>;

/** Validate shape limits before Zod descends into untrusted recursive objects. */
export function parseVisualProject(input: unknown) {
  const seen = new WeakSet<object>();
  const stack: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (value === null || typeof value !== "object") continue;
    if (seen.has(value) || depth > 24 || ++count > 5000) return { success: false as const, error: "ساختار ویرایشگر بیش از حد بزرگ یا تودرتو است." };
    seen.add(value);
    for (const child of Object.values(value)) stack.push({ value: child, depth: depth + 1 });
  }
  return visualProjectSchema.safeParse(input);
}
