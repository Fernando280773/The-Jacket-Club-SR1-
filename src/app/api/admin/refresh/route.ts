import { revalidatePath } from "next/cache";
import { staffFromRequest } from "@/lib/server/staff-auth";

/**
 * Called by the admin after a change, so the menu page shows it straight away instead of within a minute.
 * Only signed-in staff can trigger it; it changes nothing itself.
 */
export async function POST(req: Request) {
  const staff = await staffFromRequest(req, ["owner", "kitchen"]);
  if (!staff) return Response.json({ ok: false }, { status: 401 });
  revalidatePath("/");
  revalidatePath("/allergens");
  return Response.json({ ok: true });
}
