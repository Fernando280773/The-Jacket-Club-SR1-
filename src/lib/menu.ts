import { publicClient, SHOP_SLUG } from "./supabase";
import type { DayHours } from "./opening";

export type Allergen = { id: number; name: string };

export type MenuItem = {
  code: string;
  name: string;
  description: string | null;
  pricePence: number;
  isHalal: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  photoUrl: string | null;
  allergens: Allergen[];
};

export type MenuCategory = { name: string; slug: string; items: MenuItem[] };

export type Menu = {
  shopName: string;
  address: string;
  hours: DayHours[];
  categories: MenuCategory[];
  featured: MenuItem[];
  allergens: Allergen[];
};

export type MenuResult = { ok: true; menu: Menu } | { ok: false; error: string };

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type ItemRow = {
  code: string;
  name: string;
  description: string | null;
  price_pence: number;
  is_halal: boolean;
  is_available: boolean;
  is_featured: boolean;
  photo_url: string | null;
  sort: number;
  item_allergens: { allergens: Allergen | null }[];
};

/** Reads the whole menu for the shop from Supabase in three queries. */
export async function getMenu(): Promise<MenuResult> {
  try {
    const db = publicClient();
    const { data: shop, error: shopError } = await db
      .from("shops")
      .select("id, name, address, postcode, opening_hours(iso_day, opens, closes)")
      .eq("slug", SHOP_SLUG)
      .single();
    if (shopError || !shop) return { ok: false, error: shopError?.message ?? "Shop not found" };

    const [cats, allergens] = await Promise.all([
      db
        .from("categories")
        .select(
          "name, sort, items(code, name, description, price_pence, is_halal, is_available, is_featured, photo_url, sort, item_allergens(allergens(id, name)))",
        )
        .eq("shop_id", shop.id)
        .order("sort"),
      db.from("allergens").select("id, name").order("id"),
    ]);
    if (cats.error) return { ok: false, error: cats.error.message };
    if (allergens.error) return { ok: false, error: allergens.error.message };

    const categories: MenuCategory[] = (cats.data ?? []).map((c) => ({
      name: c.name,
      slug: slugify(c.name),
      items: ((c.items ?? []) as unknown as ItemRow[])
        .sort((a, b) => a.sort - b.sort)
        .map((i) => ({
          code: i.code,
          name: i.name,
          description: i.description,
          pricePence: i.price_pence,
          isHalal: i.is_halal,
          isAvailable: i.is_available,
          isFeatured: i.is_featured,
          photoUrl: i.photo_url,
          allergens: i.item_allergens
            .map((ia) => ia.allergens)
            .filter((a): a is Allergen => a !== null)
            .sort((a, b) => a.id - b.id),
        })),
    }));

    return {
      ok: true,
      menu: {
        shopName: shop.name,
        address: `${shop.address} ${shop.postcode}`,
        hours: (shop.opening_hours ?? []) as DayHours[],
        categories,
        featured: categories.flatMap((c) => c.items).filter((i) => i.isFeatured),
        allergens: allergens.data ?? [],
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
