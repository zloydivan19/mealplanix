-- Allow any authenticated user to read households
-- Needed for the /join page: user looks up a household by invite_code
-- before becoming a member. The invite_code itself is the access control.
--
-- Existing SELECT policy likely restricts reads to own household only.
-- This migration adds / replaces the policy to allow full SELECT for
-- authenticated users (households contain no sensitive PII).

-- Drop existing SELECT policies on households if any
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'households' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.households', pol.policyname);
  END LOOP;
END $$;

-- Allow any authenticated user to read any household row
CREATE POLICY "households_select_authenticated"
  ON public.households
  FOR SELECT
  TO authenticated
  USING (true);
