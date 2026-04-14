-- Миграция: переименование колонок food_catalog под стандарт _per_100g
-- Запускать ОДИН РАЗ в Supabase SQL Editor
-- После этого перезапустить pnpm dev

ALTER TABLE public.food_catalog RENAME COLUMN kcal    TO kcal_per_100g;
ALTER TABLE public.food_catalog RENAME COLUMN protein  TO protein_per_100g;
ALTER TABLE public.food_catalog RENAME COLUMN fat      TO fat_per_100g;
ALTER TABLE public.food_catalog RENAME COLUMN carbs    TO carbs_per_100g;
