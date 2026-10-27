import { BUILD_SCRIPT_PATH } from "./common";
import type { GeneratedFile } from "./types";
import { viteAppFiles, type TemplateContext } from "./vite";

export type { TemplateContext } from "./vite";
export { escapeHtml } from "./vite";

const PERMISSIONS_BY_PLUGIN: Record<string, string[]> = {
  "@capacitor/camera": ["android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES"],
  "@capacitor/local-notifications": ["android.permission.POST_NOTIFICATIONS"],
};

export function capacitorPermissions(dependencies: Record<string, string>): string[] {
  return [...new Set(Object.keys(dependencies).flatMap((name) => PERMISSIONS_BY_PLUGIN[name] ?? []))];
}

const BUILD_SCRIPT = `#!/usr/bin/env bash
# Builds a debug-signed APK into dist-apk/app.apk. Used by GitHub Actions.
set -euo pipefail

npm install --no-audit --no-fund
npm run build

if [ ! -d android ]; then
  npx cap add android
fi
if [ -f android-permissions.txt ]; then
  node scripts/add-android-permissions.mjs
fi
npx cap sync android

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon --stacktrace
cd ..

mkdir -p dist-apk
cp android/app/build/outputs/apk/debug/app-debug.apk dist-apk/app.apk
ls -lh dist-apk/app.apk
`;

const ADD_PERMISSIONS_SCRIPT = `// Inserts <uses-permission> entries listed in android-permissions.txt into the
// generated AndroidManifest.xml (the android/ folder is created during CI).
import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const permissions = readFileSync("android-permissions.txt", "utf8")
  .split(/\\r?\\n/)
  .map((line) => line.trim())
  .filter((line) => /^[A-Za-z0-9_.]+$/.test(line));

let manifest = readFileSync(manifestPath, "utf8");
for (const permission of permissions) {
  if (manifest.includes(\`android:name="\${permission}"\`)) continue;
  manifest = manifest.replace(
    "</manifest>",
    \`    <uses-permission android:name="\${permission}" />\\n</manifest>\`,
  );
}
writeFileSync(manifestPath, manifest);
console.log("Android permissions:", permissions.join(", ") || "(none)");
`;

export function capacitorFiles(ctx: TemplateContext): GeneratedFile[] {
  const files: GeneratedFile[] = [
    ...viteAppFiles(ctx, {
      dependencies: { "@capacitor/android": "^8.5.0", "@capacitor/core": "^8.5.0" },
      devDependencies: { "@capacitor/cli": "^8.5.0" },
      apiRequired: true,
    }),
    {
      path: "capacitor.config.json",
      content:
        JSON.stringify({ appId: ctx.packageId, appName: ctx.spec.appName, webDir: "dist" }, null, 2) + "\n",
    },
    { path: BUILD_SCRIPT_PATH, content: BUILD_SCRIPT, executable: true },
    { path: "scripts/add-android-permissions.mjs", content: ADD_PERMISSIONS_SCRIPT },
  ];
  if (ctx.androidPermissions.length > 0) {
    files.push({ path: "android-permissions.txt", content: ctx.androidPermissions.join("\n") + "\n" });
  }
  return files;
}
