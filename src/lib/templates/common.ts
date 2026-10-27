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

export const WORKFLOW_PATH = ".github/workflows/build-android.yml";
export const WORKFLOW_FILE = "build-android.yml";
export const BUILD_SCRIPT_PATH = "scripts/ci-build-android.sh";

/**
 * GitHub Actions workflow committed to every generated repository. The build
 * logic itself lives in scripts/ci-build-android.sh so the platform's own
 * smoke test can run exactly the same steps.
 */
export function buildWorkflow(template: AppTemplate, slug: string): string {
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
