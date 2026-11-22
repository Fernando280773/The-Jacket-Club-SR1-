import type Stripe from "stripe";
import { adminClient } from "./admin";
import { stripe } from "./stripe";

export type FulfilResult =
  | { ok: true; orderId: string; orderNumber: number; created: boolean }
  | { ok: false; reason: "unpaid" | "not_ours" | "error"; message: string };

/**
 * Turns a paid Stripe Checkout session into an order. Safe to call any number of times for the same
 * session (thank-you page and webhook both call it); the database returns the first order.
 */
export async function fulfilSession(sessionOrId: string | Stripe.Checkout.Session): Promise<FulfilResult> {
  try {
    const session = typeof sessionOrId === "string" ? await stripe().checkout.sessions.retrieve(sessionOrId) : sessionOrId;
    const m = session.metadata ?? {};
    if (!m.basket_id) return { ok: false, reason: "not_ours", message: "Not a Jacket Club order checkout" };
    if (session.payment_status !== "paid") return { ok: false, reason: "unpaid", message: "Payment not completed" };
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent) return { ok: false, reason: "error", message: "No payment reference" };

    const { data, error } = await adminClient().rpc("create_order_from_basket", {
      p_basket_id: m.basket_id,
      p_payment_intent: paymentIntent,
      p_amount_pence: session.amount_total ?? 0,
      p_name: m.name ?? "",
      p_phone: m.phone ?? "",
      // Our form's email first; otherwise the one typed on Stripe's payment page.
      p_email: m.email || session.customer_details?.email || "",
      p_pickup_at: m.pickup_at || null,
      p_booking_id: m.deposit_booking_id || null,
      p_credit_pence: Number(m.deposit_credit_pence) || 0,
    });
    if (error) return { ok: false, reason: "error", message: error.message };
    const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: number; created: boolean } | undefined;
    if (!row) return { ok: false, reason: "error", message: "Order was not created" };
    return { ok: true, orderId: row.order_id, orderNumber: row.order_number, created: row.created };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
