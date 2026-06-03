-- V5-100: Мобильный режим покупок
-- Добавляет поля для отслеживания последней закупки

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS last_shopped_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_shopped_total_rub numeric,
  ADD COLUMN IF NOT EXISTS last_shopped_items     integer;

COMMENT ON COLUMN public.households.last_shopped_at        IS 'Дата последней завершённой закупки через shopping mode';
COMMENT ON COLUMN public.households.last_shopped_total_rub IS 'Сумма последней закупки в рублях';
COMMENT ON COLUMN public.households.last_shopped_items     IS 'Количество купленных позиций';

-- Проверка
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'households'
  AND column_name LIKE 'last_shopped%';
