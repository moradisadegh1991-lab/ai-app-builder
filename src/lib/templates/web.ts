import { BUILD_SCRIPT_PATH } from "./common";
import type { GeneratedFile } from "./types";
import { viteAppFiles, type TemplateContext } from "./vite";

const BUILD_SCRIPT = `#!/usr/bin/env bash
# Builds the website into dist/. Used by GitHub Actions to check every commit.
set -euo pipefail

npm install --no-audit --no-fund
npm run build
ls -lh dist
`;

export function webFiles(ctx: TemplateContext): GeneratedFile[] {
  return [
    ...viteAppFiles(ctx, { dependencies: {}, devDependencies: {}, apiRequired: false }),
    { path: BUILD_SCRIPT_PATH, content: BUILD_SCRIPT, executable: true },
  ];
}
