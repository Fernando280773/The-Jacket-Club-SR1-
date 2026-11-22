import { SHOP_SLUG } from "../supabase";
import { adminClient } from "./admin";

/** The table a QR code belongs to. QR tokens are not readable from the browser. */
export async function tableForToken(token: string): Promise<{ id: string; number: number; shopId: string } | null> {
  if (!/^[0-9a-f]{8,64}$/.test(token)) return null;
  const { data } = await adminClient()
    .from("dining_tables")
    .select("id, number, shop_id, shops!inner(slug)")
    .eq("qr_token", token)
    .eq("shops.slug", SHOP_SLUG)
    .maybeSingle();
  return data ? { id: data.id, number: data.number, shopId: data.shop_id } : null;
}
