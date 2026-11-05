import { describe, expect, it } from "vitest";
import { currentSection, nextAction, workspaceFacts, workspaceSections } from "../src/components/workspace/model";
import type { ProjectView } from "../src/lib/projects";

const base = {
  id: "p1",
  name: "Cafe",
  kind: "website",
  hosting: "vercel",
  vpsProvider: null,
  status: "draft",
  spec: null,
  specApprovedAt: null,
  generation: null,
  build: null,
  deployment: null,
  vps: null,
  repo: null,
} as unknown as ProjectView;

const view = (patch: Record<string, unknown>) => ({ ...base, ...patch }) as unknown as ProjectView;
const code = { kind: "code", files: [{ path: "src/App.tsx", content: "" }] };
const build = (conclusion: string | null, status = "completed") => ({ id: "b", status, conclusion, createdAt: new Date().toISOString() });

describe("workspace model", () => {
  it("starts at the requirements and suggests analysing the idea", () => {
    expect(currentSection(base)).toBe("requirements");
    expect(nextAction(base, true).section).toBe("requirements");
    const sections = workspaceSections(base, false);
    expect(sections.find((s) => s.id === "code")!.state).toBe("locked");
    expect(sections.some((s) => s.id === "preview")).toBe(false);
  });

  it("moves to code after approval and to build once code exists", () => {
    expect(currentSection(view({ spec: {}, specApprovedAt: "x" }))).toBe("code");
    expect(currentSection(view({ spec: {}, specApprovedAt: "x", generation: code, status: "generated" }))).toBe("build");
  });

  it("asks to connect GitHub before anything is pushed", () => {
    expect(nextAction(view({ spec: {}, specApprovedAt: "x", generation: code, status: "generated" }), false).title).toBe("اتصال GitHub");
  });

  it("flags a failed build as an error and suggests repair", () => {
    const failed = view({ spec: {}, specApprovedAt: "x", generation: code, status: "pushed", build: build("failure") });
    expect(workspaceSections(failed, false).find((s) => s.id === "build")!.state).toBe("error");
    expect(nextAction(failed, true).title).toBe("اصلاح خطای Build");
  });

  it("shows a running build and the live preview only when the site is deployed", () => {
    const running = view({ spec: {}, specApprovedAt: "x", generation: code, status: "pushed", build: build(null, "in_progress") });
    expect(workspaceSections(running, false).find((s) => s.id === "build")!.state).toBe("running");

    const live = view({
      spec: {},
      specApprovedAt: "x",
      generation: code,
      status: "pushed",
      repo: { owner: "o", name: "r", url: "https://github.com/o/r" },
      build: build("success"),
      deployment: { status: "ready", url: "https://cafe.vercel.app" },
    });
    expect(workspaceFacts(live).previewUrl).toBe("https://cafe.vercel.app");
    expect(workspaceSections(live, false).some((s) => s.id === "preview")).toBe(true);
    expect(currentSection(live)).toBe("overview");
  });

  it("never offers a preview for unsafe URLs or for apps", () => {
    expect(workspaceFacts(view({ deployment: { status: "ready", url: "javascript:alert(1)" } })).previewUrl).toBeNull();
    expect(workspaceFacts(view({ kind: "app", deployment: { status: "ready", url: "https://x.app" } })).previewUrl).toBeNull();
  });

  it("uses the VPS agent status for VPS hosting", () => {
    const vps = view({ hosting: "vps", vpsProvider: "own", repo: { owner: "o", name: "r", url: "u" }, vps: { status: "error", registered: true } });
    expect(workspaceFacts(vps).deployFailed).toBe(true);
    expect(workspaceSections(vps, false).find((s) => s.id === "deploy")!.state).toBe("error");
  });
});
