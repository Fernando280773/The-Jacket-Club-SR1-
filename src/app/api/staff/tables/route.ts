import { adminClient } from "@/lib/server/admin";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/** Owner only: table numbers and their QR codes, for printing the table cards. */
export async function GET(req: Request) {
  const owner = await staffFromRequest(req, ["owner"]);
  if (!owner) return Response.json({ ok: false }, { status: 401 });
  const { data, error } = await adminClient().from("dining_tables").select("number, qr_token").eq("shop_id", owner.shopId).order("number");
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, tables: (data ?? []).map((t) => ({ number: t.number, token: t.qr_token })) });
}
