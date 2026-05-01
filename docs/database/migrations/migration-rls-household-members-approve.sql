-- Allow household owners to update household_id of users who are joining their household.
-- Without this policy, approveRequest silently updates 0 rows (RLS blocks owner from
-- touching another user's household_members row).
--
-- USING: only allow updating rows where the user is currently in their own household
--        (i.e. not already a member of someone else's)
-- WITH CHECK: the new household_id must be a household that the updater owns

CREATE POLICY "owner_can_approve_join_requests"
  ON public.household_members
  FOR UPDATE
  TO authenticated
  USING (
    own_household_id = household_id
  )
  WITH CHECK (
    household_id IN (
      SELECT own_household_id
      FROM household_members
      WHERE user_id = auth.uid()
        AND household_id = own_household_id
    )
  );
