import type { AppSpec } from "../spec";
import { BUILD_SCRIPT_PATH } from "./common";
import type { GeneratedFile } from "./types";

export interface TemplateContext {
  slug: string;
  packageId: string;
  spec: AppSpec;
  dependencies: Record<string, string>;
  androidPermissions: string[];
}

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
  const { spec } = ctx;
  const rtl = spec.language === "fa";
  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: ctx.slug,
          private: true,
          version: "1.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            typecheck: "tsc --noEmit",
            preview: "vite preview",
          },
          dependencies: {
            "@capacitor/android": "^8.5.0",
            "@capacitor/core": "^8.5.0",
            react: "^19.3.0",
            "react-dom": "^19.3.0",
            ...ctx.dependencies,
          },
          devDependencies: {
            "@capacitor/cli": "^8.5.0",
            "@tailwindcss/vite": "^4.3.0",
            "@types/react": "^19.3.0",
            "@types/react-dom": "^19.3.0",
            "@vitejs/plugin-react": "^6.1.0",
            tailwindcss: "^4.3.0",
            typescript: "^5.9.3",
            vite: "^8.3.0",
          },
        },
        null,
        2,
      ) + "\n",
    },
    {
      path: "capacitor.config.json",
      content:
        JSON.stringify({ appId: ctx.packageId, appName: spec.appName, webDir: "dist" }, null, 2) + "\n",
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              lib: ["ES2022", "DOM", "DOM.Iterable"],
              module: "ESNext",
              moduleResolution: "bundler",
              jsx: "react-jsx",
              strict: true,
              skipLibCheck: true,
              noEmit: true,
              isolatedModules: true,
              resolveJsonModule: true,
            },
            include: ["src"],
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="${spec.language}" dir="${rtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${spec.primaryColor}" />
    <title>${escapeHtml(spec.appName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.tsx",
      content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    },
    {
      path: "src/index.css",
      content: `@import "tailwindcss";

@theme {
  --color-primary: ${spec.primaryColor};
  --font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  -webkit-tap-highlight-color: transparent;
}
`,
    },
    { path: "src/vite-env.d.ts", content: `/// <reference types="vite/client" />\n` },
    {
      path: "src/lib/storage.ts",
      content: `// Small typed wrapper around localStorage for offline-first data.
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
`,
    },
    {
      path: "src/lib/api.ts",
      content: `// Base URL of the Vercel backend (empty when the app has no backend).
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "").replace(/\\/+$/, "");

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error("Backend is not configured for this build");
  const response = await fetch(\`\${API_URL}\${path}\`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);
  return (await response.json()) as T;
}
`,
    },
    { path: BUILD_SCRIPT_PATH, content: BUILD_SCRIPT, executable: true },
    { path: "scripts/add-android-permissions.mjs", content: ADD_PERMISSIONS_SCRIPT },
  ];

  if (ctx.androidPermissions.length > 0) {
    files.push({ path: "android-permissions.txt", content: ctx.androidPermissions.join("\n") + "\n" });
  }
  return files;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
