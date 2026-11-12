import { z } from "zod";
import { generateStructured } from "../ai";
import { SPEC_SYSTEM, specPrompt, codeOutputSchema, codeSystemPrompt, type CodeOutput } from "../ai/prompts";
import { imagesOf } from "../attachments";
import type { schema } from "../db";
import { appSpecSchema, type AppSpec } from "../spec";
import { renderProject } from "../templates";
import type { GeneratedFile } from "../templates/types";
import type { TaskStore } from "../workflows/queue";
import { WorkflowYield } from "../workflows/yield";
import {
  architectureSchema,
  designSchema,
  reviewSchema,
  mergeOwnedFiles,
  ownsAgentPath,
  roleProvider,
  type AgentRole,
  type AgentTaskInput,
  type Verification,
} from "./contracts";
import { ROLE_PROMPTS } from "./prompts";

export interface AgentContext {
  runId: string;
  userId: string;
  project: schema.Project;
  input: AgentTaskInput;
  store: TaskStore;
  signal: AbortSignal;
  existing?: { aiFiles: GeneratedFile[]; libraries: string[] };
  failureLog?: string;
  verify: (
    files: GeneratedFile[],
    template: schema.AppTemplate,
    needsBackend: boolean,
    signal: AbortSignal,
    journeys: z.infer<typeof architectureSchema>["journeys"],
  ) => Promise<Verification>;
}
export interface AgentResult {
  spec?: AppSpec;
  code?: {
    aiFiles: GeneratedFile[];
    libraries: string[];
    files: GeneratedFile[];
    warnings: string[];
    notes: string;
    model: string;
  };
}
export const MAX_REPAIR_ROUNDS = 2;

