import type { AppTemplate } from "../db/schema";

/** Converts an app name to a safe repo / package slug (ASCII, kebab-case). */
export function slugify(input: string, fallback = "app"): string {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** Android application id, e.g. com.idea2app.expense_tracker */
export function androidPackageId(slug: string): string {
  const segment = slug.replace(/-/g, "_").replace(/^[^a-z]+/, "") || "app";
  return `com.idea2app.${segment}`;
}

export const BUILD_SCRIPT_PATH = "scripts/ci-build.sh";
export const MANIFEST_PATH = "idea2app.json";

export function workflowFile(template: AppTemplate): string {
  return template === "web" ? "build-web.yml" : "build-android.yml";
}

export function workflowPath(template: AppTemplate): string {
  return `.github/workflows/${workflowFile(template)}`;
}

/**
 * Read by the VPS deploy agent to know what to build and run.
 * web: build the site into dist/ and serve it. backend: run `npm run server`
 * (Hono API on 127.0.0.1:3000) with PostgreSQL and db/schema.sql.
 */
export function projectManifest(template: AppTemplate, needsBackend: boolean): string {
  return (
    JSON.stringify(
      {
        template,
        web: template !== "expo",
        webDir: "dist",
        backend: needsBackend,
        serverScript: "server",
        schema: "db/schema.sql",
      },
      null,
      2,
    ) + "\n"
  );
}

const WEB_WORKFLOW = `name: Build website

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: web-build-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Build website
        run: bash ${BUILD_SCRIPT_PATH}

      - name: Upload build
        uses: actions/upload-artifact@v4
        with:
          name: website-dist
          path: dist
          if-no-files-found: error
          retention-days: 7
`;

/**
 * GitHub Actions workflow committed to every generated repository. The build
 * logic itself lives in scripts/ci-build-android.sh so the platform's own
 * smoke test can run exactly the same steps.
 */
export function buildWorkflow(template: AppTemplate, slug: string): string {
  if (template === "web") return WEB_WORKFLOW;
  return `name: Build Android APK

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: android-build-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      # Set by Idea2App when a Vercel backend is connected (repository variable API_URL).
      VITE_API_URL: \${{ vars.API_URL }}
      EXPO_PUBLIC_API_URL: \${{ vars.API_URL }}
    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"

      - name: Build APK (${template})
        run: bash ${BUILD_SCRIPT_PATH}

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-apk
          path: dist-apk/app.apk
          if-no-files-found: error
          retention-days: 14

      - name: Publish APK as GitHub Release
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          APK="${slug}-build-\${{ github.run_number }}.apk"
          cp dist-apk/app.apk "$APK"
          gh release create "build-\${{ github.run_number }}" "$APK" \\
            --title "Build #\${{ github.run_number }}" \\
            --notes "Debug-signed APK built from \${{ github.sha }} by Idea2App AI." \\
            --target "\${{ github.sha }}"
`;
}

export const SHARED_GITIGNORE = `node_modules/
dist/
dist-apk/
android/
ios/
.expo/
*.apk
.env
.env.local
.vercel
`;
