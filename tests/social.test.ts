import { describe, expect, it } from "vitest";
import {
  GITHUB_LOGIN_SCOPES,
  GITHUB_SCOPES,
  authorizeUrl,
  pickVerifiedEmail,
} from "@/lib/integrations/github";
import { googleAuthorizeUrl, googleEnabled } from "@/lib/integrations/google";

describe("pickVerifiedEmail", () => {
  it("prefers the primary verified address", () => {
    expect(
      pickVerifiedEmail([
        { email: "other@example.com", primary: false, verified: true },
        { email: "Main@Example.com", primary: true, verified: true },
      ]),
    ).toBe("main@example.com");
  });

  it("never uses unverified or noreply addresses", () => {
    expect(
      pickVerifiedEmail([
        { email: "unverified@example.com", primary: true, verified: false },
        { email: "123+octo@users.noreply.github.com", primary: false, verified: true },
      ]),
    ).toBeNull();
  });

  it("falls back to another verified address when the primary is unusable", () => {
    expect(
      pickVerifiedEmail([
        { email: "primary@example.com", primary: true, verified: false },
        { email: "second@example.com", primary: false, verified: true },
      ]),
    ).toBe("second@example.com");
  });

  it("returns null for no addresses", () => {
    expect(pickVerifiedEmail([])).toBeNull();
  });
});

describe("OAuth URLs", () => {
  process.env.APP_URL = "https://idea2app.example.com";
  process.env.GITHUB_CLIENT_ID = "gh-client";
  process.env.GOOGLE_CLIENT_ID = "google-client";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";

  it("signs in to GitHub with identity-only scopes and connects with repository access", () => {
    expect(GITHUB_LOGIN_SCOPES).not.toContain("repo");
    expect(GITHUB_SCOPES).toContain("repo");
    const login = new URL(authorizeUrl("s1", GITHUB_LOGIN_SCOPES));
    expect(login.searchParams.get("scope")).toBe("read:user user:email");
    expect(login.searchParams.get("redirect_uri")).toBe("https://idea2app.example.com/api/auth/github/callback");
    expect(new URL(authorizeUrl("s2")).searchParams.get("scope")).toBe(GITHUB_SCOPES);
  });

  it("builds the Google authorization URL with state and the callback", () => {
    expect(googleEnabled()).toBe(true);
    const url = new URL(googleAuthorizeUrl("state123"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toBe("https://idea2app.example.com/api/auth/google/callback");
  });
});
