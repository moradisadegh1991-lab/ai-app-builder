import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { decryptSecret, encryptSecret, maskSecret } from "../crypto";
import type { IntegrationProvider } from "../db/schema";

export interface StoredIntegration {
  secret: string;
  metadata: Record<string, string>;
}

export async function getIntegration(userId: string, provider: IntegrationProvider): Promise<StoredIntegration | null> {
  const [row] = await db()
    .select()
    .from(schema.integrations)
    .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.provider, provider)))
    .limit(1);
  if (!row) return null;
  return { secret: decryptSecret(row.encryptedSecret), metadata: row.metadata };
}

export async function saveIntegration(
  userId: string,
  provider: IntegrationProvider,
  secret: string,
  metadata: Record<string, string> = {},
) {
  const values = {
    userId,
    provider,
    encryptedSecret: encryptSecret(secret),
    secretHint: maskSecret(secret),
    metadata,
    updatedAt: new Date(),
  };
  await db()
    .insert(schema.integrations)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.integrations.userId, schema.integrations.provider],
      set: values,
    });
}

export async function deleteIntegration(userId: string, provider: IntegrationProvider) {
  await db()
    .delete(schema.integrations)
    .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.provider, provider)));
}

/** Safe-to-display view of a user's connections (no secrets). */
export async function listIntegrations(userId: string) {
  const rows = await db()
    .select({
      provider: schema.integrations.provider,
      secretHint: schema.integrations.secretHint,
      metadata: schema.integrations.metadata,
      updatedAt: schema.integrations.updatedAt,
    })
    .from(schema.integrations)
    .where(eq(schema.integrations.userId, userId));
  return rows;
}
