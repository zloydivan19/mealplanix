-- Исправление portion_default_g для холодных блюд (салаты)
-- Проблема: у холодных блюд ничего не усаживается при готовке,
-- поэтому сумма ингредиентов (г+мл) должна ≈ portion_default_g.
-- Горячие блюда (main, breakfast, side) не трогаем — там усадка норма.
-- Блюда с sum < 50г не трогаем — главный ингредиент записан в "шт" (яйца, фрукты).

-- ── 1. Исправить portion_default_g для всех салатов ─────────────────
UPDATE public.food_catalog
SET portion_default_g = (
  SELECT (ROUND(COALESCE(SUM((ing->>'qty')::numeric), 0) / 10) * 10)::integer
  FROM jsonb_array_elements(ingredients) AS ing
  WHERE (ing->>'unit') IN ('г', 'мл')
)
WHERE category = 'salad'
  AND (
    SELECT COALESCE(SUM((ing->>'qty')::numeric), 0)
    FROM jsonb_array_elements(ingredients) AS ing
    WHERE (ing->>'unit') IN ('г', 'мл')
  ) > 50   -- пропустить блюда где главный ингредиент в "шт"
  AND ABS(
    (SELECT COALESCE(SUM((ing->>'qty')::numeric), 0)
     FROM jsonb_array_elements(ingredients) AS ing
     WHERE (ing->>'unit') IN ('г', 'мл'))
    - portion_default_g
  ) / NULLIF(portion_default_g::numeric, 0) * 100 > 10;  -- только если расхождение > 10%

-- ── 2. Ряженка с грушей (id=112, snack, холодный) ───────────────────
-- sum=305г, portion=220г — холодный напиток с фруктом, усадки нет
UPDATE public.food_catalog
SET portion_default_g = 300
WHERE id = 112;

-- ── Проверка после обновления ────────────────────────────────────────
SELECT
  id,
  name,
  category,
  portion_default_g,
  ROUND((
    SELECT COALESCE(SUM((ing->>'qty')::numeric), 0)
    FROM jsonb_array_elements(ingredients) AS ing
    WHERE (ing->>'unit') IN ('г', 'мл')
  )::numeric, 0) AS ing_sum_g,
  ROUND(ABS(
    (SELECT COALESCE(SUM((ing->>'qty')::numeric), 0)
     FROM jsonb_array_elements(ingredients) AS ing
     WHERE (ing->>'unit') IN ('г', 'мл'))
    - portion_default_g
  ) / NULLIF(portion_default_g::numeric, 0) * 100, 1) AS diff_pct_after
FROM public.food_catalog
WHERE id IN (
  32, 35, 36, 52, 108, 109, 111, 112, 151, 152, 156, 159, 160, 161,
  162, 164, 165, 166, 167, 169, 170, 171, 172, 178, 179, 180, 183
)
ORDER BY diff_pct_after DESC;
