-- Breakfast moves to the version 2 menu (TJCSR1-Menuversion-v2.pdf, 28 Nov 2026), "Collect" prices. Hand-written; safe to re-run.
--
-- Added:    F07 Turkey Bacon Breakfast Baguette £4.20, F08 Chicken Sausage Breakfast Baguette £4.20,
--           F09 Full Breakfast Box £5.95, F10 Breakfast Loaded Jacket £6.50
-- Changed:  F05 Beans on Toast £3.75 -> £3.50, now on buttered toast (adds Milk)
-- Removed:  F01 The Full Club, F02 Mini Breakfast, F03 Veggie Breakfast, F04 Breakfast Bap, F06 Cheese on Toast (never ordered)
-- Not yet:  the five breakfast rolls (the roll is a different bread; waiting for its supplier label) and the two hot-drink deals.
--
-- Allergens are built only from records already checked in this database:
--   turkey bacon = Sulphites; chicken sausage = Gluten, Sulphites; fried egg = Eggs; cheddar and butter = Milk;
--   baguette and toast = Gluten; beans and hash brown = none. The owner confirmed baguettes and toast are buttered.

-- 1. Remove the old breakfast items (their allergen and option links go with them).
delete from public.items i
using public.shops s
where s.id = i.shop_id and s.slug = 'the-jacket-club-sr1' and i.code in ('F01', 'F02', 'F03', 'F04', 'F06');

-- 2. New items.
insert into public.items (shop_id, category_id, code, name, description, price_pence, is_halal, is_available, sort)
select c.shop_id, c.id, v.code, v.name, v.description, v.pence, true, true, v.sort
from (values
  ('F07', 'Turkey Bacon Breakfast Baguette', 'Crispy halal turkey bacon in a freshly baked, buttered baguette.', 420, 60),
  ('F08', 'Chicken Sausage Breakfast Baguette', 'Three halal chicken sausages in a freshly baked, buttered baguette.', 420, 70),
  ('F09', 'Full Breakfast Box', 'Turkey bacon, chicken sausage, fried egg, beans, hash brown and buttered toast.', 595, 80),
  ('F10', 'Breakfast Loaded Jacket', 'Jacket loaded with butter, cheese, beans, turkey bacon and chicken sausage.', 650, 90)
) as v(code, name, description, pence, sort)
join public.shops s on s.slug = 'the-jacket-club-sr1'
join public.categories c on c.shop_id = s.id and c.name = 'Breakfast (all day)'
on conflict (shop_id, code) do nothing;

-- 3. Beans on Toast: new price and wording, last in the list as on the menu.
update public.items i
set price_pence = 350, description = 'Baked beans on two slices of buttered toast.', sort = 100
from public.shops s
where s.id = i.shop_id and s.slug = 'the-jacket-club-sr1' and i.code = 'F05';

-- 4. Allergens.
insert into public.item_allergens (item_id, allergen_id)
select i.id, a.id
from (values
  ('F07', 'Gluten'), ('F07', 'Milk'), ('F07', 'Sulphites'),
  ('F08', 'Gluten'), ('F08', 'Milk'), ('F08', 'Sulphites'),
  ('F09', 'Eggs'), ('F09', 'Gluten'), ('F09', 'Milk'), ('F09', 'Sulphites'),
  ('F10', 'Gluten'), ('F10', 'Milk'), ('F10', 'Sulphites'),
  ('F05', 'Milk')
) as v(code, allergen)
join public.shops s on s.slug = 'the-jacket-club-sr1'
join public.items i on i.shop_id = s.id and i.code = v.code
join public.allergens a on a.name = v.allergen
on conflict do nothing;

-- 5. Choices: sauces on the baguettes and the jacket; toast type and breakfast extras on the box (as Beans on Toast already has).
insert into public.item_option_groups (item_id, group_id, sort)
select i.id, g.id, v.sort
from (values
  ('F07', 'G_SAUCE', 10),
  ('F08', 'G_SAUCE', 10),
  ('F09', 'G_TOASTTYPE', 10),
  ('F09', 'G_BFEXTRA', 20),
  ('F10', 'G_SAUCE', 10)
) as v(item, grp, sort)
join public.shops s on s.slug = 'the-jacket-club-sr1'
join public.items i on i.shop_id = s.id and i.code = v.item
join public.option_groups g on g.shop_id = s.id and g.code = v.grp
on conflict (item_id, group_id) do update set sort = excluded.sort;
