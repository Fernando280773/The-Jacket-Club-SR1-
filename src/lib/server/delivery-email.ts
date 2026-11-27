import "server-only";
import { buildOnItsWay } from "../delivery-email";
import { emailConfigured, sendEmail } from "./email";
import { orderById } from "./orders";

export type OnItsWayResult = "sent" | "not_out" | "no_email" | "not_configured" | "failed";

/**
 * Emails the customer that their delivery has left the shop. Only for a delivery order that is out for delivery right now.
 * The idempotency key means a second call for the same order (driver and kitchen both tapping) sends nothing new.
 */
export async function sendOnItsWay(orderId: string, siteUrl: string): Promise<OnItsWayResult> {
  if (!emailConfigured()) return "not_configured";
  const order = await orderById(orderId);
  if (!order) return "failed";
  if (order.type !== "delivery" || order.status !== "out_for_delivery") return "not_out";
  const email = order.customers?.email;
  if (!email) return "no_email";
  const { subject, html, text } = buildOnItsWay(order, `${siteUrl}/order/${order.access_token}`);
  const ok = await sendEmail({ to: email, subject, html, text, idempotencyKey: `on-its-way-${orderId}` });
  return ok ? "sent" : "failed";
}
