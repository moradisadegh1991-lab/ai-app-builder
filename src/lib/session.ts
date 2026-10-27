import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";
import { HttpError } from "./http";

const SESSION_COOKIE = "i2a_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = env.sessionSecret();
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<schema.User | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const [user] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return user ?? null;
}

/** For pages: sends anonymous visitors back to the landing page. */
export async function requirePageUser(): Promise<schema.User> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** For API routes: throws a 401 that `handleRoute` turns into JSON. */
export async function requireApiUser(): Promise<schema.User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "ابتدا با GitHub وارد شوید.");
  return user;
}
