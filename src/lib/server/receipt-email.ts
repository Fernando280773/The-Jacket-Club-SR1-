import { buildReceipt } from "../receipt";
import { adminClient } from "./admin";
import { orderById } from "./orders";

const FROM = () => process.env.RECEIPT_FROM ?? "The Jacket Club SR1 <info@thejacketclubsr1.com>";

export type SendResult = "sent" | "already_sent" | "no_email" | "not_configured" | "failed";

/**
 * Sends the receipt at most once per order. The order row is claimed first (receipt_sent_at),
 * so the thank-you page and the Stripe webhook can both call this safely.
 */
export async function sendReceiptOnce(orderId: string, siteUrl: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "not_configured";
  const order = await orderById(orderId);
  if (!order) return "failed";
  const email = order.customers?.email;
  if (!email) return "no_email";

  const db = adminClient();
  const { data: claimed } = await db
    .from("orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("receipt_sent_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return "already_sent";

  const { subject, html, text } = buildReceipt(order, `${siteUrl}/order/${order.access_token}`);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `receipt-${orderId}` },
      body: JSON.stringify({ from: FROM(), to: [email], reply_to: "info@thejacketclubsr1.com", subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    return "sent";
  } catch {
    await db.from("orders").update({ receipt_sent_at: null }).eq("id", orderId); // let a later call retry
    return "failed";
  }
}
