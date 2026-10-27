import { env } from "../env";

// Google sign-in (OAuth 2.0 authorization-code flow, OpenID Connect scopes).
// Tokens are used once to read the profile and are not stored.

export function googleEnabled(): boolean {
  return Boolean(env.googleClientId() && env.googleClientSecret());
}

function redirectUri() {
  return `${env.appUrl()}/api/auth/google/callback`;
}

export function googleAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId() ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId() ?? "",
      client_secret: env.googleClientSecret() ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(`Google OAuth failed: ${token.error_description ?? token.error ?? tokenResponse.status}`);
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || !profile.sub) throw new Error(`Google userinfo failed: ${profileResponse.status}`);
  return {
    sub: String(profile.sub),
    email: typeof profile.email === "string" ? profile.email.toLowerCase() : null,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
  };
}
