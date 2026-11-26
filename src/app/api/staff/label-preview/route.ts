import { SAMPLE_LABEL } from "@/lib/label";
import { labelPng } from "@/lib/server/label-image";
import { siteOrigin } from "@/lib/server/site-origin";
import { staffFromRequest } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

/** A sample label picture for the admin screen (owner or kitchen). */
export async function GET(req: Request) {
  if (!(await staffFromRequest(req, ["owner", "kitchen"]))) return new Response(null, { status: 401 });
  const png = await labelPng(SAMPLE_LABEL, siteOrigin(req));
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
