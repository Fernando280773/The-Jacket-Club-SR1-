import { publicClient, SHOP_SLUG } from "./supabase";

export type ShopStatus =
  | { ok: true; shopName: string; tableCount: number; bookableTables: number }
  | { ok: false; error: string };

/** Reads the shop and its tables live from Supabase, to prove the app and database are connected. */
export async function getShopStatus(): Promise<ShopStatus> {
  try {
    const db = publicClient();
    const { data: shop, error: shopError } = await db
      .from("shops")
      .select("id, name")
      .eq("slug", SHOP_SLUG)
      .single();
    if (shopError || !shop) return { ok: false, error: shopError?.message ?? "Shop not found" };

    const { data: tables, error: tableError } = await db
      .from("dining_tables")
      .select("id, is_bookable")
      .eq("shop_id", shop.id);
    if (tableError || !tables) return { ok: false, error: tableError?.message ?? "Tables not found" };

    return {
      ok: true,
      shopName: shop.name,
      tableCount: tables.length,
      bookableTables: tables.filter((t) => t.is_bookable).length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
