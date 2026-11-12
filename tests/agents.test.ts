import { beforeEach, describe, expect, it, vi } from "vitest";
import { appSpecSchema } from "../src/lib/spec";
import { runAgents, type AgentContext } from "../src/lib/agents/orchestrator";
import { architectureSchema, mergeOwnedFiles, roleProvider, type Verification } from "../src/lib/agents/contracts";
import type { schema } from "../src/lib/db";

const { model } = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock("../src/lib/ai", () => ({ generateStructured: model }));
const spec = appSpecSchema.parse({
  appName: "فهرست کار",
  summary: "فهرست کارها",
  features: ["ثبت کار"],
  screens: [{ name: "خانه", purpose: "ثبت کار" }],
  needsBackend: true,
});
const architecture = {
  summary: "Todo app",
  modules: [{ name: "tasks", responsibility: "Store tasks" }],
  api: [{ method: "GET", path: "/api/tasks", request: "none", response: "Task[]" }],
  acceptance: ["Task can be saved"],
  journeys: [{ name: "home", steps: [{ action: "expectText", text: "کارها" }] }],
};
const design = {
  tokens: {
    colors: { primary: "#4f46e5" },
    typography: "Vazirmatn",
    spacing: "8px grid",
  },
  components: [{ name: "button", behavior: "44px target" }],
  screens: [
    {
      name: "خانه",
      layout: "list",
      mobile: "stack",
      desktop: "centered",
      loading: "spinner",
      empty: "no tasks",
      error: "retry",
      success: "task added",
    },
  ],
  accessibility: ["labels"],
};
it("accepts an API contract for a bodyless GET request", () => {
  expect(
    architectureSchema.parse({ ...architecture, api: [{ ...architecture.api[0], request: "" }] }).api[0]?.request,
  ).toBe("");
});
const frontend = {
  files: [
    {
      path: "src/App.tsx",
      content: "export default function App(){return <main>کارها</main>}",
    },
  ],
  libraries: [],
  notes: "",
};
const backend = {
  files: [
    { path: "server/app.ts", content: "export const app = {};" },
    {
      path: "db/schema.sql",
      content: "CREATE TABLE IF NOT EXISTS tasks(id serial primary key);",
    },
  ],
  libraries: [],
  notes: "",
};
const passed: Verification = {
  status: "passed",
  checks: [{ name: "build", status: "passed", detail: "real tool evidence" }],
  log: "",
  screenshots: [],
};

function context(): AgentContext {
  const cache = new Map<string, unknown>();
  return {
    runId: "run",
    userId: "user",
    project: {
      id: "project",
      template: "web",
      slug: "tasks",
      spec,
      specApprovedAt: new Date(),
      attachments: null,
    } as schema.Project,
    input: { kind: "code", provider: "openai" },
    signal: new AbortController().signal,
    store: {
      step: async (key, _role, _input, action) => {
        if (cache.has(key)) return cache.get(key) as never;
        const result = await action();
        cache.set(key, result);
        return result;
      },
      evaluation: vi.fn(),
    },
    verify: vi.fn().mockResolvedValue(passed),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  model.mockImplementation(async (options) => {
    const outputs: Record<string, unknown> = {
      architect: architecture,
      designer: design,
      frontend,
      backend,
      reviewer: { summary: "All requirements verified", issues: [] },
      debugger: frontend,
    };
    return {
      data: options.schema.parse(outputs[options.role]),
      model: `model-${options.role}`,
    };
  });
});

