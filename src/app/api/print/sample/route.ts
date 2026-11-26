import { SAMPLE_LABEL } from "@/lib/label";
import { labelPng } from "@/lib/server/label-image";
import { siteOrigin } from "@/lib/server/site-origin";

export const dynamic = "force-dynamic";

/** The sample label, for checking the design on draft sites. Not available on the live site. */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === "production") return new Response(null, { status: 404 });
  const q = new URL(req.url).searchParams;
  const label = { ...SAMPLE_LABEL, staffTest: q.get("test") === "1", type: q.get("type") === "delivery" ? ("delivery" as const) : SAMPLE_LABEL.type };
  const png = await labelPng(label, siteOrigin(req));
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
