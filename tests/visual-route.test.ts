import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ user: vi.fn(), owner: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock("../src/lib/session", () => ({ requireApiUser: h.user }));
vi.mock("../src/lib/projects", () => ({ getOwnedProject: h.owner }));
vi.mock("../src/lib/visual/store", () => ({ loadVisualProject: h.load, saveVisualProject: h.save }));
import { GET, PUT } from "../src/app/api/projects/[id]/visual/route";
import { HttpError } from "../src/lib/http";
const ctx = { params: Promise.resolve({ id: "project" }) };
beforeEach(() => { vi.resetAllMocks(); h.user.mockResolvedValue({ id: "owner" }); h.owner.mockResolvedValue({ id: "project" }); h.save.mockResolvedValue({ revision: 1 }); });
describe("visual draft API", () => {
  it("checks ownership before loading or saving", async () => {
    h.owner.mockRejectedValue(new HttpError(404, "پروژه پیدا نشد."));
    expect((await GET(new Request("http://localhost"), ctx)).status).toBe(404);
    expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{}" }), ctx)).status).toBe(404);
    expect(h.load).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });
  it("rejects oversized requests before writing", async () => {
    const response = await PUT(new Request("http://localhost", { method: "PUT", body: "x".repeat(512 * 1024 + 1) }), ctx);
    expect(response.status).toBe(413); expect(h.save).not.toHaveBeenCalled();
  });
  it("reports a stale write without retrying", async () => {
    h.save.mockRejectedValue(new HttpError(409, "نسخه تغییر کرده است."));
    const response = await PUT(new Request("http://localhost", { method: "PUT", body: "{}" }), ctx);
    expect(response.status).toBe(409); expect(h.save).toHaveBeenCalledOnce();
  });
});
