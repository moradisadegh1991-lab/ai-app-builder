import { chromium } from "playwright-core";

// This process runs in a DIFFERENT container from generated code. Page code cannot
// write its report, change its tests or access the Docker socket/platform secrets.
const journeys = JSON.parse(process.env.JOURNEYS ?? "[]");
const baseUrl = (process.env.SANDBOX_BASE_URL ?? "http://app:4173").replace(/\/$/, "");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", `--unsafely-treat-insecure-origin-as-secure=${baseUrl}`],
});
const checks = [];
const screenshots = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 960],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      return url.startsWith(`${baseUrl}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 500)));
    await page.goto(baseUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.locator("#root > *").first().waitFor();
    checks.push({
      name: `render-${name}`,
      status: "passed",
      detail: "App mounted in a real browser",
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    checks.push({
      name: `layout-${name}`,
      status: overflow ? "failed" : "passed",
      detail: overflow ? "Horizontal overflow" : "No horizontal overflow",
    });
    screenshots.push({
      name,
      mime: "image/png",
      data: (await page.screenshot({ fullPage: false, animations: "disabled" })).toString("base64"),
    });
    for (const journey of journeys) {
      try {
        await page.goto(baseUrl, { waitUntil: "networkidle" });
        for (const step of journey.steps) {
          if (step.action === "click") await page.getByRole(step.role, { name: step.name, exact: true }).click();
          else if (step.action === "fill") await page.getByLabel(step.label, { exact: true }).fill(step.value);
          else if (step.action === "expectText")
            await page.getByText(step.text, { exact: false }).first().waitFor({ state: "visible" });
        }
        checks.push({
          name: `${name}: ${journey.name}`,
          status: "passed",
          detail: "All journey steps passed",
        });
      } catch (e) {
        checks.push({
          name: `${name}: ${journey.name}`,
          status: "failed",
          detail: String(e).slice(0, 1000),
        });
      }
    }
    checks.push({
      name: `runtime-${name}`,
      status: errors.length ? "failed" : "passed",
      detail: errors.join("\n") || "No uncaught browser exceptions",
    });
    await context.close();
  }
} catch (e) {
  checks.push({
    name: "browser",
    status: "failed",
    detail: String(e).slice(0, 1500),
  });
} finally {
  await browser.close();
}
process.stdout.write(JSON.stringify({ checks, screenshots }));
