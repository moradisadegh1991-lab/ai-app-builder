import { BUILD_SCRIPT_PATH } from "./common";
import { escapeHtml, type TemplateContext } from "./vite";
import type { GeneratedFile } from "./types";

const BUILD_SCRIPT = `#!/usr/bin/env bash
# Builds a release APK (signed with the debug keystore) into dist-apk/app.apk.
set -euo pipefail

npm install --no-audit --no-fund
# Align native module versions with the installed Expo SDK.
npx expo install --fix
npx expo prebuild --platform android --no-install

cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon --stacktrace -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
cd ..

mkdir -p dist-apk
cp android/app/build/outputs/apk/release/app-release.apk dist-apk/app.apk
ls -lh dist-apk/app.apk
`;

export function expoFiles(ctx: TemplateContext, needsBackend: boolean): GeneratedFile[] {
  const { spec } = ctx;
  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content:
        JSON.stringify(
          {
            name: ctx.slug,
            version: "1.0.0",
            private: true,
            main: "index.ts",
            scripts: {
              start: "expo start",
              android: "expo run:android",
              typecheck: "tsc --noEmit",
              ...ctx.scripts,
            },
            dependencies: {
              expo: "~58.0.0",
              "expo-status-bar": "~58.0.4",
              react: "19.3.0",
              "react-native": "0.88.0",
              ...ctx.dependencies,
            },
            devDependencies: {
              "@types/react": "~19.3.0",
              typescript: "~5.9.3",
            },
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "app.json",
      content:
        JSON.stringify(
          {
            expo: {
              name: spec.appName,
              slug: ctx.slug,
              version: "1.0.0",
              orientation: "portrait",
              userInterfaceStyle: "automatic",
              android: {
                package: ctx.packageId,
                permissions: ctx.androidPermissions,
              },
            },
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "index.ts",
      content: `import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
`,
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify({ extends: "expo/tsconfig.base", compilerOptions: { strict: true } }, null, 2) + "\n",
    },
    {
      path: "src/lib/api.ts",
      content: `// Base URL of the Vercel backend (empty when the app has no backend).
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\\/+$/, "");
export const API_AVAILABLE = API_URL !== "";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_AVAILABLE) throw new Error("Backend is not configured for this build");
  const response = await fetch(\`\${API_URL}\${path}\`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);
  return (await response.json()) as T;
}
`,
    },
    {
      path: "src/theme.ts",
      content: `export const theme = {
  primary: "${spec.primaryColor}",
  rtl: ${spec.language === "fa"},
};
`,
    },
    { path: BUILD_SCRIPT_PATH, content: BUILD_SCRIPT, executable: true },
  ];

  if (needsBackend) {
    // Vercel serves the API from api/; this page is the static placeholder.
    files.push({
      path: "public/index.html",
      content: `<!doctype html><html><body><p>${escapeHtml(spec.appName)} API</p></body></html>\n`,
    });
  }
  return files;
}
