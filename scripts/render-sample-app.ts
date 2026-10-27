// Renders a sample generated project (template + fixed sample code) to disk,
// without calling any AI. Used by the template smoke-test workflow to prove
// that every template really builds (APK or website) and that the backend runs.
//
// Usage: npx tsx scripts/render-sample-app.ts <capacitor|expo|web> <output-dir> [--backend]
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appSpecSchema } from "../src/lib/spec";
import { renderProject } from "../src/lib/templates";

const args = process.argv.slice(2);
const backend = args.includes("--backend");
const [template, outDir] = args.filter((a) => !a.startsWith("--"));
if ((template !== "capacitor" && template !== "expo" && template !== "web") || !outDir) {
  console.error("Usage: tsx scripts/render-sample-app.ts <capacitor|expo|web> <output-dir> [--backend]");
  process.exit(1);
}

const spec = appSpecSchema.parse({
  appName: "کارهای من",
  summary: "A minimal sample used to smoke-test the build and deploy pipeline.",
  language: "fa",
  screens: [{ name: "صفحه اصلی", purpose: "Main screen", elements: ["input", "list"] }],
  features: ["افزودن مورد", "نمایش فهرست"],
  needsBackend: backend,
});

const samples = path.join(__dirname, "samples");
const read = (name: string) => readFileSync(path.join(samples, name), "utf8");
const entryPath = template === "expo" ? "App.tsx" : "src/App.tsx";
const aiFiles = [{ path: entryPath, content: read(`${template}-App.tsx`) }];
if (backend) {
  aiFiles.push({ path: "server/app.ts", content: read("server-app.ts") }, { path: "db/schema.sql", content: read("schema.sql") });
}

const { files, warnings } = renderProject({ template, slug: "sample-app", spec, aiFiles, requestedLibraries: [] });

for (const file of files) {
  const target = path.join(outDir, file.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, file.content);
  if (file.executable) chmodSync(target, 0o755);
}
console.log(`Rendered ${files.length} files to ${outDir}`);
if (warnings.length) console.warn(warnings.join("\n"));
