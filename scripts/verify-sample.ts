import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { appSpecSchema } from "../src/lib/spec";
import { renderProject } from "../src/lib/templates";
import { verifyInSandbox } from "../src/lib/agents/sandbox";

async function main() {
  const backend = process.argv.includes("--backend");
  const spec = appSpecSchema.parse({
    appName: "Sample",
    summary: "Sandbox verification sample",
    language: "fa",
    screens: [{ name: "خانه", purpose: "Sample" }],
    features: ["View sample"],
    needsBackend: backend,
  });
  const read = (name: string) => readFile(path.resolve("scripts/samples", name), "utf8");
  const aiFiles = [
    {
      path: "src/App.tsx",
      content: await read(backend ? "web-App.tsx" : "capacitor-App.tsx"),
    },
  ];
  if (backend)
    aiFiles.push(
      { path: "server/app.ts", content: await read("server-app.ts") },
      { path: "db/schema.sql", content: await read("schema.sql") },
    );
  const { files } = renderProject({
    template: "web",
    slug: "sample",
    spec,
    aiFiles,
    requestedLibraries: [],
  });
  const result = await verifyInSandbox(
    files,
    "web",
    backend,
    new AbortController().signal,
    backend
      ? [
          {
            name: "ثبت و نمایش پیام",
            steps: [
              { action: "fill", label: "نام", value: "آزمایش" },
              { action: "fill", label: "پیام", value: "پیام آزمایشی تیم" },
              { action: "click", role: "button", name: "ارسال" },
              { action: "expectText", text: "پیام آزمایشی تیم" },
            ],
          },
        ]
      : [
          {
            name: "ثبت و نمایش کار",
            steps: [
              { action: "fill", label: "کار جدید", value: "کار آزمایشی تیم" },
              { action: "click", role: "button", name: "افزودن" },
              { action: "expectText", text: "کار آزمایشی تیم" },
            ],
          },
        ],
  );
  for (const screenshot of result.screenshots) {
    await mkdir("out/agent-review", { recursive: true });
    await writeFile(`out/agent-review/${screenshot.name}.png`, Buffer.from(screenshot.data, "base64"));
  }
  console.log(
    JSON.stringify(
      {
        ...result,
        screenshots: result.screenshots.map((s) => ({ name: s.name })),
      },
      null,
      2,
    ),
  );
  if (result.status !== "passed") process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
