-- Allergen fixes from supplier labels (see data/allergen-corrections.json).
-- Popcorn chicken (JJ CHI490): wheat, soya, celery. Used in H02 Popcorn Chicken and H05 Boneless Box.
insert into public.item_allergens (item_id, allergen_id)
select i.id, a.id
from public.items i
join public.allergens a on a.name in ('Soya', 'Celery')
where i.code in ('H02', 'H05')
on conflict do nothing;
