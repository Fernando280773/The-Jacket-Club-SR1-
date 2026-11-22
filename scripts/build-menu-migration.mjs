// Turns data/menu.json (a snapshot of the Menu Sheet) into the menu seed migration.
// Run: node scripts/build-menu-migration.mjs  (a unit test checks the committed file matches).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MIGRATION_PATH = path.join(root, "supabase/migrations/20261122070100_seed_menu.sql");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const SHOP = "(select id from public.shops where slug = 'the-jacket-club-sr1')";

export function buildMenuSql(menu) {
  const out = [];
  out.push(`-- Menu seed generated from data/menu.json (${menu.source}).`);
  out.push("-- Do not edit by hand: change data/menu.json and run node scripts/build-menu-migration.mjs.");
  out.push("");

  out.push("insert into public.categories (shop_id, name, sort) values");
  out.push(menu.categories.map((c, i) => `  (${SHOP}, ${q(c)}, ${(i + 1) * 10})`).join(",\n") + ";");
  out.push("");

  out.push("insert into public.option_groups (shop_id, code, name, is_required, min_choices, max_choices, control) values");
  out.push(
    menu.option_groups
      .map((g) => `  (${SHOP}, ${q(g.code)}, ${q(g.name)}, ${g.required}, ${g.min}, ${g.max}, ${q(g.control)})`)
      .join(",\n") + ";",
  );
  out.push("");

  const sortInGroup = {};
  out.push("insert into public.options (shop_id, group_id, name, price_change_pence, sort)");
  out.push("select s.id, g.id, v.name, v.pence, v.sort from (values");
  out.push(
    menu.options
      .map((o) => {
        sortInGroup[o.group] = (sortInGroup[o.group] ?? 0) + 10;
        return `  (${q(o.group)}, ${q(o.name)}, ${o.price_change_pence}, ${sortInGroup[o.group]})`;
      })
      .join(",\n"),
  );
  out.push(") as v(code, name, pence, sort)");
  out.push(`cross join ${SHOP} as s(id)`);
  out.push("join public.option_groups g on g.code = v.code and g.shop_id = s.id;");
  out.push("");

  const sortInCat = {};
  out.push("insert into public.items (shop_id, category_id, code, name, description, price_pence, is_halal, is_available, is_featured, sort)");
  out.push("select c.shop_id, c.id, v.code, v.name, v.description, v.pence, v.halal, v.available, v.featured, v.sort from (values");
  out.push(
    menu.items
      .map((it) => {
        sortInCat[it.category] = (sortInCat[it.category] ?? 0) + 10;
        const featured = menu.featured.includes(it.code);
        return `  (${q(it.category)}, ${q(it.code)}, ${q(it.name)}, ${q(it.description)}, ${it.price_pence}, ${it.halal}, ${it.available}, ${featured}, ${sortInCat[it.category]})`;
      })
      .join(",\n"),
  );
  out.push(") as v(category, code, name, description, pence, halal, available, featured, sort)");
  out.push(`join public.categories c on c.name = v.category and c.shop_id = ${SHOP};`);
  out.push("");

  const links = menu.items.flatMap((it) => it.option_groups.map((g, i) => `  (${q(it.code)}, ${q(g)}, ${(i + 1) * 10})`));
  out.push("insert into public.item_option_groups (item_id, group_id, sort)");
  out.push("select i.id, g.id, v.sort from (values");
  out.push(links.join(",\n"));
  out.push(") as v(item_code, group_code, sort)");
  out.push(`join public.items i on i.code = v.item_code and i.shop_id = ${SHOP}`);
  out.push("join public.option_groups g on g.code = v.group_code and g.shop_id = i.shop_id;");
  out.push("");

  const itemAllergens = menu.items.flatMap((it) => it.allergens.map((a) => `  (${q(it.code)}, ${q(a)})`));
  out.push("insert into public.item_allergens (item_id, allergen_id)");
  out.push("select i.id, a.id from (values");
  out.push(itemAllergens.join(",\n"));
  out.push(") as v(item_code, allergen)");
  out.push(`join public.items i on i.code = v.item_code and i.shop_id = ${SHOP}`);
  out.push("join public.allergens a on a.name = v.allergen;");
  out.push("");

  const optionAllergens = menu.options.flatMap((o) => o.allergens.map((a) => `  (${q(o.group)}, ${q(o.name)}, ${q(a)})`));
  out.push("insert into public.option_allergens (option_id, allergen_id)");
  out.push("select o.id, a.id from (values");
  out.push(optionAllergens.join(",\n"));
  out.push(") as v(group_code, option_name, allergen)");
  out.push(`join public.option_groups g on g.code = v.group_code and g.shop_id = ${SHOP}`);
  out.push("join public.options o on o.group_id = g.id and o.name = v.option_name");
  out.push("join public.allergens a on a.name = v.allergen;");
  out.push("");
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const menu = JSON.parse(readFileSync(path.join(root, "data/menu.json"), "utf8"));
  writeFileSync(MIGRATION_PATH, buildMenuSql(menu));
  console.log(`Wrote ${path.relative(root, MIGRATION_PATH)}`);
}