export async function runAgents(ctx: AgentContext): Promise<AgentResult> {
  const { project, input, store } = ctx;
  async function call<T>(
    key: string,
    role: AgentRole,
    output: z.ZodType<T>,
    prompt: string,
    maxOutputTokens: number,
    system?: string,
    images?: { mime: string; data: string }[],
  ) {
    const provider = roleProvider(role, input.provider);
    return store.step(key, role, { provider, prompt, system, images, schemaVersion: 1 }, () =>
      generateStructured({
        userId: ctx.userId,
        projectId: project.id,
        runId: ctx.runId,
        role,
        provider,
        purpose: input.kind,
        system: system ?? ROLE_PROMPTS[role],
        prompt,
        schema: output,
        maxOutputTokens,
        images,
        signal: ctx.signal,
      }),
    );
  }
  if (input.kind === "spec") {
    const result = await call(
      "requirements",
      "architect",
      appSpecSchema,
      specPrompt(
        project.idea,
        {
          kind: project.kind,
          backend: project.kind === "app" ? project.needsCloud : null,
        },
        input.feedback,
        project.spec ?? undefined,
        project.attachments,
      ),
      8000,
      `${ROLE_PROMPTS.architect}\nFor this requirements task use the following output schema instead:\n${SPEC_SYSTEM}`,
      imagesOf(project.attachments),
    );
    if (project.kind === "app") result.data.needsBackend = project.needsCloud;
    return { spec: result.data };
  }
  if (!project.spec || !project.specApprovedAt) throw new Error("نیازمندی‌های تأییدشده پیدا نشد.");
  const spec = project.spec;
  const context = JSON.stringify({
    spec,
    template: project.template,
    instruction: input.instruction,
    failureLog: ctx.failureLog,
  });
  const architecture = await call("architecture", "architect", architectureSchema, context, 4000);
  const design = await call(
    "design",
    "designer",
    designSchema,
    JSON.stringify({
      spec,
      architecture: architecture.data,
      instruction: input.instruction,
    }),
    6000,
    undefined,
    imagesOf(project.attachments),
  );
  const shared = {
    spec,
    architecture: architecture.data,
    design: design.data,
    instruction: input.instruction,
  };
  const codingRules = codeSystemPrompt(project.template, spec.needsBackend);
  let aiFiles = ctx.existing?.aiFiles ?? [];
  let libraries = ctx.existing?.libraries ?? [];
  let model = "";
  const ignoredChanges = new Set<string>();
  let readOnlyPaths: string[] = [];
  function applyChanges(files: GeneratedFile[], role: "frontend" | "backend" | "debugger") {
    const accepted = files.filter((file) => {
      if (ownsAgentPath(role, file.path) && !readOnlyPaths.includes(file.path)) return true;
      ignoredChanges.add(`${role}: تغییر غیرمجاز ${file.path} اعمال نشد.`);
      return false;
    });
    aiFiles = mergeOwnedFiles(aiFiles, accepted, role);
  }
  if (input.kind === "fix") {
    const result = await call(
      "initial-fix",
      "debugger",
      codeOutputSchema,
      JSON.stringify({ ...shared, files: aiFiles, failureLog: ctx.failureLog }),
      24000,
      `${codingRules}\n${ROLE_PROMPTS.debugger}`,
    );
    applyChanges(result.data.files, "debugger");
    libraries = result.data.libraries;
    model = result.model;
  } else {
    // Promise.allSettled drains both calls on failure before a worker can release/retry the run.
    const results = await Promise.allSettled([
      call(
        "frontend",
        "frontend",
        codeOutputSchema,
        JSON.stringify({
          ...shared,
          existingFiles: aiFiles.filter((f) => !f.path.startsWith("server/") && !f.path.startsWith("db/")),
        }),
        28000,
        `${codeSystemPrompt(project.template, spec.needsBackend, "frontend")}\n${ROLE_PROMPTS.frontend}`,
      ),
      spec.needsBackend
        ? call(
            "backend",
            "backend",
            codeOutputSchema,
            JSON.stringify({
              ...shared,
              existingFiles: aiFiles.filter((f) => f.path.startsWith("server/") || f.path.startsWith("db/")),
            }),
            16000,
            `${codeSystemPrompt(project.template, spec.needsBackend, "backend")}\n${ROLE_PROMPTS.backend}`,
          )
        : Promise.resolve(null),
    ]);
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") throw result.reason;
      if (result.value) {
        applyChanges(result.value.data.files, i === 0 ? "frontend" : "backend");
        libraries = [...new Set([...libraries, ...result.value.data.libraries])];
        model = result.value.model;
      }
    }
  }
  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    ctx.signal.throwIfAborted();
    let rendered: ReturnType<typeof renderProject> | undefined;
    let verification: Verification;
    try {
      rendered = renderProject({
        template: project.template,
        slug: project.slug,
        spec,
        aiFiles,
        requestedLibraries: libraries,
      });
      aiFiles = rendered.aiFiles;
      const editable = new Set(aiFiles.map((file) => file.path));
      readOnlyPaths = rendered.files.filter((file) => !editable.has(file.path)).map((file) => file.path);
      if (
        rendered.unresolvedImports.length ||
        rendered.warnings.some((w) => /نادیده گرفته شد|رد شد|مجاز نیست|بزرگ|خارج از فهرست/.test(w))
      ) {
        verification = {
          status: "failed",
          checks: [
            {
              name: "source-contract",
              status: "failed",
              detail: rendered.warnings.join("\n"),
            },
          ],
          log: JSON.stringify(rendered.unresolvedImports),
          screenshots: [],
        };
      } else {
        verification = await store.step(`verify-${round}`, "verifier", rendered.files, () =>
          ctx.verify(rendered!.files, project.template, spec.needsBackend, ctx.signal, architecture.data.journeys),
        );
      }
    } catch (error) {
      if (error instanceof WorkflowYield) throw error;
      verification = {
        status: "failed",
        checks: [{ name: "render", status: "failed", detail: String(error) }],
        log: String(error),
        screenshots: [],
      };
    }
    if (verification.status === "blocked") {
      await store.evaluation(
        round,
        {
          ignoredChanges: [...ignoredChanges],
          verification: {
            ...verification,
            screenshots: verification.screenshots.map((s) => ({
              name: s.name,
            })),
          },
        },
        false,
      );
      throw new Error(`ابزار ارزیابی در دسترس نیست: ${verification.log}`);
    }
    const reviewed = await call(
      `review-${round}`,
      "reviewer",
      reviewSchema,
      JSON.stringify({
        ...shared,
        files: rendered?.files ?? aiFiles,
        readOnlyPaths,
        ignoredChanges: [...ignoredChanges],
        evidence: {
          ...verification,
          screenshots: verification.screenshots.map((s) => s.name),
        },
      }),
      4000,
      undefined,
      verification.screenshots.map(({ mime, data }) => ({ mime, data })),
    );
    const passed = verification.status === "passed" && !reviewed.data.issues.some((i) => i.severity === "blocking");
    await store.evaluation(
      round,
      {
        ignoredChanges: [...ignoredChanges],
        verification: {
          ...verification,
          screenshots: verification.screenshots.map((s) => ({ name: s.name })),
        },
        review: reviewed.data,
      },
      passed,
    );
    if (passed && rendered)
      return {
        code: {
          aiFiles,
          libraries,
          files: rendered.files,
          warnings: [...rendered.warnings, ...ignoredChanges, ...reviewed.data.issues.map((i) => i.evidence)],
          notes: reviewed.data.summary,
          model,
        },
      };
    if (round === MAX_REPAIR_ROUNDS)
      throw new Error("پس از دو دور اصلاح، بررسی کیفیت هنوز موفق نیست؛ گزارش تیم را بررسی کنید.");
    if (reviewed.data.issues.some((i) => i.severity === "blocking" && i.category === "infrastructure"))
      throw new Error(reviewed.data.summary);
    const patch = await call(
      `repair-${round}`,
      "debugger",
      codeOutputSchema,
      JSON.stringify({
        ...shared,
        files: rendered?.files ?? aiFiles,
        readOnlyPaths,
        verification: { ...verification, screenshots: [] },
        review: reviewed.data,
      }),
      24000,
      `${codingRules}\n${ROLE_PROMPTS.debugger}`,
    );
    applyChanges(patch.data.files, "debugger");
    libraries = patch.data.libraries;
    model = patch.model;
  }
  throw new Error("Unreachable workflow state");
}
