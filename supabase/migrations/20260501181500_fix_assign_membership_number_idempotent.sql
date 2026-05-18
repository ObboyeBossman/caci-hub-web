-- =============================================================================
-- CACI Hub — Migration
-- Purpose: Make assign_membership_number idempotent and robust against retries.
-- Date: 2026-05-01
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_membership_number(p_member_id uuid, p_assembly_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assembly_code text;
  v_max_seq integer;
  v_new_seq integer;
  v_membership_number text;
  v_existing_number text;
BEGIN
  -- 1. Check if the member already has a membership number (Idempotency)
  SELECT membership_number INTO v_existing_number
  FROM public.members
  WHERE id = p_member_id;

  IF v_existing_number IS NOT NULL THEN
    RETURN v_existing_number;
  END IF;

  -- 2. Lock the assembly row to queue concurrent requests.
  SELECT assembly_code INTO v_assembly_code
  FROM public.assemblies
  WHERE id = p_assembly_id
  FOR UPDATE;

  IF v_assembly_code IS NULL THEN
    RAISE EXCEPTION 'Assembly not found or could not be locked';
  END IF;

  -- 3. Calculate the sequence max safely within the lock.
  -- We include both active and soft-deleted members to ensure sequences never overlap.
  -- We also ensure the regex matches exactly the trailing digits.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(membership_number FROM '-([0-9]+)$') AS integer
      )
    ),
    0
  )
  INTO v_max_seq
  FROM public.members
  WHERE assembly_id = p_assembly_id
    AND membership_number IS NOT NULL
    AND membership_number LIKE ('CACI-' || v_assembly_code || '-%');

  v_new_seq := v_max_seq + 1;
  v_membership_number := 'CACI-' || v_assembly_code || '-' || LPAD(v_new_seq::text, 5, '0');

  -- 4. Assign to member record
  UPDATE public.members
  SET membership_number = v_membership_number
  WHERE id = p_member_id;

  RETURN v_membership_number;
END;
$$;
