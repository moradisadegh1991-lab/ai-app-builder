import type { AppSpec } from "../spec";
import { PERSIAN_HELPERS_PATH, PERSIAN_HELPERS_SOURCE } from "./persian";
import type { GeneratedFile } from "./types";

export interface TemplateContext {
  slug: string;
  packageId: string;
  spec: AppSpec;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  androidPermissions: string[];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * React + Vite + Tailwind web app files shared by the Capacitor (Android) and
 * website templates. `apiRequired` is true for Capacitor, where the backend
 * always lives on another origin; a website calls its own /api.
 */
export function viteAppFiles(
  ctx: TemplateContext,
  extra: { dependencies: Record<string, string>; devDependencies: Record<string, string>; apiRequired: boolean },
): GeneratedFile[] {
  const { spec } = ctx;
  const rtl = spec.language === "fa";
  return [
    {
      path: "package.json",
      content:
        JSON.stringify(
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
              ...ctx.scripts,
            },
            dependencies: {
              ...extra.dependencies,
              react: "^19.3.0",
              "react-dom": "^19.3.0",
              // Bundled with the app: works offline in the APK and where Google Fonts is blocked.
              ...(rtl ? { "@fontsource-variable/vazirmatn": "^5.3.0" } : {}),
              ...ctx.dependencies,
            },
            devDependencies: {
              ...extra.devDependencies,
              "@tailwindcss/vite": "^4.3.0",
              "@types/node": "^22.20.0",
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
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // During development, forward /api to the local backend (npm run server).
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
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
    <meta name="description" content="${escapeHtml(spec.summary.slice(0, 160))}" />
    <title>${escapeHtml(spec.appName)}</title>
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
${rtl ? 'import "@fontsource-variable/vazirmatn";\n' : ""}import App from "./App";
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
  --font-sans: ${rtl ? '"Vazirmatn Variable", ' : ""}ui-sans-serif, system-ui, sans-serif;
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
    { path: PERSIAN_HELPERS_PATH, content: PERSIAN_HELPERS_SOURCE },
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
      content: `// Base URL of the backend. ${
        extra.apiRequired
          ? "The Android app always talks to a remote server, set at build time (API_URL)."
          : "A website calls its own /api, so an empty value means same origin."
      }
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "").replace(/\\/+$/, "");
export const API_AVAILABLE = ${extra.apiRequired ? "API_URL !== \"\"" : "true"};

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
  ];
}
