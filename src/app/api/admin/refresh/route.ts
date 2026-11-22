import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/server/admin";

/**
 * Called by the admin after a change, so the menu page shows it straight away instead of within a minute.
 * Only signed-in staff can trigger it; it changes nothing itself.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ ok: false }, { status: 401 });
  try {
    const db = adminClient();
    const { data: user } = await db.auth.getUser(token);
    if (!user.user) return Response.json({ ok: false }, { status: 401 });
    const { data: staff } = await db.from("staff_users").select("id").eq("auth_user_id", user.user.id).eq("is_active", true).maybeSingle();
    if (!staff) return Response.json({ ok: false }, { status: 403 });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
  revalidatePath("/");
  revalidatePath("/allergens");
  return Response.json({ ok: true });
}
