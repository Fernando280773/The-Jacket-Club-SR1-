import "server-only";
import { timingSafeEqual } from "node:crypto";
import { SHOP_SLUG } from "../supabase";
import { adminClient } from "./admin";

/**
 * Checks a label printer's sign-in (HTTP Basic: user = shop name in the web address, password = CLOUDPRNT_PASSWORD).
 * Returns the shop id, "off" when no password is set on the server, or null when the sign-in is wrong.
 */
export async function printerShop(req: Request): Promise<string | "off" | null> {
  const secret = process.env.CLOUDPRNT_PASSWORD;
  if (!secret || secret.length < 16) return "off";
  const header = req.headers.get("authorization") ?? "";
  if (!/^Basic\s+/i.test(header)) return null;
  let user = "";
  let pass = "";
  try {
    const decoded = Buffer.from(header.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
    const at = decoded.indexOf(":");
    if (at < 0) return null;
    user = decoded.slice(0, at);
    pass = decoded.slice(at + 1);
  } catch {
    return null;
  }
  const a = Buffer.from(pass);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b) || user !== SHOP_SLUG) return null;
  const { data } = await adminClient().from("shops").select("id").eq("slug", SHOP_SLUG).maybeSingle();
  return data?.id ?? null;
}

/** Queues an order's labels when it is paid. Never stops the order if printing has a problem. */
export async function queueOrderLabels(orderId: string): Promise<void> {
  try {
    const { error } = await adminClient().rpc("enqueue_order_labels", { p_order_id: orderId, p_reprint: false });
    if (error) console.error("labels: could not queue", orderId, error.message);
  } catch (e) {
    console.error("labels: could not queue", orderId, e);
  }
}
