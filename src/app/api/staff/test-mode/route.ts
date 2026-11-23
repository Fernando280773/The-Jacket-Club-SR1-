import { cookies } from "next/headers";
import { staffFromRequest } from "@/lib/server/staff-auth";
import { STAFF_TEST_COOKIE, staffTestActive } from "@/lib/server/staff-test";

export const dynamic = "force-dynamic";

/** Is staff test mode on in this browser? */
export async function GET() {
  return Response.json({ on: await staffTestActive() });
}

/** Owner only: turn staff test mode on in this browser. */
export async function POST(req: Request) {
  const owner = await staffFromRequest(req, ["owner"]);
  if (!owner) return Response.json({ ok: false }, { status: 401 });
  const token = req.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
  (await cookies()).set(STAFF_TEST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  return Response.json({ ok: true });
}

/** Turn it off. */
export async function DELETE() {
  (await cookies()).delete(STAFF_TEST_COOKIE);
  return Response.json({ ok: true });
}
