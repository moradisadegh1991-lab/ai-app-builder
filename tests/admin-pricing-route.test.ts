import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ user: vi.fn(), save: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireApiUser: h.user }));
vi.mock("@/lib/db", () => ({ db: () => ({ select: () => ({ from: h.list }) }), schema: { aiTariffs: {} } }));
vi.mock("@/lib/ai/admin-pricing", async () => {
  const { z } = await import("zod");
  const { HttpError } = await import("@/lib/http");
  return {
    requirePricingAdmin: (id: string) => { if (id !== "admin") throw new HttpError(403, "Forbidden"); },
    saveTariff: h.save,
    tariffInput: z.object({ model: z.string(), inputTomanPerMillion: z.number().positive(), outputTomanPerMillion: z.number().positive() }).strict(),
  };
});
import { GET, PUT } from "../src/app/api/admin/ai-pricing/route";
const body = { model: "google/gemini-2.5-pro", inputTomanPerMillion: 100, outputTomanPerMillion: 200 };
function request(origin: string, value: unknown = body) {
  return new Request("https://example.com/api/admin/ai-pricing", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) });
}
beforeEach(() => { vi.clearAllMocks(); h.user.mockResolvedValue({ id: "admin" }); h.list.mockResolvedValue([]); h.save.mockResolvedValue(body); });
describe("pricing API authorization", () => {
  it("rejects non-admin reads and writes without touching storage", async () => {
    h.user.mockResolvedValue({ id: "other" });
    expect((await GET()).status).toBe(403);
    expect((await PUT(request("https://example.com"))).status).toBe(403);
    expect(h.list).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and invalid requests before saving", async () => {
    expect((await PUT(request("https://evil.example"))).status).toBe(403);
    expect((await PUT(request("https://example.com", { ...body, inputTomanPerMillion: 0 }))).status).toBe(400);
    expect(h.save).not.toHaveBeenCalled();
  });
  it("accepts a valid same-origin admin request", async () => {
    expect((await PUT(request("https://example.com"))).status).toBe(200);
    expect(h.save).toHaveBeenCalledWith("admin", body);
  });
});
