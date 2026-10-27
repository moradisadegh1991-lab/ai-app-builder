import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { sendMail } from "../mail";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("ایمیل معتبر نیست.").max(254));

function hashCode(email: string, code: string) {
  return createHmac("sha256", env.sessionSecret()).update(`${email}:${code}`).digest("hex");
}

export async function requestLoginCode(rawEmail: string) {
  const email = emailSchema.parse(rawEmail);
  const hourAgo = new Date(Date.now() - 60 * 60_000);

  const [latest] = await db()
    .select({ createdAt: schema.emailCodes.createdAt })
    .from(schema.emailCodes)
    .where(eq(schema.emailCodes.email, email))
    .orderBy(desc(schema.emailCodes.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, "کد قبلی تازه ارسال شده است؛ یک دقیقه صبر کنید.");
  }
  const [recent] = await db()
    .select({ value: count() })
    .from(schema.emailCodes)
    .where(and(eq(schema.emailCodes.email, email), gte(schema.emailCodes.createdAt, hourAgo)));
  if ((recent?.value ?? 0) >= MAX_CODES_PER_HOUR) {
    throw new HttpError(429, "تعداد درخواست کد زیاد بوده است؛ یک ساعت دیگر تلاش کنید.");
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db()
    .insert(schema.emailCodes)
    .values({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });

  await sendMail({
    to: email,
    subject: `کد ورود Idea2App AI: ${code}`,
    text: `کد ورود شما: ${code}\nاین کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.`,
    html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;font-size:15px">
<p>کد ورود شما به <b>Idea2App AI</b>:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:bold;direction:ltr;text-align:center">${code}</p>
<p>این کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.</p></div>`,
  });
  return email;
}

/** Checks the code and returns the (possibly new) user. */
export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<schema.User> {
  const email = emailSchema.parse(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) throw new HttpError(400, "کد باید ۶ رقم باشد.");

  const [row] = await db()
    .select()
    .from(schema.emailCodes)
    .where(and(eq(schema.emailCodes.email, email), isNull(schema.emailCodes.consumedAt)))
    .orderBy(desc(schema.emailCodes.createdAt))
    .limit(1);
  if (!row || row.expiresAt < new Date()) throw new HttpError(400, "کد منقضی شده است؛ کد جدید بگیرید.");
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "تلاش‌های ناموفق زیاد بود؛ کد جدید بگیرید.");

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await db()
      .update(schema.emailCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(schema.emailCodes.id, row.id));
    throw new HttpError(400, "کد اشتباه است.");
  }

  await db().update(schema.emailCodes).set({ consumedAt: new Date() }).where(eq(schema.emailCodes.id, row.id));
  const [user] = await db()
    .insert(schema.users)
    .values({ email })
    .onConflictDoUpdate({ target: schema.users.email, set: { updatedAt: new Date() } })
    .returning();
  return user!;
}
