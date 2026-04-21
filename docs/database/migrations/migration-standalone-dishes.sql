-- Добавить флаг standalone в food_catalog
-- standalone = true: блюдо не требует гарнира (пельмени, макароны по-флотски, etc.)
-- При генерации обеда: standalone → main 80% + salad 20% (без side)

ALTER TABLE public.food_catalog
  ADD COLUMN IF NOT EXISTS standalone boolean NOT NULL DEFAULT false;

-- Пометить самостоятельные блюда из текущего каталога
UPDATE public.food_catalog SET standalone = true
WHERE name IN (
  'Пельмени со сметаной',
  'Макароны по-флотски',
  'Свинина с картошкой в духовке'
);
