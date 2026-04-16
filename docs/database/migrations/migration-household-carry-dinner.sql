-- Migration: move carry_dinner_to_lunch from personas to households
-- Настройка «переносить ужин на обед» становится общей для домохозяйства

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS carry_dinner_to_lunch boolean NOT NULL DEFAULT true;
