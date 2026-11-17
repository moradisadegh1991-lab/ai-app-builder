import { describe, expect, it } from "vitest";
import { buildObservation } from "../src/lib/billing/build-observation";

describe("GitHub build observation", () => {
  it("records completed run timestamps and an elapsed observation without pricing it", () => {
    const result = buildObservation({ status: "completed", run_started_at: "2026-11-17T10:00:00Z", updated_at: "2026-11-17T10:02:30Z", run_attempt: 2 });
    expect(result).toMatchObject({ runAttempt: 2, reportedElapsedSeconds: 150 });
    expect(result).not.toHaveProperty("costToman");
  });
  it("does not invent elapsed time for running, missing, or inverted timestamps", () => {
    expect(buildObservation({ status: "in_progress", run_started_at: "2026-11-17T10:00:00Z", updated_at: "2026-11-17T10:02:00Z" }).reportedElapsedSeconds).toBeNull();
    expect(buildObservation({ status: "completed", run_started_at: "bad", updated_at: "2026-11-17T10:02:00Z", run_attempt: -1 })).toMatchObject({ runStartedAt: null, runAttempt: null, reportedElapsedSeconds: null });
    expect(buildObservation({ status: "completed", run_started_at: "2026-11-17T10:02:00Z", updated_at: "2026-11-17T10:00:00Z" }).reportedElapsedSeconds).toBeNull();
  });
});
