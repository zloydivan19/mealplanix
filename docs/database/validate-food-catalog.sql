-- ══════════════════════════════════════════════════════════════
-- Валидация food_catalog
-- Запускай в Supabase SQL Editor → Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════


-- ── 1. Проверка формулы КБЖУ ─────────────────────────────────
-- P×4 + F×9 + C×4 должно быть в пределах ±8% от kcal_per_100g

SELECT
  id,
  name,
  category,
  kcal_per_100g                                                          AS kcal_db,
  ROUND((protein_per_100g * 4 + fat_per_100g * 9 + carbs_per_100g * 4)::numeric, 1)
                                                                         AS kcal_calc,
  ROUND(ABS(kcal_per_100g - (protein_per_100g * 4 + fat_per_100g * 9 + carbs_per_100g * 4))
        / NULLIF(kcal_per_100g, 0) * 100, 1)                            AS error_pct
FROM public.food_catalog
WHERE
  ABS(kcal_per_100g - (protein_per_100g * 4 + fat_per_100g * 9 + carbs_per_100g * 4))
  / NULLIF(kcal_per_100g, 0) * 100 > 8
ORDER BY error_pct DESC;


-- ── 2. Проверка суммы ингредиентов vs порция ─────────────────
-- Считаем только г и мл. щепотка/шт не суммируются.
-- Для горячих блюд (main, breakfast) допуск ±40% (усадка при готовке)
-- Для холодных (salad, snack, side) допуск ±15%

WITH sums AS (
  SELECT
    id,
    name,
    category,
    portion_default_g,
    ROUND((
      SELECT COALESCE(SUM((ing->>'qty')::numeric), 0)
      FROM jsonb_array_elements(ingredients) AS ing
      WHERE ing->>'unit' IN ('г', 'мл')
    )::numeric, 0)                                                       AS ing_sum_g
  FROM public.food_catalog
),
checked AS (
  SELECT
    *,
    ing_sum_g - portion_default_g                                        AS diff_g,
    ROUND(ABS(ing_sum_g - portion_default_g)
          / NULLIF(portion_default_g, 0) * 100, 1)                      AS diff_pct,
    CASE
      WHEN category IN ('salad', 'snack') THEN 15
      ELSE 40
    END                                                                  AS tolerance_pct
  FROM sums
)
SELECT
  id,
  name,
  category,
  portion_default_g,
  ing_sum_g,
  diff_g,
  diff_pct,
  tolerance_pct,
  CASE WHEN diff_pct > tolerance_pct THEN '❌ ОШИБКА' ELSE '✅ OK' END  AS status
FROM checked
ORDER BY status DESC, diff_pct DESC;
