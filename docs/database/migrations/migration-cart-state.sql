-- Migration: добавить таблицу cart_state
-- Выполнить в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cart_state (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  household_id    uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_label      text NOT NULL,
  ingredient_name text NOT NULL,
  price           numeric NOT NULL DEFAULT 0,
  is_checked      boolean NOT NULL DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (household_id, week_label, ingredient_name)
);

ALTER TABLE public.cart_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads cart"
  ON public.cart_state FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member upserts cart"
  ON public.cart_state FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member updates cart"
  ON public.cart_state FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member deletes cart"
  ON public.cart_state FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
