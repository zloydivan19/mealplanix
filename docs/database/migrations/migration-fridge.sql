-- Миграция: таблица холодильника
-- Запустить в Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.household_fridge (
  id           bigserial PRIMARY KEY,
  household_id text        NOT NULL,
  product_name text        NOT NULL,
  qty          numeric     NOT NULL DEFAULT 0,
  unit         text        NOT NULL DEFAULT 'г',
  expires_at   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Индекс для быстрой выборки по домохозяйству
CREATE INDEX IF NOT EXISTS idx_household_fridge_household
  ON public.household_fridge(household_id);

-- RLS
ALTER TABLE public.household_fridge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can select fridge"
ON public.household_fridge FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "household members can insert fridge"
ON public.household_fridge FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "household members can update fridge"
ON public.household_fridge FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "household members can delete fridge"
ON public.household_fridge FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);
