-- menu_plans RLS: только владелец персоны может писать/удалять планы
-- SELECT разрешён для любой доступной персоны (через personas_select policy)
-- INSERT/UPDATE/DELETE — только для персон из собственного хозяйства (own_household_id)

-- Удаляем старые политики (названия могут варьироваться)
DROP POLICY IF EXISTS "menu_plans_select" ON public.menu_plans;
DROP POLICY IF EXISTS "menu_plans_insert" ON public.menu_plans;
DROP POLICY IF EXISTS "menu_plans_update" ON public.menu_plans;
DROP POLICY IF EXISTS "menu_plans_delete" ON public.menu_plans;
DROP POLICY IF EXISTS "Users can manage their own menu plans" ON public.menu_plans;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.menu_plans;

-- SELECT: видим планы для любой персоны, которую видим через personas_select
CREATE POLICY "menu_plans_select"
  ON public.menu_plans
  FOR SELECT
  TO authenticated
  USING (
    persona_id IN (
      SELECT id FROM public.personas
      WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
      OR household_id IN (
        SELECT own_household_id FROM household_members WHERE user_id = auth.uid()
      )
      OR household_id IN (
        SELECT m2.own_household_id
        FROM household_members m1
        JOIN household_members m2 ON m2.household_id = m1.household_id
        WHERE m1.user_id = auth.uid()
          AND m2.own_household_id != m2.household_id
      )
    )
  );

-- INSERT: только в персоны собственного хозяйства
CREATE POLICY "menu_plans_insert"
  ON public.menu_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    persona_id IN (
      SELECT id FROM public.personas
      WHERE household_id = (
        SELECT own_household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE: только в персоны собственного хозяйства
CREATE POLICY "menu_plans_update"
  ON public.menu_plans
  FOR UPDATE
  TO authenticated
  USING (
    persona_id IN (
      SELECT id FROM public.personas
      WHERE household_id = (
        SELECT own_household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE: только в персоны собственного хозяйства
CREATE POLICY "menu_plans_delete"
  ON public.menu_plans
  FOR DELETE
  TO authenticated
  USING (
    persona_id IN (
      SELECT id FROM public.personas
      WHERE household_id = (
        SELECT own_household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );
