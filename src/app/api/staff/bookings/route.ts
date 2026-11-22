import { adminClient } from "@/lib/server/admin";
import { startTimes } from "@/lib/bookings";
import { bookingContext, closeByStaff, moveByStaff } from "@/lib/server/bookings";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/** Kitchen and owner: cancel (full refund), mark a no-show, or move a booking. */
export async function POST(req: Request) {
  const staff = await staffFromRequest(req, ["owner", "kitchen"]);
  if (!staff) return Response.json({ ok: false, error: "Please sign in as staff." }, { status: 401 });
  let body: { action?: string; bookingId?: string; date?: string; startIso?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const id = String(body.bookingId ?? "");
  const { data: b } = await adminClient().from("bookings").select("shop_id").eq("id", id).maybeSingle();
  if (!b || b.shop_id !== staff.shopId) return Response.json({ ok: false, error: "Booking not found." }, { status: 404 });

  if (body.action === "cancel" || body.action === "no_show") {
    return Response.json(await closeByStaff(id, body.action, staff.name));
  }
  if (body.action === "move" && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) && typeof body.startIso === "string") {
    return Response.json(await moveByStaff(id, String(body.date), body.startIso));
  }
  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

/** Start times inside opening hours for a date (to move a booking). */
export async function GET(req: Request) {
  const staff = await staffFromRequest(req, ["owner", "kitchen"]);
  if (!staff) return Response.json({ ok: false }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ ok: false }, { status: 400 });
  const ctx = await bookingContext();
  return Response.json({ ok: true, times: startTimes(ctx.hours, date, new Date(), ctx.rules.slotMinutes) });
}
