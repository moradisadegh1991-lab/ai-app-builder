import { NextResponse } from "next/server";
import { confirmStripeSession, verifyStripeSignature } from "@/lib/billing/payments";
import { env } from "@/lib/env";

/** Backup path for when the buyer closes the tab before returning from Stripe. */
export async function POST(request: Request) {
  const secret = env.stripeWebhookSecret();
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 404 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await confirmStripeSession(event.data.object.id);
  }
  return NextResponse.json({ received: true });
}
