// Renders a sample generated project (template + fixed sample App) to disk,
// without calling any AI. Used by the template smoke-test workflow to prove
// that every template really builds an APK in GitHub Actions.
//
// Usage: npx tsx scripts/render-sample-app.ts <capacitor|expo> <output-dir>
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appSpecSchema } from "../src/lib/spec";
import { renderProject } from "../src/lib/templates";

const [template, outDir] = process.argv.slice(2);
if ((template !== "capacitor" && template !== "expo") || !outDir) {
  console.error("Usage: tsx scripts/render-sample-app.ts <capacitor|expo> <output-dir>");
  process.exit(1);
}

const spec = appSpecSchema.parse({
  appName: "کارهای من",
  summary: "A minimal offline task list used to smoke-test the Android build pipeline.",
  language: "fa",
  screens: [{ name: "لیست کارها", purpose: "Add and complete tasks", elements: ["input", "list"] }],
  features: ["افزودن کار", "علامت‌گذاری انجام‌شده"],
});

const entryPath = template === "capacitor" ? "src/App.tsx" : "App.tsx";
const sample = readFileSync(path.join(__dirname, "samples", `${template}-App.tsx`), "utf8");

const { files, warnings } = renderProject({
  template,
  slug: "sample-tasks",
  spec,
  aiFiles: [{ path: entryPath, content: sample }],
  requestedLibraries: [],
});

for (const file of files) {
  const target = path.join(outDir, file.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, file.content);
  if (file.executable) chmodSync(target, 0o755);
}
console.log(`Rendered ${files.length} files to ${outDir}`);
if (warnings.length) console.warn(warnings.join("\n"));
