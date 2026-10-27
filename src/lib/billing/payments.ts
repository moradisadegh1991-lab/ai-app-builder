import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { PLANS, priceToman, type Plan } from "./plans";
import { grantPlan } from "./subscription";

export type Gateway = "zarinpal" | "stripe";

export function availableGateways(): Gateway[] {
  const gateways: Gateway[] = [];
  if (env.zarinpalMerchantId() && env.usdToToman() > 0) gateways.push("zarinpal");
  if (env.stripeSecretKey()) gateways.push("stripe");
  return gateways;
}

// ------------------------------------------------------------- Zarinpal

function zarinpalBase() {
  return env.zarinpalSandbox() ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
}

async function zarinpalCall(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${zarinpalBase()}/pg/v4/payment/${path}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ merchant_id: env.zarinpalMerchantId(), ...body }),
  });
  const data = await response.json().catch(() => ({}));
  return data as { data?: { code?: number; authority?: string; ref_id?: number; message?: string }; errors?: unknown };
}

async function startZarinpal(user: schema.User, plan: Plan): Promise<string> {
  const amount = priceToman(plan, env.usdToToman());
  if (!amount) throw new HttpError(400, "پرداخت تومانی پیکربندی نشده است.");
  const [payment] = await db()
    .insert(schema.payments)
    .values({ userId: user.id, plan: plan.id, provider: "zarinpal", amount, currency: "IRT" })
    .returning();
  const result = await zarinpalCall("request.json", {
    amount,
    currency: "IRT",
    description: `اشتراک ${plan.name} Idea2App AI (۳۰ روز)`,
    callback_url: `${env.appUrl()}/api/billing/zarinpal/callback`,
    metadata: { email: user.email, order_id: payment!.id },
  });
  const authority = result.data?.code === 100 ? result.data.authority : undefined;
  if (!authority) {
    await db().update(schema.payments).set({ status: "failed" }).where(eq(schema.payments.id, payment!.id));
    throw new HttpError(502, `زرین‌پال درخواست پرداخت را نپذیرفت: ${JSON.stringify(result.errors ?? result.data ?? {})}`);
  }
  await db().update(schema.payments).set({ reference: authority }).where(eq(schema.payments.id, payment!.id));
  return `${zarinpalBase()}/pg/StartPay/${authority}`;
}

/** Verifies a Zarinpal callback. Returns the payment status after verification. */
export async function verifyZarinpal(authority: string, status: string) {
  const [payment] = await db()
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, "zarinpal"), eq(schema.payments.reference, authority)))
    .limit(1);
  if (!payment) return "failed" as const;
  if (payment.status !== "pending") return payment.status as "paid" | "failed";
  if (status !== "OK") {
    await db().update(schema.payments).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
    return "failed" as const;
  }
  const result = await zarinpalCall("verify.json", { amount: payment.amount, authority });
  const code = result.data?.code;
  if (code === 100 || code === 101) {
    await completePayment(payment.id, String(result.data?.ref_id ?? ""));
    return "paid" as const;
  }
  await db().update(schema.payments).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
  return "failed" as const;
}

// --------------------------------------------------------------- Stripe

async function stripe(method: "GET" | "POST", path: string, form?: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.stripeSecretKey()}`,
      ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new HttpError(502, `Stripe: ${data.error?.message ?? response.status}`);
  return data;
}

async function startStripe(user: schema.User, plan: Plan): Promise<string> {
  const amount = plan.priceUsd * 100;
  const [payment] = await db()
    .insert(schema.payments)
    .values({ userId: user.id, plan: plan.id, provider: "stripe", amount, currency: "usd" })
    .returning();
  const session = await stripe("POST", "checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `Idea2App AI ${plan.id.toUpperCase()} — 30 days`,
    customer_email: user.email,
    client_reference_id: payment!.id,
    "metadata[payment_id]": payment!.id,
    success_url: `${env.appUrl()}/api/billing/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl()}/pricing?payment=cancelled`,
  });
  await db().update(schema.payments).set({ reference: session.id }).where(eq(schema.payments.id, payment!.id));
  return session.url as string;
}

/** Confirms a Stripe Checkout Session (on return and from the webhook). */
export async function confirmStripeSession(sessionId: string) {
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
  const paymentId = session.client_reference_id as string | null;
  if (!paymentId) return "failed" as const;
  if (session.payment_status !== "paid") return "pending" as const;
  await completePayment(paymentId, String(session.payment_intent ?? session.id));
  return "paid" as const;
}

/** Verifies the Stripe-Signature header (HMAC-SHA256 over "timestamp.payload"). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, ...rest] = part.split("=");
      return [k, rest.join("=")];
    }),
  );
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return header
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const signature = Buffer.from(part.slice(3), "hex");
      return signature.length === expected.length && timingSafeEqual(signature, expected);
    });
}

// ---------------------------------------------------------------- common

/** Marks a payment paid exactly once and grants its plan. */
async function completePayment(paymentId: string, receipt: string) {
  const [payment] = await db()
    .update(schema.payments)
    .set({ status: "paid", receipt, paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.status, "pending")))
    .returning();
  if (payment) await grantPlan(payment.userId, payment.plan);
}

export async function startCheckout(user: schema.User, planId: "plus" | "pro" | "max", gateway: Gateway) {
  if (!availableGateways().includes(gateway)) throw new HttpError(400, "این درگاه پرداخت فعال نیست.");
  const plan = PLANS[planId];
  return gateway === "zarinpal" ? startZarinpal(user, plan) : startStripe(user, plan);
}
