-- Launch menu additions, from Launch-Menu-Master.xlsx / Launch-Menu.pdf (24 Nov 2026). Hand-written (see scripts/build-menu-migration.mjs:
-- the database is the master for prices, so a full sync is not re-run). Safe to re-run. No existing price changes: all 68 items already match.
--
--   J11 Butter Jacket £3.50
--   Jacket upgrades (new group G_JMEAL, replaces G_MEAL on jackets only): can +£1.00 (new), can + side salad +£2.50, can + fries +£3.00
--   X10 Build Your Own Loaded Fries £4.95
--   X08 Regular Sauce Pot (2 oz) £1.00, X09 Large Sauce Pot (4 oz) £2.00
--
-- Allergens: only ones already checked and held in this database are used (same fillings and sauces as the jackets, wraps and dips).
-- Mayo, peri peri and hot sauce are on the printed menu for sauce pots but have no checked allergen record yet, so they are NOT added here.

-- 1. Option groups
insert into public.option_groups (shop_id, code, name, is_required, min_choices, max_choices, control)
select s.id, v.code, v.name, v.req, v.min, v.max, v.control::public.option_control
from (values
  ('G_JMEAL', 'Jacket upgrades', false, 0, 1, 'pick_one'),
  ('G_SAUCEPOT', 'Choose your sauce', true, 1, 1, 'pick_one'),
  ('G_FRIESMEAT', 'Choose your filling', true, 1, 1, 'pick_one'),
  ('G_FRIESTOP', 'Salad and jalapeños', false, 0, 5, 'tick_boxes')
) as v(code, name, req, min, max, control)
cross join public.shops s
where s.slug = 'the-jacket-club-sr1'
on conflict (shop_id, code) do update set name = excluded.name, is_required = excluded.is_required,
  min_choices = excluded.min_choices, max_choices = excluded.max_choices, control = excluded.control;

-- 2. Options
insert into public.options (shop_id, group_id, name, price_change_pence, sort)
select g.shop_id, g.id, v.name, v.pence, v.sort
from (values
  ('G_JMEAL', 'Add a 330 ml can', 100, 10),
  ('G_JMEAL', 'Add a can and side salad', 250, 20),
  ('G_JMEAL', 'Add a can and fries', 300, 30),
  ('G_SAUCEPOT', 'Garlic mayo', 0, 10),
  ('G_SAUCEPOT', 'Chilli', 0, 20),
  ('G_SAUCEPOT', 'Sweet chilli', 0, 30),
  ('G_SAUCEPOT', 'BBQ', 0, 40),
  ('G_SAUCEPOT', 'Ketchup', 0, 50),
  ('G_SAUCEPOT', 'Burger sauce', 0, 60),
  ('G_FRIESMEAT', 'Beef chilli', 0, 10),
  ('G_FRIESMEAT', 'BBQ pulled chicken', 0, 20),
  ('G_FRIESMEAT', 'Chicken tikka', 0, 30),
  ('G_FRIESTOP', 'Lettuce', 0, 10),
  ('G_FRIESTOP', 'Tomato', 0, 20),
  ('G_FRIESTOP', 'Cucumber', 0, 30),
  ('G_FRIESTOP', 'Red onion', 0, 40),
  ('G_FRIESTOP', 'Jalapeños', 0, 50)
) as v(grp, name, pence, sort)
join public.option_groups g on g.code = v.grp
join public.shops s on s.id = g.shop_id and s.slug = 'the-jacket-club-sr1'
on conflict (group_id, name) do update set price_change_pence = excluded.price_change_pence, sort = excluded.sort;

