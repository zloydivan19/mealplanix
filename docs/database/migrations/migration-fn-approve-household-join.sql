-- Drop the broken RLS policy from previous migration
DROP POLICY IF EXISTS "owner_can_approve_join_requests" ON public.household_members;

-- SECURITY DEFINER function runs with DB owner rights (bypasses RLS).
-- Security is enforced inside the function: caller must own the target household.
CREATE OR REPLACE FUNCTION public.approve_household_join(
  p_request_id  uuid,
  p_requester_user_id uuid,
  p_household_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the owner of the target household
  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE user_id        = auth.uid()
      AND household_id   = p_household_id
      AND own_household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Move requester into the household
  UPDATE household_members
  SET household_id = p_household_id
  WHERE user_id         = p_requester_user_id
    AND own_household_id = household_id;   -- only if they're still in their own household

  -- Mark request approved
  UPDATE household_join_requests
  SET status = 'approved'
  WHERE id = p_request_id;
END;
$$;
