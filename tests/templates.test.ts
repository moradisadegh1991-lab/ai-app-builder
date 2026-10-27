import { describe, expect, it } from "vitest";
import { appSpecSchema } from "@/lib/spec";
import { renderProject, sanitizeAiFiles, slugify } from "@/lib/templates";
import { androidPackageId } from "@/lib/templates/common";

const spec = appSpecSchema.parse({
  appName: "Expense Tracker",
  summary: "Track expenses.",
  language: "en",
  screens: [{ name: "Home", purpose: "Overview" }],
  features: ["Add expense"],
});

const app = { path: "src/App.tsx", content: "export default function App() { return null; }" };
const server = { path: "server/app.ts", content: "export const app = null;" };

function file(files: { path: string; content: string; executable?: boolean }[], path: string) {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`missing ${path}`);
  return found;
}

describe("slugify / package id", () => {
  it("creates safe slugs", () => {
    expect(slugify("My Cool App!")).toBe("my-cool-app");
    expect(slugify("اپ فارسی")).toBe("app");
    expect(slugify("---")).toBe("app");
  });

  it("creates valid Android package ids", () => {
    expect(androidPackageId("expense-tracker-ab12c")).toBe("com.idea2app.expense_tracker_ab12c");
    expect(androidPackageId("123-app")).toMatch(/^com\.idea2app\.[a-z][a-z0-9_]*$/);
  });
});

describe("sanitizeAiFiles", () => {
  const locked = new Set(["package.json", "src/main.tsx", "server/base.ts"]);

  it("rejects path traversal and absolute paths", () => {
    const result = sanitizeAiFiles(
      "capacitor",
      [app, { path: "../evil.ts", content: "" }, { path: "/etc/passwd.ts", content: "" }, { path: "src/../x.ts", content: "" }],
      false,
      locked,
    );
    expect(result.files.map((f) => f.path)).toEqual(["src/App.tsx"]);
    expect(result.warnings).toHaveLength(3);
  });

  it("does not let the AI overwrite template or workflow files", () => {
    const result = sanitizeAiFiles(
      "capacitor",
      [
        app,
        { path: "package.json", content: "{}" },
        { path: "src/main.tsx", content: "" },
        { path: ".github/workflows/x.yml", content: "" },
        { path: "api/index.ts", content: "" },
      ],
      false,
      locked,
    );
    expect(result.files.map((f) => f.path)).toEqual(["src/App.tsx"]);
  });

  it("only accepts backend files when the product has a backend", () => {
    const files = [app, server, { path: "db/schema.sql", content: "" }];
    expect(sanitizeAiFiles("web", [app, { path: "db/schema.sql", content: "" }], false, locked).files).toHaveLength(1);
    expect(sanitizeAiFiles("web", files, true, locked).files).toHaveLength(3);
    expect(sanitizeAiFiles("web", [...files, { path: "server/base.ts", content: "" }], true, locked).files).toHaveLength(3);
  });

  it("requires the entry files", () => {
    expect(() => sanitizeAiFiles("capacitor", [{ path: "src/other.tsx", content: "" }], false, locked)).toThrow();
    expect(() => sanitizeAiFiles("expo", [app], false, locked)).toThrow();
    expect(() => sanitizeAiFiles("web", [app], true, locked)).toThrow(/server\/app\.ts/);
  });
});

describe("renderProject", () => {
  it("renders a buildable Capacitor project with the APK workflow", () => {
    const { files, warnings } = renderProject({
      template: "capacitor",
      slug: "expense-tracker",
      spec,
      aiFiles: [app],
      requestedLibraries: ["recharts", "left-pad"],
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".github/workflows/build-android.yml");
    expect(paths).toContain("capacitor.config.json");
    expect(file(files, "scripts/ci-build.sh").executable).toBe(true);

    const pkg = JSON.parse(file(files, "package.json").content);
    expect(pkg.dependencies.recharts).toBeDefined();
    expect(pkg.dependencies["left-pad"]).toBeUndefined();
    expect(warnings.some((w) => w.includes("left-pad"))).toBe(true);
    expect(JSON.parse(file(files, "capacitor.config.json").content).appId).toBe("com.idea2app.expense_tracker");
    expect(JSON.parse(file(files, "idea2app.json").content)).toMatchObject({ web: true, backend: false });
  });

  it("adds Android permissions for device plugins", () => {
    const { files } = renderProject({
      template: "capacitor",
      slug: "camera-app",
      spec,
      aiFiles: [app],
      requestedLibraries: ["@capacitor/camera"],
    });
    expect(file(files, "android-permissions.txt").content).toContain("android.permission.CAMERA");
  });

  it("adds the shared Hono + PostgreSQL backend when needed", () => {
    const { files } = renderProject({
      template: "capacitor",
      slug: "shared-app",
      spec: { ...spec, needsBackend: true },
      aiFiles: [app, server, { path: "db/schema.sql", content: "CREATE TABLE IF NOT EXISTS t (id int);" }],
      requestedLibraries: [],
    });
    const paths = files.map((f) => f.path);
    for (const path of ["server/base.ts", "server/db.ts", "server/node.ts", "api/index.ts", "vercel.json", "server/app.ts"]) {
      expect(paths).toContain(path);
    }
    const pkg = JSON.parse(file(files, "package.json").content);
    expect(pkg.dependencies).toMatchObject({ hono: expect.any(String), postgres: expect.any(String), tsx: expect.any(String) });
    expect(pkg.scripts.server).toBe("tsx server/node.ts");
    expect(JSON.parse(file(files, "idea2app.json").content)).toMatchObject({ backend: true, schema: "db/schema.sql" });
  });

  it("renders a website with a build-only workflow", () => {
    const { files } = renderProject({ template: "web", slug: "cafe-site", spec, aiFiles: [app], requestedLibraries: [] });
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".github/workflows/build-web.yml");
    expect(paths).not.toContain(".github/workflows/build-android.yml");
    expect(paths).not.toContain("capacitor.config.json");
    const pkg = JSON.parse(file(files, "package.json").content);
    expect(pkg.dependencies["@capacitor/core"]).toBeUndefined();
    // A website calls its own /api, so the client does not require API_URL.
    expect(file(files, "src/lib/api.ts").content).toContain("API_AVAILABLE = true");
  });

  it("renders an Expo project", () => {
    const { files } = renderProject({
      template: "expo",
      slug: "native-app",
      spec,
      aiFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      requestedLibraries: [],
    });
    expect(JSON.parse(file(files, "app.json").content).expo.android.package).toBe("com.idea2app.native_app");
    expect(file(files, "scripts/ci-build.sh").content).toContain("expo prebuild");
    expect(JSON.parse(file(files, "idea2app.json").content)).toMatchObject({ web: false });
  });
});
