import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "../env";

export type OAuthProvider = "github" | "google";
/** login = sign in / sign up; connect = link GitHub (with repository access) to the signed-in account. */
export type OAuthMode = "login" | "connect";

const COOKIE = "i2a_oauth_state";

/** Creates the CSRF `state` and remembers provider + mode in a short-lived httpOnly cookie. */
export async function beginOAuth(provider: OAuthProvider, mode: OAuthMode): Promise<string> {
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE, `${provider}.${mode}.${state}`, {
    httpOnly: true,
    secure: env.isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export type OAuthCheck =
  | { ok: true; mode: OAuthMode }
  /** no_cookie: the browser did not send the state cookie back (other host, blocked cookies, expired). mismatch: it did, but the state differs. */
  | { ok: false; reason: "no_cookie" | "mismatch" };

/** Checks the returned `state` against the cookie (once) and tells why it failed, so the UI can say what to do. */
export async function consumeOAuth(provider: OAuthProvider, returnedState: string | null): Promise<OAuthCheck> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!raw) return { ok: false, reason: "no_cookie" };
  const [cookieProvider, mode, state] = raw.split(".");
  if (!returnedState || cookieProvider !== provider || (mode !== "login" && mode !== "connect") || !state) {
    return { ok: false, reason: "mismatch" };
  }
  const left = Buffer.from(state);
  const right = Buffer.from(returnedState);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false, reason: "mismatch" };
  return { ok: true, mode };
}

/**
 * Where to send the browser when the provider's redirect back is unusable.
 * `error` is set when the provider itself refused (user pressed Cancel, access_denied, …).
 */
export function oauthFailureRedirect(base: string, check: OAuthCheck, providerError: string | null): string {
  if (!check.ok) return `${base}/?error=${check.reason === "no_cookie" ? "oauth_no_cookie" : "oauth_mismatch"}`;
  if (providerError) {
    // Only a short machine code is echoed back (e.g. access_denied), never free text.
    const detail = /^[a-z_]{1,40}$/.test(providerError) ? providerError : "unknown";
    return `${base}/?error=provider_denied&detail=${detail}`;
  }
  return `${base}/?error=oauth_state`;
}
