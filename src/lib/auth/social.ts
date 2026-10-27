import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../http";

export interface SocialIdentity {
  provider: "github" | "google";
  /** GitHub numeric id or Google `sub`. */
  providerId: string | number;
  /** Must already be verified by the provider; null when the provider has no verified address. */
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  githubLogin?: string | null;
}

async function byProviderId(identity: SocialIdentity) {
  const [user] =
    identity.provider === "github"
      ? await db().select().from(schema.users).where(eq(schema.users.githubId, Number(identity.providerId))).limit(1)
      : await db().select().from(schema.users).where(eq(schema.users.googleId, String(identity.providerId))).limit(1);
  return user ?? null;
}

/**
 * Finds or creates the account for a social sign-in.
 *  1. Same provider account → that user.
 *  2. Same *verified* e-mail (e.g. the user first signed up with an e-mail code) → the
 *     provider is linked to that account. Both sides proved ownership of the address.
 *  3. Otherwise a new account is created.
 */
export async function signInWithIdentity(identity: SocialIdentity): Promise<schema.User> {
  const existing = await byProviderId(identity);
  if (existing) return existing;

  const email = identity.email?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, "حساب شما ایمیل تأییدشده‌ای ندارد؛ با کد ایمیل وارد شوید یا ایمیلتان را در آن سرویس تأیید کنید.");
  }

  const providerFields =
    identity.provider === "github"
      ? { githubId: Number(identity.providerId), githubLogin: identity.githubLogin ?? null }
      : { googleId: String(identity.providerId) };

  const [sameEmail] = await db().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (sameEmail) {
    const alreadyLinked = identity.provider === "github" ? sameEmail.githubId : sameEmail.googleId;
    if (alreadyLinked !== null) {
      throw new HttpError(409, "این ایمیل قبلاً به حساب دیگری از همین سرویس وصل شده است.");
    }
    const [linked] = await db()
      .update(schema.users)
      .set({
        ...providerFields,
        name: sameEmail.name ?? identity.name,
        avatarUrl: sameEmail.avatarUrl ?? identity.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, sameEmail.id))
      .returning();
    return linked!;
  }

  const [created] = await db()
    .insert(schema.users)
    .values({ email, name: identity.name, avatarUrl: identity.avatarUrl, ...providerFields })
    .onConflictDoNothing()
    .returning();
  if (!created) throw new HttpError(409, "ثبت‌نام همزمان انجام شد؛ دوباره تلاش کنید.");
  return created;
}
