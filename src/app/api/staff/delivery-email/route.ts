import { adminClient } from "@/lib/server/admin";
import { sendOnItsWay } from "@/lib/server/delivery-email";
import { siteOrigin } from "@/lib/server/site-origin";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/**
 * Called by the driver's phone (or the kitchen screen) right after an order is marked out for delivery:
 * emails the customer "your order is on its way". A driver can only trigger it for a delivery given to them.
 */
export async function POST(req: Request) {
  const staff = await staffFromRequest(req, ["owner", "kitchen", "driver"]);
  if (!staff) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" && /^[0-9a-f-]{36}$/.test(body.orderId) ? body.orderId : null;
  if (!orderId) return Response.json({ ok: false }, { status: 400 });

  const db = adminClient();
  const { data: order } = await db.from("orders").select("shop_id, deliveries(driver_assignments(staff_users(auth_user_id)))").eq("id", orderId).maybeSingle();
  if (!order || order.shop_id !== staff.shopId) return Response.json({ ok: false }, { status: 404 });
  if (staff.role === "driver" && !JSON.stringify(order.deliveries ?? null).includes(`"auth_user_id":"${staff.authUserId}"`)) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const result = await sendOnItsWay(orderId, siteOrigin(req));
  if (result === "failed") console.error("on-its-way email: could not send", orderId);
  return Response.json({ ok: result === "sent", result }, { status: result === "failed" ? 502 : 200 });
}
