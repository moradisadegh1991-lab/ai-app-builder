import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const h = vi.hoisted(() => ({ user: vi.fn(), owner: vi.fn(), load: vi.fn(), ai: vi.fn() }));
vi.mock("../src/lib/session", () => ({ requireApiUser: h.user }));
vi.mock("../src/lib/projects", () => ({ getOwnedProject: h.owner }));
vi.mock("../src/lib/visual/store", () => ({ loadVisualProject: h.load }));
vi.mock("../src/lib/ai", () => ({ generateStructured: h.ai }));
import { GET } from "../src/app/api/projects/[id]/visual/export/route";
import { HttpError } from "../src/lib/http";
const ctx = { params: Promise.resolve({ id: "project" }) };
beforeEach(() => { vi.resetAllMocks(); h.user.mockResolvedValue({ id: "owner" }); h.owner.mockResolvedValue({ id: "project" }); });
describe("visual export API", () => {
  it("requires ownership before reading the saved draft", async () => {
    h.owner.mockRejectedValue(new HttpError(404, "پروژه پیدا نشد."));
    expect((await GET(new Request("http://localhost"), ctx)).status).toBe(404);
    expect(h.load).not.toHaveBeenCalled();
  });
  it("exports only the stored revision without invoking AI", async () => {
    h.load.mockResolvedValue({ schemaVersion: 1, revision: 2, designTokens: { primary: "#112233", background: "#ffffff", direction: "rtl" }, pages: [{ id: randomUUID(), title: "خانه", route: "/", components: [] }] });
    const response = await GET(new Request("http://localhost"), ctx);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revision).toBe(2); expect(body.file.path).toBe("src/App.tsx"); expect(h.ai).not.toHaveBeenCalled();
  });
});
