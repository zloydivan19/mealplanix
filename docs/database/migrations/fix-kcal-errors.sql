-- Исправление kcal_per_100g для 2 блюд с расхождением >8%
-- Источник истины: protein/fat/carbs (из таблиц Скурихина)
-- kcal = protein×4 + fat×9 + carbs×4

UPDATE public.food_catalog
SET kcal_per_100g = ROUND((protein_per_100g * 4 + fat_per_100g * 9 + carbs_per_100g * 4)::numeric, 1)
WHERE id IN (73, 27);

-- Проверка после обновления:
SELECT id, name, kcal_per_100g,
  ROUND((protein_per_100g * 4 + fat_per_100g * 9 + carbs_per_100g * 4)::numeric, 1) AS kcal_calc
FROM public.food_catalog
WHERE id IN (73, 27);