-- 3. Option allergens, copied from the same filling or sauce where it is already on the menu.
insert into public.option_allergens (option_id, allergen_id)
select n.id, oa.allergen_id
from (values
  ('G_SAUCEPOT', 'Garlic mayo', 'G_DIP', 'Garlic mayo'),
  ('G_SAUCEPOT', 'Chilli', 'G_SAUCE', 'Chilli sauce'),
  ('G_SAUCEPOT', 'Sweet chilli', 'G_DIP', 'Sweet chilli'),
  ('G_SAUCEPOT', 'BBQ', 'G_DIP', 'BBQ'),
  ('G_SAUCEPOT', 'Ketchup', 'G_DIP', 'Ketchup'),
  ('G_SAUCEPOT', 'Burger sauce', 'G_DIP', 'Burger sauce'),
  ('G_FRIESMEAT', 'Beef chilli', 'G_JFILL2', 'Beef chilli'),
  ('G_FRIESMEAT', 'BBQ pulled chicken', 'G_JFILL2', 'BBQ pulled chicken'),
  ('G_FRIESMEAT', 'Chicken tikka', 'G_JFILL2', 'Chicken tikka'),
  ('G_FRIESTOP', 'Jalapeños', 'G_EXTRA', 'Jalapeños')
) as v(new_grp, new_name, src_grp, src_name)
join public.option_groups ng on ng.code = v.new_grp
join public.options n on n.group_id = ng.id and n.name = v.new_name
join public.option_groups sg on sg.code = v.src_grp and sg.shop_id = ng.shop_id
join public.options so on so.group_id = sg.id and so.name = v.src_name
join public.option_allergens oa on oa.option_id = so.id
on conflict do nothing;

-- 4. Items
insert into public.items (shop_id, category_id, code, name, description, price_pence, is_halal, is_available, sort)
select c.shop_id, c.id, v.code, v.name, v.description, v.pence, true, true, v.sort
from (values
  ('Jackets', 'J11', 'Butter Jacket', 'Oven-baked potato with butter.', 350, 5),
  ('Sides', 'X10', 'Build Your Own Loaded Fries', 'Fries with melted cheese and your choice of beef chilli, BBQ pulled chicken or chicken tikka. Add lettuce, tomato, cucumber, red onion or jalapeños.', 495, 35),
  ('Sides', 'X08', 'Regular Sauce Pot (2 oz)', 'Choose garlic mayo, chilli, sweet chilli, BBQ, ketchup or burger sauce.', 100, 80),
  ('Sides', 'X09', 'Large Sauce Pot (4 oz)', 'Choose any of the same six sauces.', 200, 90)
) as v(category, code, name, description, pence, sort)
join public.shops s on s.slug = 'the-jacket-club-sr1'
join public.categories c on c.shop_id = s.id and c.name = v.category
on conflict (shop_id, code) do nothing;

-- 5. Item allergens: butter and melted cheese are milk.
insert into public.item_allergens (item_id, allergen_id)
select i.id, a.id
from public.items i
join public.allergens a on a.name = 'Milk'
where i.code in ('J11', 'X10')
on conflict do nothing;

-- 6. Which choices each new item offers.
insert into public.item_option_groups (item_id, group_id, sort)
select i.id, g.id, v.sort
from (values
  ('J11', 'G_JMEAL', 10),
  ('X08', 'G_SAUCEPOT', 10),
  ('X09', 'G_SAUCEPOT', 10),
  ('X10', 'G_FRIESMEAT', 10),
  ('X10', 'G_FRIESTOP', 20)
) as v(item, grp, sort)
join public.items i on i.code = v.item
join public.option_groups g on g.code = v.grp and g.shop_id = i.shop_id
on conflict (item_id, group_id) do update set sort = excluded.sort;

-- 7. Jackets J01 to J10: swap "Make it a meal" (G_MEAL) for "Jacket upgrades" (G_JMEAL), keeping its place in the list. Wraps keep G_MEAL.
insert into public.item_option_groups (item_id, group_id, sort)
select l.item_id, j.id, l.sort
from public.item_option_groups l
join public.option_groups m on m.id = l.group_id and m.code = 'G_MEAL'
join public.items i on i.id = l.item_id and i.code like 'J%'
join public.option_groups j on j.code = 'G_JMEAL' and j.shop_id = i.shop_id
on conflict (item_id, group_id) do nothing;

delete from public.item_option_groups l
using public.option_groups m, public.items i
where m.id = l.group_id and m.code = 'G_MEAL' and i.id = l.item_id and i.code like 'J%';
