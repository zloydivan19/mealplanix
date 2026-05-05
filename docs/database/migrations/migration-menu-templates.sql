-- Миграция: шаблоны меню
-- Запустить в Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.menu_templates (
  id           bigserial    PRIMARY KEY,
  household_id text         NOT NULL,
  created_by   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text         NOT NULL,
  slots        jsonb        NOT NULL DEFAULT '[]',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_templates_household
  ON public.menu_templates(household_id);

ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can select templates"
ON public.menu_templates FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "household members can insert templates"
ON public.menu_templates FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "creator can delete templates"
ON public.menu_templates FOR DELETE
USING (created_by = auth.uid());
