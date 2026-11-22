import type Stripe from "stripe";
import type { FulfilResult } from "./fulfil";

type Deps = {
  secret: string | undefined;
  constructEvent: (body: string, signature: string, secret: string) => Stripe.Event;
  fulfil: (session: Stripe.Checkout.Session) => Promise<FulfilResult>;
};

/** Checks the Stripe signature, then turns paid checkouts into orders. Returns an HTTP status and message. */
export async function handleStripeWebhook(body: string, signature: string | null, deps: Deps): Promise<{ status: number; message: string }> {
  if (!deps.secret) return { status: 500, message: "Webhook secret not set" };
  if (!signature) return { status: 400, message: "Missing signature" };
  let event: Stripe.Event;
  try {
    event = deps.constructEvent(body, signature, deps.secret);
  } catch {
    return { status: 400, message: "Bad signature" };
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const result = await deps.fulfil(event.data.object as Stripe.Checkout.Session);
    if (!result.ok && result.reason === "error") return { status: 500, message: result.message }; // Stripe retries
    return { status: 200, message: result.ok ? `Order ${result.orderNumber}` : result.reason };
  }
  return { status: 200, message: "Ignored" };
}
