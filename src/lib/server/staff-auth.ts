import "server-only";
import { adminClient } from "./admin";

export type StaffCaller = { authUserId: string; shopId: string; name: string; role: "owner" | "kitchen" | "driver" };

/** The signed-in staff member behind a request's Bearer token, or null. */
export async function staffFromRequest(req: Request, roles: StaffCaller["role"][]): Promise<StaffCaller | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const db = adminClient();
    const { data: user } = await db.auth.getUser(token);
    if (!user.user) return null;
    const { data: s } = await db.from("staff_users").select("shop_id, name, role").eq("auth_user_id", user.user.id).eq("is_active", true).maybeSingle();
    if (!s || !roles.includes(s.role)) return null;
    return { authUserId: user.user.id, shopId: s.shop_id, name: s.name, role: s.role };
  } catch {
    return null;
  }
}
