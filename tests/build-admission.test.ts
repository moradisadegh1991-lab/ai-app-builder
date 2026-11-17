import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: vi.fn(), rows: vi.fn() }));
vi.mock("../src/lib/billing/subscription", () => ({ activePlan: mocks.active }));
vi.mock("../src/lib/workflows/sql", () => ({ queryRows: mocks.rows }));
import { admitBuild } from "../src/lib/billing/build-admission";
beforeEach(() => { vi.resetAllMocks(); mocks.active.mockResolvedValue({ plan: { id: "free" } }); mocks.rows.mockResolvedValue([{ allowed: true }]); });
afterEach(() => vi.unstubAllEnvs());
describe("mobile build policy", () => {
  it("preserves web and paid plan builds", async () => {
    await expect(admitBuild("user", "project", "web", "push")).resolves.toBeNull();
    mocks.active.mockResolvedValue({ plan: { id: "plus" } });
    await expect(admitBuild("user", "project", "capacitor", "push")).resolves.toBeNull();
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it("fails closed on missing configuration and reserves before a free build", async () => {
    vi.stubEnv("FREE_BUILDS_PER_30_DAYS", "");
    await expect(admitBuild("user", "project", "expo", "dispatch")).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("FREE_BUILDS_PER_30_DAYS", "2");
    await expect(admitBuild("user", "project", "expo", "dispatch")).resolves.toBeTypeOf("string");
    mocks.rows.mockResolvedValue([{ allowed: false }]);
    await expect(admitBuild("user", "project", "capacitor", "push")).rejects.toMatchObject({ status: 429 });
  });
});
