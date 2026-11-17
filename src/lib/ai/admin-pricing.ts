import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../http";
import { isLiaraGateway, liaraModelPrice, type LiaraPrice } from "./liara-pricing";

// UUID allowlist is configured server-side; never infer admin rights from email or the client.
export function isPricingAdmin(userId: string, raw = process.env.PRICING_ADMIN_USER_IDS): boolean {
  return !!raw && raw.split(",").map(x => x.trim().toLowerCase()).includes(userId.toLowerCase());
}
export function requirePricingAdmin(userId: string) {
  if (!isPricingAdmin(userId)) throw new HttpError(403, "دسترسی به تنظیمات قیمت مجاز نیست.");
}
export const tariffInput = z.object({
  model: z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9._/-]+$/),
  inputTomanPerMillion: z.number().finite().positive().max(1e12),
  outputTomanPerMillion: z.number().finite().positive().max(1e12),
}).strict();

/** DB prices override the old environment configuration. No cache: changes take effect immediately. */
export async function configuredLiaraPrice(gateway: string | undefined, source: string | null, model: string): Promise<LiaraPrice | null> {
  if (!isLiaraGateway(gateway, source)) return null;
  const [entry] = await db().select().from(schema.aiTariffs).where(eq(schema.aiTariffs.key, `liara:${model}`)).limit(1);
  const raw = entry ? JSON.stringify({ [model]: entry.price }) : process.env.LIARA_MODEL_PRICING_JSON;
  return liaraModelPrice(raw, gateway, source, model);
}
export async function saveTariff(userId: string, value: z.infer<typeof tariffInput>) {
  const input = tariffInput.parse(value);
  const price = { inputTomanPerMillion: input.inputTomanPerMillion, outputTomanPerMillion: input.outputTomanPerMillion, updatedAt: new Date().toISOString() };
  const key = `liara:${input.model}`;
  await db().insert(schema.aiTariffs).values({ key, price, updatedBy: userId }).onConflictDoUpdate({ target: schema.aiTariffs.key, set: { price, updatedBy: userId, updatedAt: new Date() } });
  return price;
}
