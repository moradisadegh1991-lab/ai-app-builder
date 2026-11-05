import { describe, expect, it } from "vitest";
import {
  AUTOFIX_PREFERENCE_KEY,
  AUTOFIX_TRIGGERED_KEY,
  RECENT_FAILURE_MS,
  readAutoFixPreference,
  readTriggeredBuild,
  shouldAutoFix,
  writeAutoFixPreference,
  writeTriggeredBuild,
  type AutoFixInput,
  type StorageLike,
} from "../src/components/workspace/autofix";

const NOW = Date.UTC(2026, 9, 31, 12, 0, 0);
const failedBuild = (ageMs = 60_000, id = "b1") => ({ id, conclusion: "failure", createdAt: new Date(NOW - ageMs).toISOString() });

const base: AutoFixInput = {
  preference: "on",
  busy: false,
  projectStatus: "pushed",
  build: failedBuild(),
  used: 0,
  max: 2,
  alreadyTriggeredFor: null,
  now: NOW,
};
const decide = (patch: Partial<AutoFixInput> = {}) => shouldAutoFix({ ...base, ...patch });

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
};
const broken: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("shouldAutoFix: the saved preference decides", () => {
  it("never starts before the preference has been read", () => {
    expect(decide({ preference: "unloaded" })).toBe(false);
  });

  it("does not start when the user turned it off", () => {
    expect(decide({ preference: "off" })).toBe(false);
  });

  it("starts for a fresh failed build when it is on", () => {
    expect(decide()).toBe(true);
  });
});

describe("shouldAutoFix: guards", () => {
  it("respects the maximum number of automatic rounds", () => {
    expect(decide({ used: 1 })).toBe(true);
    expect(decide({ used: 2 })).toBe(false);
    expect(decide({ used: 5 })).toBe(false);
  });

  it("does not repeat for a build it already tried to repair", () => {
    expect(decide({ alreadyTriggeredFor: "b1" })).toBe(false);
    expect(decide({ alreadyTriggeredFor: "older-build" })).toBe(true);
  });

  it("ignores old failures, successes, running builds and missing builds", () => {
    expect(decide({ build: failedBuild(RECENT_FAILURE_MS + 1) })).toBe(false);
    expect(decide({ build: failedBuild(RECENT_FAILURE_MS) })).toBe(true);
    expect(decide({ build: { ...failedBuild(), conclusion: "success" } })).toBe(false);
    expect(decide({ build: { ...failedBuild(), conclusion: null } })).toBe(false);
    expect(decide({ build: null })).toBe(false);
    expect(decide({ build: { ...failedBuild(), createdAt: "not a date" } })).toBe(false);
  });

  it("waits while an operation runs here or on the server", () => {
    expect(decide({ busy: true })).toBe(false);
    expect(decide({ projectStatus: "generating" })).toBe(false);
  });
});

describe("preference storage", () => {
  it("keeps the default (on) for users without a saved choice", () => {
    expect(readAutoFixPreference(memory())).toBe("on");
  });

  it("reads and writes the saved choice", () => {
    const storage = memory();
    expect(writeAutoFixPreference(storage, "off")).toBe(true);
    expect(storage.data[AUTOFIX_PREFERENCE_KEY]).toBe("off");
    expect(readAutoFixPreference(storage)).toBe("off");
    writeAutoFixPreference(storage, "on");
    expect(readAutoFixPreference(storage)).toBe("on");
  });

  it("treats unknown stored values as the default", () => {
    expect(readAutoFixPreference(memory({ [AUTOFIX_PREFERENCE_KEY]: "garbage" }))).toBe("on");
  });

  it("survives unavailable or throwing storage", () => {
    expect(readAutoFixPreference(null)).toBe("on");
    expect(readAutoFixPreference(broken)).toBe("on");
    expect(writeAutoFixPreference(null, "off")).toBe(false);
    expect(writeAutoFixPreference(broken, "off")).toBe(false);
  });

  it("remembers the build a repair was started for, also across a reload", () => {
    const session = memory();
    expect(readTriggeredBuild(session)).toBeNull();
    writeTriggeredBuild(session, "b7");
    expect(session.data[AUTOFIX_TRIGGERED_KEY]).toBe("b7");
    expect(readTriggeredBuild(session)).toBe("b7");
    expect(() => writeTriggeredBuild(broken, "b7")).not.toThrow();
    expect(readTriggeredBuild(broken)).toBeNull();
  });

  it("an off choice stays off and a stored build id blocks the same build after a refresh", () => {
    const local = memory({ [AUTOFIX_PREFERENCE_KEY]: "off" });
    const session = memory();
    // first visit: off -> no repair
    expect(decide({ preference: readAutoFixPreference(local) })).toBe(false);
    // user enables it, repair starts and is recorded
    writeAutoFixPreference(local, "on");
    expect(decide({ preference: readAutoFixPreference(local), alreadyTriggeredFor: readTriggeredBuild(session) })).toBe(true);
    writeTriggeredBuild(session, "b1");
    // refresh: still on, but the same failed build is not repaired again
    expect(decide({ preference: readAutoFixPreference(local), alreadyTriggeredFor: readTriggeredBuild(session) })).toBe(false);
  });
});
