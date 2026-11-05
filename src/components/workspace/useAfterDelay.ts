"use client";

import { useEffect, useState } from "react";

/**
 * true once `active` has been continuously true for `ms`. Measured on this page only (the server
 * does not expose when a phase started), so it describes what the user has been watching.
 */
export function useAfterDelay(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && elapsed;
}