describe("specialist orchestration", () => {
  it("passes shared design/API contracts to independent frontend/backend specialists and verifies their merged result", async () => {
    const ctx = context();
    const result = await runAgents(ctx);
    expect(model.mock.calls.map(([o]) => o.role)).toEqual(["architect", "designer", "frontend", "backend", "reviewer"]);
    const input = JSON.parse(model.mock.calls.find(([o]) => o.role === "frontend")![0].prompt);
    expect(input.architecture.api[0].path).toBe("/api/tasks");
    expect(input.design.tokens.typography).toBe("Vazirmatn");
    const frontRules = model.mock.calls.find(([o]) => o.role === "frontend")![0].system;
    const backRules = model.mock.calls.find(([o]) => o.role === "backend")![0].system;
    expect(frontRules).toContain('apiFetch("/api/<route>")');
    expect(frontRules).not.toContain("Output db/schema.sql");
    expect(frontRules).not.toContain("Output server/app.ts");
    expect(backRules).toContain("Output server/app.ts");
    expect(backRules).not.toContain("You MUST output src/App.tsx");
    expect(result.code?.files.some((f) => f.path === "server/app.ts")).toBe(true);
    expect(ctx.verify).toHaveBeenCalledOnce();
    expect(ctx.store.evaluation).toHaveBeenCalledWith(0, expect.anything(), true);
  });
  it("never accepts a reviewer's approval when the real build fails; stops after two repair rounds", async () => {
    const ctx = context();
    vi.mocked(ctx.verify).mockResolvedValue({
      ...passed,
      status: "failed",
      checks: [{ name: "build", status: "failed", detail: "Compiler error" }],
    });
    await expect(runAgents(ctx)).rejects.toThrow("دو دور اصلاح");
    expect(model.mock.calls.filter(([o]) => o.role === "debugger")).toHaveLength(2);
    expect(ctx.store.evaluation).toHaveBeenCalledTimes(3);
    expect(vi.mocked(ctx.store.evaluation).mock.calls.every((c) => c[2] === false)).toBe(true);
  });
  it("repairs a reviewer finding and runs verification again before delivering", async () => {
    const ctx = context();
    let reviews = 0;
    const original = model.getMockImplementation()!;
    model.mockImplementation(async (options) =>
      options.role === "reviewer" && reviews++ === 0
        ? {
            data: {
              summary: "Missing empty state",
              issues: [
                {
                  severity: "blocking",
                  category: "ux",
                  file: "src/App.tsx",
                  evidence: "Empty state absent",
                  fix: "Add empty state",
                },
              ],
            },
            model: "reviewer",
          }
        : original(options),
    );
    await expect(runAgents(ctx)).resolves.toHaveProperty("code");
    expect(ctx.verify).toHaveBeenCalledTimes(2);
  });
  it("reports infrastructure outages without wasting debugger calls", async () => {
    const ctx = context();
    vi.mocked(ctx.verify).mockResolvedValue({
      ...passed,
      status: "blocked",
      log: "Docker image missing",
    });
    await expect(runAgents(ctx)).rejects.toThrow("Docker image missing");
    expect(model.mock.calls.some(([o]) => o.role === "debugger")).toBe(false);
  });
  it("resumes completed specialist tasks from durable checkpoints", async () => {
    const ctx = context();
    await runAgents(ctx);
    const count = model.mock.calls.length;
    await runAgents(ctx);
    expect(model).toHaveBeenCalledTimes(count);
  });
  it("rejects a specialist that crosses its file ownership boundary", () => {
    expect(() => mergeOwnedFiles([], backend.files, "frontend")).toThrow("اجازه تغییر");
    expect(() => mergeOwnedFiles([], frontend.files, "backend")).toThrow("اجازه تغییر");
    expect(() => mergeOwnedFiles([], [{ path: "package.json", content: "{}" }], "debugger")).toThrow("اجازه تغییر");
  });
  it("discards foreign files from a specialist without applying them or losing its valid work", async () => {
    const original = model.getMockImplementation()!;
    model.mockImplementation(async (options) =>
      options.role === "frontend"
        ? {
            data: {
              ...frontend,
              files: [
                ...frontend.files,
                { path: "server/app.ts", content: "foreign backend" },
                { path: "package.json", content: "unsafe package" },
              ],
            },
            model: "frontend",
          }
        : original(options),
    );
    const result = await runAgents(context());
    expect(result.code?.files.find((f) => f.path === "server/app.ts")?.content).toBe(backend.files[0]!.content);
    expect(result.code?.files.find((f) => f.path === "package.json")?.content).not.toContain("unsafe package");
    expect(result.code?.warnings.join("\n")).toContain("frontend: تغییر غیرمجاز server/app.ts اعمال نشد.");
  });
  it("applies a debugger's valid patch while fencing package and template edits", async () => {
    const ctx = context();
    vi.mocked(ctx.verify)
      .mockResolvedValueOnce({ ...passed, status: "failed" })
      .mockResolvedValue(passed);
    const original = model.getMockImplementation()!;
    model.mockImplementation(async (options) =>
      options.role === "debugger"
        ? {
            data: {
              ...frontend,
              files: [
                ...frontend.files,
                { path: "package.json", content: "unsafe package" },
                { path: "src/main.tsx", content: "unsafe entry" },
              ],
            },
            model: "debugger",
          }
        : original(options),
    );
    const result = await runAgents(ctx);
    expect(ctx.verify).toHaveBeenCalledTimes(2);
    expect(result.code?.files.find((f) => f.path === "src/main.tsx")?.content).not.toContain("unsafe entry");
    expect(result.code?.files.find((f) => f.path === "package.json")?.content).not.toContain("unsafe package");
    expect(ctx.store.evaluation).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({
        ignoredChanges: expect.arrayContaining(["debugger: تغییر غیرمجاز package.json اعمال نشد."]),
      }),
      true,
    );
  });
  it("uses role-specific provider configuration without accepting unknown providers", () => {
    vi.stubEnv("AGENT_DESIGNER_PROVIDER", "gemini");
    expect(roleProvider("designer", "openai")).toBe("gemini");
    vi.stubEnv("AGENT_DESIGNER_PROVIDER", "unknown");
    expect(() => roleProvider("designer", "openai")).toThrow("Invalid provider");
  });
});
