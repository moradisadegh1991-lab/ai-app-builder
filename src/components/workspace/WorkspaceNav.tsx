"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import type { SectionId, WorkspaceSection } from "./model";
import { StepMarker } from "./parts";

/** Section navigation: a vertical list on large screens, a scrollable tab bar on small ones. */
export function WorkspaceNav({
  sections,
  active,
  onSelect,
  variant,
}: {
  sections: WorkspaceSection[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  variant: "sidebar" | "tabs";
}) {
  const tabs = useRef<HTMLDivElement>(null);

  // Keep the selected tab visible in the scrollable bar.
  useEffect(() => {
    tabs.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (variant === "sidebar") {
    return (
      <nav aria-label="بخش‌های پروژه">
        <ul className="flex flex-col gap-1">
          {sections.map((section, index) => {
            const selected = section.id === active;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition ${
                    selected ? "bg-surface shadow-xs ring-1 ring-line" : "hover:bg-surface-3"
                  }`}
                >
                  {section.id === "overview" || section.id === "preview" ? (
                    <span className={`grid size-6 place-items-center ${selected ? "text-primary" : "text-muted"}`}>
                      <Icon name={section.icon} size={17} />
                    </span>
                  ) : (
                    <StepMarker state={section.state} number={index} />
                  )}
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${selected ? "text-fg" : "text-fg-2"}`}>{section.label}</span>
                    <span className="block truncate text-xs text-muted">{section.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
      <nav aria-label="بخش‌های پروژه" className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:hidden">
        <div ref={tabs} className="segmented min-w-max">
          {sections.map((section) => (
            <button key={section.id} type="button" aria-selected={section.id === active} onClick={() => onSelect(section.id)}>
              <Icon
                name={section.state === "done" && section.id !== "overview" && section.id !== "preview" ? "check" : section.icon}
                size={15}
                className={section.state === "error" ? "text-danger" : section.state === "done" ? "text-success" : ""}
              />
              {section.label}
            </button>
          ))}
        </div>
      </nav>
  );
}
