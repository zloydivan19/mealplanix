-- Function: user leaves their current household (resets to own)
CREATE OR REPLACE FUNCTION public.leave_household()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE household_members
  SET household_id = own_household_id
  WHERE user_id = auth.uid()
    AND household_id != own_household_id;
END;
$$;

-- Function: owner removes a member from their household
CREATE OR REPLACE FUNCTION public.remove_household_member(p_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_household_id uuid;
BEGIN
  -- Verify caller is an owner
  SELECT household_id INTO v_owner_household_id
  FROM household_members
  WHERE user_id = auth.uid() AND household_id = own_household_id;

  IF v_owner_household_id IS NULL THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Reset target member to their own household
  UPDATE household_members
  SET household_id = own_household_id
  WHERE user_id = p_target_user_id
    AND household_id = v_owner_household_id;
END;
$$;
