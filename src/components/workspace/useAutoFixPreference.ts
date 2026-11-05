"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  AUTOFIX_PREFERENCE_KEY,
  readAutoFixPreference,
  safeStorage,
  writeAutoFixPreference,
  type AutoFixPreference,
} from "./autofix";

// The saved choice lives in localStorage, which the server cannot read. useSyncExternalStore gives
// the server render and the hydration render the "unloaded" value, then re-renders with the real
// one: no hydration mismatch, and nothing can act on the preference before it has been read.

const listeners = new Set<() => void>();
/** Used when the choice cannot be saved (storage blocked): it still applies for this page visit. */
let memoryChoice: "on" | "off" | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTOFIX_PREFERENCE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): AutoFixPreference {
  return memoryChoice ?? readAutoFixPreference(safeStorage("local"));
}

const getServerSnapshot = (): AutoFixPreference => "unloaded";

export function useAutoFixPreference() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPreference = useCallback((value: "on" | "off") => {
    memoryChoice = writeAutoFixPreference(safeStorage("local"), value) ? null : value;
    listeners.forEach((listener) => listener());
  }, []);

  return { preference, loaded: preference !== "unloaded", setPreference };
}
