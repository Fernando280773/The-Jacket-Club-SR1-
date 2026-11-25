-- Allergen fixes from supplier labels (see data/allergen-corrections.json), checked 25 Nov 2026.
-- Chicken strips (JJ CHI264): wheat (gluten), milk, egg. Used in H03, H04 Strips, H05 Boneless Box and R05 Strips Rice Box.
-- Nuggets (JJ CHI870): wheat (gluten) only, already on H01 and K03; "may contain" traces are covered by the allergen page notice.
-- Oat milk (JJ DAI184 Alpro Barista Oat Gluten Free): oats are a cereal on the UK allergen list, so Gluten stays shown on the Oat option.
insert into public.item_allergens (item_id, allergen_id)
select i.id, a.id
from public.items i
join public.allergens a on a.name in ('Milk', 'Eggs')
where i.code in ('H03', 'H04', 'H05', 'R05')
on conflict do nothing;
