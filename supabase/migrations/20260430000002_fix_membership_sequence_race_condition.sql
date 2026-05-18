-- =============================================================================
-- CACI Hub — Migration 20260430000002
-- Purpose:  Fix race condition in membership sequence generation
-- Author:   Abraham N. O. Bossman (via Day 65 Fix)
-- Phase:    Phase 4 — Membership Number Generation
-- Date:     April 30, 2026
-- =============================================================================
-- Replaces the Day 64 get_next_membership_sequence function.
-- The previous version used FOR UPDATE on the members table. However, if there
-- are no members matching the criteria (e.g. fresh assembly), it locks 0 rows,
-- failing to serialise concurrent calls. 
-- The true fix is to lock the parent *assembly* row first, which acts as a 
-- guaranteed single lock for all concurrent sequence requests for that assembly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_next_membership_sequence(p_assembly_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_seq integer;
  v_dummy text;
BEGIN
  -- 1. Lock the parent assembly row. This is the crucial fix for the race condition.
  -- Even if there are 0 members, the assembly row exists. Concurrent calls will be
  -- blocked here and proceed one by one.
  SELECT name INTO v_dummy
  FROM public.assemblies
  WHERE id = p_assembly_id
  FOR UPDATE;

  -- 2. Now safely calculate the max sequence. Since we hold the assembly lock,
  -- no other transaction can be doing this at the same time for this assembly.
  SELECT COALESCE(
    MAX(
      CAST(
        SPLIT_PART(membership_number, '-', 3) AS integer
      )
    ),
    0
  )
  INTO v_max_seq
  FROM public.members
  WHERE assembly_id = p_assembly_id
    AND membership_number IS NOT NULL
    AND membership_number ~ '^CACI-[A-Z]+-[0-9]+$';

  RETURN v_max_seq;
END;
$$;

COMMENT ON FUNCTION public.get_next_membership_sequence(uuid) IS
  'Returns the current highest sequence integer for members in the given assembly. '
  'Uses FOR UPDATE on the assemblies table to properly serialise concurrent calls '
  'preventing duplicate numbers (Day 65 race condition fix).';

-- Grant execute to service_role so the Edge Function can call it
GRANT EXECUTE ON FUNCTION public.get_next_membership_sequence(uuid) TO service_role;

-- =============================================================================
-- END OF MIGRATION 20260430000002
-- =============================================================================
