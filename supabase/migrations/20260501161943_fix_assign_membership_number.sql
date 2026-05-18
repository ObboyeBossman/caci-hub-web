-- =============================================================================
-- CACI Hub — Migration
-- Purpose: Fix the SPLIT_PART and Regex sequence retrieval for membership numbers.
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
BEGIN
  -- 1. Lock the assembly row to queue concurrent requests.
  SELECT assembly_code INTO v_assembly_code
  FROM public.assemblies
  WHERE id = p_assembly_id
  FOR UPDATE;

  IF v_assembly_code IS NULL THEN
    RAISE EXCEPTION 'Assembly not found or could not be locked';
  END IF;

  -- 2. Calculate the sequence max safely within the lock
  SELECT COALESCE(
    MAX(
      CAST(
        SPLIT_PART(membership_number, '-', 4) AS integer
      )
    ),
    0
  )
  INTO v_max_seq
  FROM public.members
  WHERE assembly_id = p_assembly_id
    AND membership_number IS NOT NULL
    AND membership_number ~ '^CACI-[A-Z]{2}-[A-Z]{3,6}-[0-9]+$';

  v_new_seq := v_max_seq + 1;
  v_membership_number := 'CACI-' || v_assembly_code || '-' || LPAD(v_new_seq::text, 5, '0');

  -- 3. Assign to member record
  UPDATE public.members
  SET membership_number = v_membership_number
  WHERE id = p_member_id;

  RETURN v_membership_number;
END;
$$;
