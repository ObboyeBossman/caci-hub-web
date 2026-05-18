-- =============================================================================
-- CACI Hub — Migration 20260430000001
-- Purpose:  get_next_membership_sequence() — atomic sequence helper
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 4 — Membership Number Generation
-- Day:      64
-- Date:     April 30, 2026
-- =============================================================================
-- Depends on:
--   20260427000005_create_members.sql  (members table with membership_number col)
--   20260427000002_create_assemblies.sql  (assemblies table)
-- =============================================================================
-- Returns the CURRENT highest sequence used for a given assembly, so the caller
-- can do (result + 1) to get the next number.
-- Uses FOR UPDATE on the aggregate subquery to serialise concurrent calls from
-- the Edge Function and prevent duplicate membership numbers.
-- SECURITY DEFINER so the service-role client, which already bypasses RLS, can
-- still call this without extra grants.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_next_membership_sequence(p_assembly_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_seq integer;
BEGIN
  -- Lock the relevant rows so concurrent calls queue up rather than racing.
  -- We derive the sequence by parsing the trailing numeric segment of any
  -- existing membership_number that matches the CACI-XXX-NNNNN pattern.
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
    AND membership_number ~ '^CACI-[A-Z]+-[0-9]+$'
  FOR UPDATE;           -- row-level lock; serialises concurrent Edge Function calls

  RETURN v_max_seq;
END;
$$;

COMMENT ON FUNCTION public.get_next_membership_sequence(uuid) IS
  'Returns the current highest sequence integer for members in the given assembly. '
  'Uses FOR UPDATE to serialise concurrent calls and prevent duplicate numbers. '
  'Result + 1 gives the next sequence to issue. Called by the '
  'generate-membership-number Edge Function (Day 64).';

-- Grant execute to service_role so the Edge Function can call it
GRANT EXECUTE ON FUNCTION public.get_next_membership_sequence(uuid) TO service_role;

-- =============================================================================
-- END OF MIGRATION 20260430000001
-- =============================================================================
--
-- Post-apply verification:
--
--   SELECT routine_name
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name = 'get_next_membership_sequence';
--   -- Expected: 1 row
--
-- Smoke test (replace <assembly-uuid> with a real one):
--   SELECT public.get_next_membership_sequence('<assembly-uuid>'::uuid);
--   -- Expected: 0 if no members assigned yet; N for existing members.
-- =============================================================================
