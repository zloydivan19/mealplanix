-- Migration: one main persona per user per household
-- Запретить создание второй персоны с user_id IS NOT NULL для одного пользователя
-- в одном домохозяйстве. Локальные персоны (user_id = NULL) не ограничены.

CREATE UNIQUE INDEX IF NOT EXISTS personas_one_per_user_per_household
  ON public.personas (household_id, user_id)
  WHERE user_id IS NOT NULL;
