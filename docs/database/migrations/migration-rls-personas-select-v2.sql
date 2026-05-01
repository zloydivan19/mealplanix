-- personas SELECT: разрешить читать персоны из:
-- 1. Активного хозяйства пользователя
-- 2. Личного хозяйства пользователя (если вступил в чужое)
-- 3. Личных хозяйств участников, вступивших в твоё хозяйство (чтобы владелец видел их персоны)
-- Работает без рекурсии т.к. household_members имеет USING (true)

DROP POLICY IF EXISTS "personas_select" ON public.personas;

CREATE POLICY "personas_select"
  ON public.personas
  FOR SELECT
  TO authenticated
  USING (
    -- Активное хозяйство
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
    OR
    -- Личное хозяйство (если вступил в чужое)
    household_id IN (
      SELECT own_household_id FROM household_members WHERE user_id = auth.uid()
    )
    OR
    -- Личные хозяйства участников моего хозяйства (гости)
    household_id IN (
      SELECT m2.own_household_id
      FROM household_members m1
      JOIN household_members m2 ON m2.household_id = m1.household_id
      WHERE m1.user_id = auth.uid()
        AND m2.own_household_id != m2.household_id
    )
  );
