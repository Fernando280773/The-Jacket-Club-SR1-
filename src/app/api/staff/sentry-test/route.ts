import * as Sentry from "@sentry/nextjs";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/** Owner only: sends one test error to Sentry, to prove error alerts reach the owner's email. */
export async function POST(req: Request) {
  const owner = await staffFromRequest(req, ["owner"]);
  if (!owner) return Response.json({ ok: false }, { status: 401 });
  const id = Sentry.captureException(new Error(`Test error alert from admin (${new Date().toISOString()})`));
  const sent = await Sentry.flush(5000);
  return Response.json({ ok: sent, id });
}
