import { parseLabel } from "@/lib/label";
import { adminClient } from "@/lib/server/admin";
import { labelPng } from "@/lib/server/label-image";
import { printerShop } from "@/lib/server/print";
import { siteOrigin } from "@/lib/server/site-origin";

export const dynamic = "force-dynamic";

// Star CloudPRNT: the label printer calls this address every few seconds.
//   POST   "anything for me?"      -> { jobReady, mediaTypes }
//   GET    "give me the job"       -> the label as a PNG picture
//   DELETE "printed" (or failed)   -> the job is marked done
// The printer signs in with HTTP Basic (see printerShop). No customer or staff login can use this.

const refuse = (status: number) => new Response(null, { status, headers: status === 401 ? { "WWW-Authenticate": 'Basic realm="printer"' } : {} });
const macOf = (v: unknown) => (typeof v === "string" ? v.slice(0, 40) : "unknown");

async function shopFor(req: Request): Promise<string | Response> {
  const shop = await printerShop(req);
  if (shop === "off") return refuse(503);
  if (!shop) return refuse(401);
  return shop;
}

export async function POST(req: Request) {
  const shop = await shopFor(req);
  if (shop instanceof Response) return shop;
  const body = (await req.json().catch(() => ({}))) as { printerMAC?: unknown; statusCode?: unknown };
  const status = typeof body.statusCode === "string" ? decodeURIComponent(body.statusCode).slice(0, 80) : null;
  const { data, error } = await adminClient().rpc("printer_poll", { p_shop_id: shop, p_mac: macOf(body.printerMAC), p_status: status });
  if (error) return Response.json({ jobReady: false });
  return Response.json(data ? { jobReady: true, mediaTypes: ["image/png"], deleteMethod: "DELETE" } : { jobReady: false });
}

export async function GET(req: Request) {
  const shop = await shopFor(req);
  if (shop instanceof Response) return shop;
  const mac = macOf(new URL(req.url).searchParams.get("mac"));
  const { data } = await adminClient().rpc("claim_print_job", { p_shop_id: shop, p_mac: mac });
  const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; label: unknown } | undefined;
  const label = row ? parseLabel(row.label) : null;
  if (!row || !label) return refuse(404);
  try {
    const png = await labelPng(label, siteOrigin(req));
    return new Response(png, { headers: { "Content-Type": "image/png", "Content-Length": String(png.byteLength), "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("labels: could not draw", row.job_id, e);
    await adminClient().rpc("finish_print_job", { p_shop_id: shop, p_mac: mac, p_ok: false });
    return refuse(500);
  }
}

export async function DELETE(req: Request) {
  const shop = await shopFor(req);
  if (shop instanceof Response) return shop;
  const q = new URL(req.url).searchParams;
  // "200 OK" (or any 2xx) means it printed.
  const ok = /^2\d\d/.test(decodeURIComponent(q.get("code") ?? ""));
  await adminClient().rpc("finish_print_job", { p_shop_id: shop, p_mac: macOf(q.get("mac")), p_ok: ok });
  return new Response(null, { status: 200 });
}
