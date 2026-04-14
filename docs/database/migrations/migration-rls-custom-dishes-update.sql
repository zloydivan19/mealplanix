-- Добавить RLS политику UPDATE для custom_dishes
-- Запустить в Supabase SQL editor

CREATE POLICY "household members can update custom_dishes"
ON public.custom_dishes
FOR UPDATE
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

-- Также добавить DELETE если ещё не было
CREATE POLICY "household members can delete custom_dishes"
ON public.custom_dishes
FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);
