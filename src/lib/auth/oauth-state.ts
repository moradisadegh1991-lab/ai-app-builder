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

/** Checks the returned `state` against the cookie (once) and returns the mode, or null if it does not match. */
export async function consumeOAuth(provider: OAuthProvider, returnedState: string | null): Promise<OAuthMode | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!raw || !returnedState) return null;
  const [cookieProvider, mode, state] = raw.split(".");
  if (cookieProvider !== provider || (mode !== "login" && mode !== "connect") || !state) return null;
  const left = Buffer.from(state);
  const right = Buffer.from(returnedState);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return mode;
}
