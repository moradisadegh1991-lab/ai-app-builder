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
  const locked = new Set(["package.json", "src/main.tsx"]);

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
      ],
      false,
      locked,
    );
    expect(result.files.map((f) => f.path)).toEqual(["src/App.tsx"]);
  });

  it("only accepts backend files when the app needs a backend", () => {
    const files = [app, { path: "api/items.ts", content: "" }, { path: "db/schema.sql", content: "" }];
    expect(sanitizeAiFiles("capacitor", files, false, locked).files).toHaveLength(1);
    expect(sanitizeAiFiles("capacitor", files, true, locked).files).toHaveLength(3);
    expect(
      sanitizeAiFiles("capacitor", [app, { path: "api/_lib/db.ts", content: "" }], true, locked).files,
    ).toHaveLength(1);
  });

  it("requires the entry file", () => {
    expect(() => sanitizeAiFiles("capacitor", [{ path: "src/other.tsx", content: "" }], false, locked)).toThrow();
    expect(() => sanitizeAiFiles("expo", [app], false, locked)).toThrow();
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
    expect(files.find((f) => f.path === "scripts/ci-build-android.sh")?.executable).toBe(true);

    const pkg = JSON.parse(files.find((f) => f.path === "package.json")!.content);
    expect(pkg.dependencies.recharts).toBeDefined();
    expect(pkg.dependencies["left-pad"]).toBeUndefined();
    expect(warnings.some((w) => w.includes("left-pad"))).toBe(true);

    const config = JSON.parse(files.find((f) => f.path === "capacitor.config.json")!.content);
    expect(config.appId).toBe("com.idea2app.expense_tracker");
  });

  it("adds Android permissions for device plugins", () => {
    const { files } = renderProject({
      template: "capacitor",
      slug: "camera-app",
      spec,
      aiFiles: [app],
      requestedLibraries: ["@capacitor/camera"],
    });
    expect(files.find((f) => f.path === "android-permissions.txt")?.content).toContain("android.permission.CAMERA");
  });

  it("adds backend helpers and the Neon driver when a backend is needed", () => {
    const { files } = renderProject({
      template: "capacitor",
      slug: "shared-app",
      spec: { ...spec, needsBackend: true },
      aiFiles: [app, { path: "api/items.ts", content: "export function GET() {}" }],
      requestedLibraries: [],
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("api/_lib/db.ts");
    expect(paths).toContain("api/items.ts");
    const pkg = JSON.parse(files.find((f) => f.path === "package.json")!.content);
    expect(pkg.dependencies["@neondatabase/serverless"]).toBeDefined();
  });

  it("renders an Expo project", () => {
    const { files } = renderProject({
      template: "expo",
      slug: "native-app",
      spec,
      aiFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      requestedLibraries: [],
    });
    const appJson = JSON.parse(files.find((f) => f.path === "app.json")!.content);
    expect(appJson.expo.android.package).toBe("com.idea2app.native_app");
    expect(files.find((f) => f.path === "scripts/ci-build-android.sh")!.content).toContain("expo prebuild");
  });
});
