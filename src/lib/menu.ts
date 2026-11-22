import { publicClient, SHOP_SLUG } from "./supabase";
import type { DayHours } from "./opening";

export type Allergen = { id: number; name: string };

export type OptionControl = "pick_one" | "tick_boxes" | "counter";

export type MenuOption = {
  id: string;
  name: string;
  priceChangePence: number;
  isAvailable: boolean;
  allergens: Allergen[];
};

export type OptionGroup = {
  code: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  control: OptionControl;
  options: MenuOption[];
};

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
  /** Option groups shown in the item pop-up, in order. */
  groupCodes: string[];
};

export type MenuCategory = { name: string; slug: string; items: MenuItem[] };

export type Menu = {
  shopName: string;
  address: string;
  hours: DayHours[];
  categories: MenuCategory[];
  featured: MenuItem[];
  allergens: Allergen[];
  groups: Record<string, OptionGroup>;
  /** Smallest delivery order before the delivery fee, in pence. */
  deliveryMinPence: number;
  /** False when the owner has paused online ordering in admin. */
  acceptingOrders: boolean;
  /** Shown to customers while ordering is paused, e.g. "Back at 2pm". */
  pausedMessage: string | null;
};

export type MenuResult = { ok: true; menu: Menu } | { ok: false; error: string };

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type AllergenLink = { allergens: Allergen | null };
const toAllergens = (links: AllergenLink[] | null | undefined) =>
  (links ?? [])
    .map((l) => l.allergens)
    .filter((a): a is Allergen => a !== null)
    .sort((a, b) => a.id - b.id);

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
  item_allergens: AllergenLink[];
  item_option_groups: { sort: number; option_groups: { code: string } | null }[];
};

type GroupRow = {
  code: string;
  name: string;
  is_required: boolean;
  min_choices: number;
  max_choices: number;
  control: OptionControl;
  options: {
    id: string;
    name: string;
    price_change_pence: number;
    is_available: boolean;
    sort: number;
    option_allergens: AllergenLink[];
  }[];
};

const settingsOf = (s: unknown) =>
  (Array.isArray(s) ? s[0] : s) as { delivery_min_order_pence: number; is_accepting_orders: boolean; paused_message: string | null } | undefined;

/** Reads the whole menu for the shop from Supabase in four queries. `fresh` skips any cached copy (basket and checkout). */
export async function getMenu(opts: { fresh?: boolean } = {}): Promise<MenuResult> {
  try {
    const db = publicClient(opts);
    const { data: shop, error: shopError } = await db
      .from("shops")
      .select("id, name, address, postcode, opening_hours(iso_day, opens, closes), shop_settings(delivery_min_order_pence, is_accepting_orders, paused_message)")
      .eq("slug", SHOP_SLUG)
      .single();
    if (shopError || !shop) return { ok: false, error: shopError?.message ?? "Shop not found" };

    const [cats, allergens, groupRows] = await Promise.all([
      db
        .from("categories")
        .select(
          "name, sort, items(code, name, description, price_pence, is_halal, is_available, is_featured, photo_url, sort, item_allergens(allergens(id, name)), item_option_groups(sort, option_groups(code)))",
        )
        .eq("shop_id", shop.id)
        .order("sort"),
      db.from("allergens").select("id, name").order("id"),
      db
        .from("option_groups")
        .select(
          "code, name, is_required, min_choices, max_choices, control, options(id, name, price_change_pence, is_available, sort, option_allergens(allergens(id, name)))",
        )
        .eq("shop_id", shop.id),
    ]);
    if (cats.error) return { ok: false, error: cats.error.message };
    if (allergens.error) return { ok: false, error: allergens.error.message };
    if (groupRows.error) return { ok: false, error: groupRows.error.message };

    const groups: Record<string, OptionGroup> = {};
    for (const g of (groupRows.data ?? []) as unknown as GroupRow[]) {
      groups[g.code] = {
        code: g.code,
        name: g.name,
        required: g.is_required,
        min: g.min_choices,
        max: g.max_choices,
        control: g.control,
        options: [...g.options]
          .sort((a, b) => a.sort - b.sort)
          .map((o) => ({
            id: o.id,
            name: o.name,
            priceChangePence: o.price_change_pence,
            isAvailable: o.is_available,
            allergens: toAllergens(o.option_allergens),
          })),
      };
    }

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
          allergens: toAllergens(i.item_allergens),
          groupCodes: [...i.item_option_groups]
            .sort((a, b) => a.sort - b.sort)
            .map((l) => l.option_groups?.code)
            .filter((code): code is string => !!code && code in groups),
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
        groups,
        deliveryMinPence: settingsOf(shop.shop_settings)?.delivery_min_order_pence ?? 1200,
        acceptingOrders: settingsOf(shop.shop_settings)?.is_accepting_orders ?? true,
        pausedMessage: settingsOf(shop.shop_settings)?.paused_message ?? null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
