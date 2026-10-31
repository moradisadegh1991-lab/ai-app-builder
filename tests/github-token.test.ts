import { afterEach, describe, expect, it, vi } from "vitest";
import { GITHUB_TOKEN_REJECTED, GitHubError, createRepository } from "../src/lib/integrations/github";

afterEach(() => vi.unstubAllGlobals());

describe("GitHub 401", () => {
  it("tells the user to reconnect instead of showing the raw API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })));
    const error = await createRepository("revoked-token", "demo", "demo").catch((e) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.status).toBe(401);
    expect(error.message).toBe(GITHUB_TOKEN_REJECTED);
  });

  it("keeps the API message for other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: "Repository creation failed" }), { status: 403 })));
    const error = await createRepository("token", "demo", "demo").catch((e) => e);
    expect(error.message).toContain("403: Repository creation failed");
  });
});
