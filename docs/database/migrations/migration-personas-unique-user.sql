-- Migration: one main persona per user per household
-- Если в БД уже есть дубликаты (created via buggy settings form) — удаляем их,
-- оставляя самую старую персону (созданную на онбординге).

-- Шаг 1: удалить дубликаты, оставив самую старую персону (онбординг)
DELETE FROM public.personas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY household_id, user_id
             ORDER BY created_at ASC  -- оставляем первую (онбординг)
           ) AS rn
    FROM public.personas
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Шаг 2: создать partial unique index
-- Запрещает дубль главной персоны на уровне БД.
-- Локальные персоны (user_id = NULL) не ограничены.
CREATE UNIQUE INDEX IF NOT EXISTS personas_one_per_user_per_household
  ON public.personas (household_id, user_id)
  WHERE user_id IS NOT NULL;
