// Automatic build repair: preference storage and the decision of when the page may start a repair.
// Pure functions (storage is injected), so every rule below is unit tested without a browser.

export const AUTOFIX_PREFERENCE_KEY = "i2a_autofix";
/** sessionStorage: the last failed build the page already tried to repair (survives a reload). */
export const AUTOFIX_TRIGGERED_KEY = "i2a_autofix_build";
/** Only a failure that just happened is repaired automatically, not an old one found later. */
export const RECENT_FAILURE_MS = 60 * 60_000;

/** "unloaded" = the saved choice has not been read yet (server render, first client render). */
export type AutoFixPreference = "unloaded" | "on" | "off";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** localStorage can be missing or throw (blocked cookies, private mode, sandboxed frames). */
export function safeStorage(kind: "local" | "session"): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A user without a saved choice (or without usable storage) keeps the default: automatic repair on. */
export function readAutoFixPreference(storage: StorageLike | null): "on" | "off" {
  try {
    return storage?.getItem(AUTOFIX_PREFERENCE_KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

/** Returns false when the choice could not be saved (it then only lasts for this page visit). */
export function writeAutoFixPreference(storage: StorageLike | null, value: "on" | "off"): boolean {
  try {
    if (!storage) return false;
    storage.setItem(AUTOFIX_PREFERENCE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function readTriggeredBuild(storage: StorageLike | null): string | null {
  try {
    return storage?.getItem(AUTOFIX_TRIGGERED_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeTriggeredBuild(storage: StorageLike | null, buildId: string): void {
  try {
    storage?.setItem(AUTOFIX_TRIGGERED_KEY, buildId);
  } catch {
    // storage unavailable: the in-memory marker still prevents repeats during this visit
  }
}

export interface AutoFixInput {
  preference: AutoFixPreference;
  /** An operation started from this page is running. */
  busy: boolean;
  /** project.status: "generating" means a repair/edit/generation is already running on the server. */
  projectStatus: string;
  build: { id: string; conclusion: string | null; createdAt: string } | null;
  used: number;
  max: number;
  /** Build id a repair was already started for (memory marker or sessionStorage). */
  alreadyTriggeredFor: string | null;
  now: number;
}

/**
 * May the page start an automatic repair right now?
 * The saved preference must be loaded first; "unloaded" never starts anything.
 */
export function shouldAutoFix(input: AutoFixInput): boolean {
  if (input.preference !== "on") return false;
  if (input.busy || input.projectStatus === "generating") return false;
  const build = input.build;
  if (!build || build.conclusion !== "failure") return false;
  if (input.used >= input.max) return false;
  if (input.alreadyTriggeredFor === build.id) return false;
  const age = input.now - new Date(build.createdAt).getTime();
  return Number.isFinite(age) && age <= RECENT_FAILURE_MS;
}
