import { describe, expect, it } from "vitest";
import { ResponseGate, syncIntervalMs, syncKinds, vercelDeploymentActive } from "../src/components/workspace/sync";
import { deployInfo, nextAction, workspaceFacts, workspaceSections } from "../src/components/workspace/model";
import type { ProjectView } from "../src/lib/projects";

const code = { kind: "code", files: [{ path: "src/App.tsx", content: "" }] };
const repo = { owner: "o", name: "r", url: "https://github.com/o/r" };
const okBuild = { id: "b", status: "completed", conclusion: "success", createdAt: new Date().toISOString() };

const project = (patch: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Cafe",
    kind: "website",
    hosting: "vercel",
    vpsProvider: null,
    status: "pushed",
    spec: { needsBackend: true },
    specApprovedAt: "x",
    generation: code,
    build: okBuild,
    deployment: null,
    vps: null,
    repo,
    ...patch,
  }) as unknown as ProjectView;

const vercel = (status: string, extra: Record<string, unknown> = {}) => project({ deployment: { status, url: null, error: null, hasDatabase: false, ...extra } });
const vps = (status: string, extra: Record<string, unknown> = {}) => project({ hosting: "vps", vpsProvider: "own", vps: { status, registered: true, stale: false, url: null, ...extra } });

describe("what the page follows (one interval)", () => {
  it("polls Vercel while provisioning AND while deploying, not before or after", () => {
    expect(syncKinds(vercel("provisioning"))).toEqual(["cloud"]);
    expect(syncKinds(vercel("deploying"))).toEqual(["cloud"]);
    expect(syncKinds(vercel("ready"))).toEqual([]);
    expect(syncKinds(vercel("failed"))).toEqual([]);
    expect(syncKinds(project())).toEqual([]);
  });

  it("does not poll the cloud endpoint for non-Vercel projects", () => {
    expect(vercelDeploymentActive(project({ hosting: "vps", deployment: { status: "deploying" } }))).toBe(false);
    expect(syncKinds(project({ hosting: "none", deployment: { status: "deploying" } }))).toEqual([]);
  });

  it("follows a running build, and both build and deployment together", () => {
    const running = { ...okBuild, status: "in_progress", conclusion: null };
    expect(syncKinds(project({ build: running }))).toEqual(["build"]);
    expect(syncKinds(project({ build: running, deployment: { status: "deploying" } }))).toEqual(["build", "cloud"]);
    expect(syncKinds(project({ build: { ...okBuild, status: "queued", conclusion: null } }))).toEqual(["build"]);
  });

  it("follows a VPS install through its project view until it is online or failed", () => {
    expect(syncKinds(vps("pending"))).toEqual(["project"]);
    expect(syncKinds(vps("deploying"))).toEqual(["project"]);
    expect(syncKinds(vps("online"))).toEqual([]);
    expect(syncKinds(vps("error"))).toEqual([]);
  });

  it("uses the faster interval whenever a deployment is followed", () => {
    expect(syncIntervalMs(["cloud"])).toBe(8_000);
    expect(syncIntervalMs(["build", "cloud"])).toBe(8_000);
    expect(syncIntervalMs(["build"])).toBe(10_000);
  });
});

describe("ResponseGate: stale poll responses never overwrite newer state", () => {
  it("accepts a poll that started and finished with nothing else going on", () => {
    const gate = new ResponseGate();
    const token = gate.startPoll()!;
    expect(gate.accept(token)).toBe(true);
  });

  it("drops a poll response that arrives after an operation finished", () => {
    const gate = new ResponseGate();
    const token = gate.startPoll()!; // poll starts with the old state...
    gate.beginOperation(); // ...the user starts provisioning...
    gate.endOperation(); // ...whose response already carries the newer project
    expect(gate.accept(token)).toBe(false); // the older poll must not win
  });

  it("drops a poll response that arrives while an operation is still running", () => {
    const gate = new ResponseGate();
    const token = gate.startPoll()!;
    gate.beginOperation();
    expect(gate.accept(token)).toBe(false);
  });

  it("pauses polling while an operation runs and resumes afterwards", () => {
    const gate = new ResponseGate();
    gate.beginOperation();
    expect(gate.startPoll()).toBeNull();
    gate.beginOperation(); // two operations at once
    gate.endOperation();
    expect(gate.startPoll()).toBeNull();
    gate.endOperation();
    const token = gate.startPoll();
    expect(token).not.toBeNull();
    expect(gate.accept(token!)).toBe(true);
  });

  it("ignores an unmatched endOperation", () => {
    const gate = new ResponseGate();
    gate.endOperation();
    expect(gate.startPoll()).not.toBeNull();
  });
});

