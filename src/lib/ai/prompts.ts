import { z } from "zod";
import type { AppTemplate } from "../db/schema";
import type { AppSpec } from "../spec";
import { LIBRARY_DESCRIPTIONS } from "../templates/libraries";
import type { GeneratedFile } from "../templates/types";

export const codeOutputSchema = z.object({
  files: z
    .array(z.object({ path: z.string().min(1).max(200), content: z.string() }))
    .min(1)
    .max(60),
  libraries: z.array(z.string().max(80)).max(15).default([]),
  notes: z.string().max(2000).default(""),
});
export type CodeOutput = z.infer<typeof codeOutputSchema>;

// ---------------------------------------------------------------- spec

export const SPEC_SYSTEM = `You are a senior mobile product designer and software architect.
Turn the user's app idea into a concise, buildable requirements document for a FIRST VERSION (MVP) of an Android app.
Keep scope realistic for a single-codebase app generated in one pass: at most 8 screens.
Respond with ONE JSON object only, matching exactly this TypeScript type:
{
  "appName": string,               // short, in the user's language
  "summary": string,               // 2-4 sentences
  "language": "fa" | "en",         // UI language; "fa" if the idea is written in Persian
  "targetUsers": string,
  "screens": { "name": string, "purpose": string, "elements": string[] }[],
  "features": string[],
  "dataModel": { "entity": string, "fields": { "name": string, "type": string }[] }[],
  "needsBackend": boolean,         // true ONLY if data must be shared between users/devices or needs a server
  "backendReason": string,
  "devicePermissions": string[],   // Android permission constants such as "CAMERA"; empty if none
  "designNotes": string,
  "primaryColor": string           // hex like "#4f46e5"
}
Write all human-readable text in the app's UI language.`;

export function specPrompt(idea: string, feedback?: string, previous?: AppSpec): string {
  let prompt = `App idea:\n"""\n${idea}\n"""`;
  if (previous) prompt += `\n\nPrevious requirements (JSON):\n${JSON.stringify(previous)}`;
  if (feedback) prompt += `\n\nRevise the requirements according to this feedback from the user:\n"""\n${feedback}\n"""`;
  return prompt;
}

// ---------------------------------------------------------------- code

const CAPACITOR_RULES = `Stack: React 19 + TypeScript + Vite + Tailwind CSS v4, packaged as an Android app with Capacitor 8.
Template files that ALREADY EXIST (do not output them): package.json, vite.config.ts, index.html, src/main.tsx (renders <App /> from "./App"), src/index.css (imports Tailwind; theme color available as bg-primary / text-primary), src/lib/storage.ts (exports loadJSON<T>(key, fallback) and saveJSON(key, value) over localStorage), src/lib/api.ts (exports API_URL and apiFetch<T>(path, init)).
You MUST output src/App.tsx with a default export. Put other code under src/ (e.g. src/components/, src/screens/, src/types.ts).
Use Tailwind utility classes for styling. Mobile-first layout, touch-friendly (min 44px targets), bottom tab bar or simple in-app navigation.
If you use react-router-dom you MUST use HashRouter.
Use only relative imports (no "@/" alias).`;

const EXPO_RULES = `Stack: React Native 0.88 with Expo SDK 58 and TypeScript.
Template files that ALREADY EXIST (do not output them): package.json, app.json, index.ts (registers App from "./App"), src/lib/api.ts (exports API_URL and apiFetch<T>(path, init)), src/theme.ts (exports theme = { primary, rtl }).
You MUST output App.tsx at the repository root with a default export. Put other code under src/.
Use React Native core components and StyleSheet only (no web elements, no CSS files). Use expo-status-bar's <StatusBar />.
Implement navigation with simple component state (tabs/screens) — no navigation libraries.
For Persian UI use textAlign: "right" and writingDirection: "rtl" in styles.
Use only relative imports.`;

const BACKEND_RULES = `This app HAS a backend deployed on Vercel with a Neon PostgreSQL database:
- Output db/schema.sql with idempotent DDL (CREATE TABLE IF NOT EXISTS ...). It is executed once on the new database.
- Output Vercel Functions as api/<name>.ts using the Web standard signature, e.g.
    import { sql } from "./_lib/db"; import { json, error, preflight, readBody } from "./_lib/http";
    export function OPTIONS() { return preflight(); }
    export async function GET(request: Request) { const rows = await sql\`SELECT * FROM items\`; return json(rows); }
  sql is the @neondatabase/serverless tagged template (parameters are interpolated safely). api/_lib/* already exists.
- In the app, call the backend with apiFetch("/api/<name>") and handle API_URL being empty (show a friendly message).`;

const OFFLINE_RULES = `This app has NO backend: store all data on the device (localStorage helpers on Capacitor, AsyncStorage on Expo if listed in libraries, otherwise in-memory state).`;

export function codeSystemPrompt(template: AppTemplate, needsBackend: boolean): string {
  return `You are an expert mobile engineer. Generate the complete, working source code of an Android app from an approved requirements document.

${template === "capacitor" ? CAPACITOR_RULES : EXPO_RULES}

${needsBackend ? BACKEND_RULES : OFFLINE_RULES}

Optional npm libraries you may request (only these; leave the list empty if not needed):
- ${LIBRARY_DESCRIPTIONS[template]}

Quality bar:
- The code must compile with TypeScript strict mode and build without errors. Never import a package that is not part of the stack or requested in "libraries".
- Implement every screen and feature in the requirements with realistic sample/empty states; no TODO placeholders.
- No secrets, no analytics, no external network calls except the app's own backend.
- UI text in the requirements' language; right-to-left layout for Persian.

Respond with ONE JSON object only:
{ "files": [{ "path": string, "content": string }], "libraries": string[], "notes": string }`;
}

export function codePrompt(spec: AppSpec): string {
  return `Approved requirements (JSON):\n${JSON.stringify(spec, null, 2)}`;
}

// ---------------------------------------------------------------- fix

export function fixPrompt(spec: AppSpec, files: GeneratedFile[], buildLog: string, editablePaths: Set<string>): string {
  const sources = files
    .map((f) => `--- ${f.path}${editablePaths.has(f.path) ? "" : " (template, read-only)"}\n${f.content}`)
    .join("\n\n");
  return `The Android build of this app FAILED in GitHub Actions. Fix the source code so the build succeeds.
Only output files you change or add (full new content), and only files that are not marked read-only.
Keep "libraries" as the full list of optional libraries the fixed app needs.

Requirements (JSON):
${JSON.stringify(spec)}

Build log (last lines):
"""
${buildLog}
"""

Current repository files:
${sources}`;
}
