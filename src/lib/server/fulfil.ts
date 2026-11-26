import "server-only";
import type Stripe from "stripe";
import { adminClient } from "./admin";
import { queueOrderLabels } from "./print";
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
    if (m.staff_test === "1" && row.created) await adminClient().from("orders").update({ is_staff_test: true }).eq("id", row.order_id);
    if (m.account_user_id && row.created) await linkToAccount(row.order_id, m.account_user_id, m.save_address === "1");
    // After the staff-test mark, so test labels say so. Safe to call twice: the database queues once per order.
    await queueOrderLabels(row.order_id);
    return { ok: true, orderId: row.order_id, orderNumber: row.order_number, created: row.created };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Joins a paid order to the signed-in customer's account and, if they asked, saves the delivery address. */
async function linkToAccount(orderId: string, authUserId: string, saveAddress: boolean) {
  const db = adminClient();
  const { data: order } = await db.from("orders").select("shop_id, customer_id, deliveries(address_text, postcode)").eq("id", orderId).maybeSingle();
  if (!order?.customer_id) return;
  await db.from("customers").update({ auth_user_id: authUserId }).eq("id", order.customer_id).is("auth_user_id", null);
  const delivery = (Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries) as { address_text: string; postcode: string } | null;
  if (!saveAddress || !delivery?.address_text) return;
  const { data: account } = await db.from("customer_accounts").select("id").eq("shop_id", order.shop_id).eq("auth_user_id", authUserId).maybeSingle();
  if (!account) return;
  await db
    .from("saved_addresses")
    .upsert(
      { shop_id: order.shop_id, account_id: account.id, address_text: delivery.address_text.slice(0, 200), postcode: (delivery.postcode ?? "").slice(0, 10) },
      { onConflict: "account_id,address_text", ignoreDuplicates: true },
    );
}
