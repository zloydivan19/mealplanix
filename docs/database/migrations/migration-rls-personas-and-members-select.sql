-- Fix 1: personas SELECT
-- Allow reading personas from BOTH active household AND own household.
-- Needed when user joins another household: their personal persona lives in
-- own_household_id but active household_id is now someone else's.

DROP POLICY IF EXISTS "personas_select" ON public.personas;
DROP POLICY IF EXISTS "household members can view personas" ON public.personas;
DROP POLICY IF EXISTS "Users can view personas in their household" ON public.personas;

CREATE POLICY "personas_select"
  ON public.personas
  FOR SELECT
  TO authenticated
  USING (
    household_id = (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() LIMIT 1
    )
    OR
    household_id = (
      SELECT own_household_id FROM household_members
      WHERE user_id = auth.uid() LIMIT 1
    )
  );


-- Fix 2: household_members SELECT
-- Allow members to see all rows in their active household (not just their own row).
-- Needed for: settings page member list, owner seeing who joined.
-- Uses user_id = auth.uid() as the base case to avoid infinite recursion.

DROP POLICY IF EXISTS "household_members_select" ON public.household_members;
DROP POLICY IF EXISTS "Users can view their household members" ON public.household_members;
DROP POLICY IF EXISTS "household members can view household members" ON public.household_members;

CREATE POLICY "household_members_select"
  ON public.household_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    household_id = (
      SELECT household_id FROM household_members hm
      WHERE hm.user_id = auth.uid() LIMIT 1
    )
  );
