-- Food catalog: российские блюда с КБЖУ и ингредиентами
-- Источник: Таблицы химического состава продуктов (Скурихин, Тутельян)

CREATE TABLE IF NOT EXISTS public.food_catalog (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        text NOT NULL,
  kcal        numeric(6,1) NOT NULL DEFAULT 0,
  protein     numeric(5,1) NOT NULL DEFAULT 0,
  fat         numeric(5,1) NOT NULL DEFAULT 0,
  carbs       numeric(5,1) NOT NULL DEFAULT 0,
  category    text NOT NULL DEFAULT 'main', -- breakfast | main | side | salad | snack
  portion_default_g integer NOT NULL DEFAULT 150,
  cost_per_100g numeric(6,1) NOT NULL DEFAULT 0,
  ingredients jsonb NOT NULL DEFAULT '[]', -- [{"name":"...", "category":"meat|dairy|..."}]
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_catalog_fts_idx
  ON public.food_catalog USING gin(to_tsvector('russian', name));

CREATE INDEX IF NOT EXISTS food_catalog_category_idx
  ON public.food_catalog(category);

ALTER TABLE public.food_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "food_catalog_read" ON public.food_catalog;
CREATE POLICY "food_catalog_read" ON public.food_catalog
  FOR SELECT TO authenticated USING (true);
