"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { Icon } from "./ui/Icon";

const OPTIONS: { value: ThemePreference; label: string; icon: "sun" | "moon" | "monitor" }[] = [
  { value: "light", label: "روشن", icon: "sun" },
  { value: "dark", label: "تیره", icon: "moon" },
  { value: "system", label: "مطابق سیستم", icon: "monitor" },
];

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  const value = document.documentElement.getAttribute("data-theme-pref");
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolve(preference: ThemePreference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  const theme = resolve(preference);
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-pref", preference);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
  listeners.forEach((listener) => listener());
}

/** Light / dark / system switch. The inline head script already applied the stored choice. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  // The server cannot know the preference; React re-renders with the DOM value after hydration.
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);

  // While "system" is selected, follow the operating system live.
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <div role="group" aria-label="پوسته" className="segmented">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          title={option.label}
          onClick={() => apply(option.value)}
          className={compact ? "!px-2.5" : ""}
        >
          <Icon name={option.icon} size={16} />
          <span className={compact ? "sr-only" : "hidden lg:inline"}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
