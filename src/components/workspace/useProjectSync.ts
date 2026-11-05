"use client";

import { useEffect, useRef } from "react";
import type { ProjectView } from "@/lib/projects";
import { api } from "../api";
import { SYNC_PATH, syncIntervalMs, syncKinds, type ResponseGate, type SyncKind } from "./sync";

/**
 * Follows builds, Vercel provisioning/deployment and VPS installs with ONE interval.
 * The interval exists only while something is active and is cleared on every terminal state
 * and on unmount. Ticks never overlap, and stale responses are dropped by the ResponseGate.
 */
export function useProjectSync(project: ProjectView, base: string, onProject: (project: ProjectView) => void, gate: ResponseGate) {
  const kinds = syncKinds(project);
  // A string key keeps the effect stable while the same work continues (project objects change on every poll).
  const key = kinds.join(",");
  const onProjectRef = useRef(onProject);
  onProjectRef.current = onProject;

  useEffect(() => {
    if (!key) return;
    const active = key.split(",") as SyncKind[];
    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (inFlight) return;
      inFlight = true;
      try {
        for (const kind of active) {
          const token = gate.startPoll();
          if (!token || cancelled) return;
          const data = await api<{ project: ProjectView }>(`${base}${SYNC_PATH[kind]}`).catch(() => null);
          if (!data || cancelled) continue;
          if (gate.accept(token)) onProjectRef.current(data.project);
        }
      } finally {
        inFlight = false;
      }
    }

    const timer = setInterval(tick, syncIntervalMs(active));
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, base, gate]);
}
