import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireApiUser: mocks.user }));
vi.mock("@/lib/ai", () => ({ AI_PROVIDERS: ["openai", "anthropic", "gemini"], generateStructured: mocks.generate }));
import { POST } from "../src/app/api/ai/idea-questions/route";

const request = (body: unknown) => new Request("http://localhost/api/ai/idea-questions", { method: "POST", body: JSON.stringify(body) });
const input = { idea: "یک سایت برای مدیریت سفارش‌های مشتریان", kind: "website", provider: "gemini", answers: [{ question: "کاربران؟", answer: "فروشندگان" }] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user-1" });
  mocks.generate.mockResolvedValue({ data: { questions: [{ question: "سفارش‌ها چگونه پیگیری می‌شوند؟", hint: "مثلاً با وضعیت" }] } });
});
describe("idea discovery endpoint", () => {
  it("authenticates and sends the actual idea, answers and selected provider to the model", async () => {
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", provider: "gemini", purpose: "spec" }));
    const prompt = JSON.parse(mocks.generate.mock.calls[0]![0].prompt);
    expect(prompt).toMatchObject({ idea: input.idea, kind: input.kind, answers: input.answers });
    expect(await response.json()).toHaveProperty("questions");
  });
  it("rejects invalid input before calling the model", async () => {
    const response = await POST(request({ ...input, idea: "کوتاه" }));
    expect(response.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
