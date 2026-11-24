import { adminClient } from "@/lib/server/admin";
import { resendReceipt } from "@/lib/server/receipt-email";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/** Kitchen or owner: email the receipt to the customer again. Kitchen staff only for the last 7 days. */
export async function POST(req: Request) {
  const staff = await staffFromRequest(req, ["owner", "kitchen"]);
  if (!staff) return Response.json({ ok: false, error: "Please sign in as staff." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" && /^[0-9a-f-]{36}$/.test(body.orderId) ? body.orderId : null;
  if (!orderId) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });

  const { data: order } = await adminClient().from("orders").select("shop_id, created_at").eq("id", orderId).maybeSingle();
  const weekAgo = Date.now() - 7 * 86_400_000;
  if (!order || order.shop_id !== staff.shopId || (staff.role !== "owner" && new Date(order.created_at).getTime() < weekAgo)) {
    return Response.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const result = await resendReceipt(orderId, new URL(req.url).origin);
  const messages = { sent: "Receipt sent again.", no_email: "This customer didn't give an email address.", not_configured: "Email isn't set up on this site.", failed: "Couldn't send the email. Try again in a minute." };
  return Response.json({ ok: result === "sent", message: messages[result] }, { status: result === "sent" ? 200 : result === "failed" ? 502 : 200 });
}