describe("deployment lifecycle (Vercel)", () => {
  it("tells provisioning and deploying apart, with different descriptions", () => {
    const provisioning = deployInfo(vercel("provisioning"));
    const deploying = deployInfo(vercel("deploying"));
    expect(provisioning.phase).toBe("provisioning");
    expect(deploying.phase).toBe("deploying");
    expect(provisioning.label).not.toBe(deploying.label);
    expect(provisioning.description).not.toBe(deploying.description);
    expect(provisioning.description).toContain("Neon");
    expect(deployInfo({ ...vercel("provisioning"), spec: { needsBackend: false } } as unknown as ProjectView).description).not.toContain("Neon");
  });

  it("shows the navigation hint and next action of the real phase", () => {
    for (const [status, hint, title] of [
      ["provisioning", "در حال آماده‌سازی", "آماده‌سازی زیرساخت در حال انجام است"],
      ["deploying", "در حال استقرار", "استقرار در حال انجام است"],
    ] as const) {
      const p = vercel(status);
      expect(workspaceSections(p, false).find((s) => s.id === "deploy")).toMatchObject({ state: "running", hint });
      expect(nextAction(p, true)).toMatchObject({ title, section: "deploy", running: true });
    }
  });

  it("never exposes a live URL before the deployment is ready", () => {
    for (const status of ["provisioning", "deploying", "failed"]) {
      expect(workspaceFacts(vercel(status, { url: "https://cafe.vercel.app" })).previewUrl).toBeNull();
    }
    expect(workspaceFacts(vercel("ready", { url: "https://cafe.vercel.app" })).previewUrl).toBe("https://cafe.vercel.app");
  });

  it("does not call a ready deployment without a usable address a live site", () => {
    const p = vercel("ready", { url: null });
    expect(workspaceFacts(p).previewUrl).toBeNull();
    expect(nextAction(p, true).title).toBe("استقرار تمام شد");
    expect(nextAction(vercel("ready", { url: "javascript:alert(1)" }), true).title).toBe("استقرار تمام شد");
  });

  it("shows failure clearly and gives Vercel-specific advice (no auto-repair promised)", () => {
    const p = vercel("failed", { error: "403" });
    expect(deployInfo(p).phase).toBe("failed");
    expect(workspaceSections(p, false).find((s) => s.id === "deploy")!.state).toBe("error");
    const action = nextAction(p, true);
    expect(action.title).toBe("بررسی خطای استقرار");
    expect(action.description).not.toContain("اصلاح خودکار");
    expect(action.description).toContain("دوباره تلاش کنید");
  });

  it("suggests starting a deployment only when none exists", () => {
    expect(nextAction(project(), true).title).toBe("انتشار سایت");
    expect(deployInfo(project()).phase).toBe("idle");
  });
});

describe("deployment lifecycle (VPS) stays separate from Vercel", () => {
  it("has its own phases", () => {
    expect(deployInfo(project({ hosting: "vps", vps: null })).phase).toBe("idle");
    expect(deployInfo(vps("pending", { registered: false })).phase).toBe("waiting");
    expect(deployInfo(vps("deploying")).phase).toBe("deploying");
    expect(deployInfo(vps("online", { url: "https://x.sslip.io" })).phase).toBe("ready");
    expect(deployInfo(vps("error")).phase).toBe("failed");
  });

  it("ignores a stray Vercel deployment row on a VPS project", () => {
    const p = project({ hosting: "vps", vps: null, deployment: { status: "provisioning" } });
    expect(deployInfo(p).phase).toBe("idle");
    expect(workspaceFacts(p).deployRunning).toBe(false);
  });

  it("waits for the installer and offers the auto-repair only for VPS failures", () => {
    expect(nextAction(vps("pending", { registered: false }), true).title).toBe("نصب ایجنت روی سرور");
    expect(nextAction(vps("error"), true).description).toContain("اصلاح خودکار");
  });

  it("does not announce a healthy, published site when the agent stopped reporting", () => {
    const stale = vps("online", { url: "https://x.sslip.io", stale: true });
    const info = deployInfo(stale);
    expect(info).toMatchObject({ phase: "ready", attention: true, label: "فعال، بدون گزارش اخیر" });
    expect(nextAction(stale, true)).toMatchObject({ title: "بررسی وضعیت سرور", section: "deploy" });
    expect(nextAction(vps("online", { url: "https://x.sslip.io" }), true).title).toBe("سایت منتشر شده است");
  });

  it("offers a preview only when the agent is online with a safe URL", () => {
    expect(workspaceFacts(vps("deploying", { url: "https://x.sslip.io" })).previewUrl).toBeNull();
    expect(workspaceFacts(vps("online", { url: "https://x.sslip.io" })).previewUrl).toBe("https://x.sslip.io");
  });
});

describe("apps on the device", () => {
  it("are ready once the APK build succeeded", () => {
    expect(deployInfo(project({ kind: "app", hosting: "none" })).phase).toBe("ready");
    expect(deployInfo(project({ kind: "app", hosting: "none", build: null })).phase).toBe("idle");
  });
});
