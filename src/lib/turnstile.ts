import { env } from "./env";
import { HttpError } from "./http";

export function turnstileEnabled(): boolean {
  return Boolean(env.turnstileSiteKey() && env.turnstileSecretKey());
}

/** Verifies a Cloudflare Turnstile token. Does nothing when Turnstile is not configured. */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string): Promise<void> {
  if (!turnstileEnabled()) return;
  if (!token) throw new HttpError(400, "تأیید «من ربات نیستم» انجام نشده است.");
  let ok = false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({
        secret: env.turnstileSecretKey()!,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as { success?: boolean };
    ok = data.success === true;
  } catch {
    throw new HttpError(503, "بررسی امنیتی در دسترس نیست؛ کمی بعد دوباره تلاش کنید.");
  }
  if (!ok) throw new HttpError(400, "تأیید «من ربات نیستم» معتبر نبود؛ دوباره تلاش کنید.");
}
