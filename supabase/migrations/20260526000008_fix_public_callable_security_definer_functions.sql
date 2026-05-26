-- =============================================================================
-- CACI Hub — Migration 20260526000008_fix_public_callable_security_definer_functions
-- Purpose:  Resolve remaining Supabase Security Advisor warnings:
--
--  1. Public Bucket Allows Listing — storage.member-photos
--     The existing "member_photos_public_read" policy allows the `anon` role to
--     SELECT (list) any object in the bucket without signing in. Replaced with
--     a policy restricted to `authenticated` only — public photo URLs remain
--     accessible via the CDN URL without requiring object listing.
--
--  2. Public Can Execute SECURITY DEFINER Function (4 functions)
--     The following SECURITY DEFINER functions are callable by the `anon` role
--     through the PostgREST /rest/v1/rpc/ endpoint. Revoke anon EXECUTE and
--     restrict to `authenticated`:
--
--       a. public.assign_membership_number(p_member_id uuid, p_assembly_id uuid)
--       b. public.can_read_directory()
--       c. public.enforce_member_update_columns()
--       d. public.get_available_primary_contacts(p_assembly_id uuid, p_search text, p_current_household_id uuid)
--
-- NOTE: The SECURITY DEFINER attribute is intentionally preserved on all helper
--       functions — it is required to prevent RLS recursion when reading
--       user_profiles from within an RLS policy (Document 5, Section 3). The fix
--       here only removes the ability for the `anon` (unauthenticated) role to
--       call these functions.
-- =============================================================================


-- ── 1. member-photos — restrict SELECT policy to authenticated ─────────────────
-- The old broad SELECT policy allows `anon` to list ALL objects in the bucket.
-- For a public bucket, direct object URLs still work without any RLS policy;
-- the policy only controls who can call storage.list() (the ListObjects API).
-- Replacing with an authenticated-only check eliminates unauthenticated listing.

DROP POLICY IF EXISTS "member_photos_public_read" ON storage.objects;

CREATE POLICY "member_photos_authenticated_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'member-photos');

COMMENT ON POLICY "member_photos_authenticated_read" ON storage.objects IS
  'Authenticated users can SELECT (read/download) member photos. '
  'The `anon` role cannot list bucket contents. Public CDN URLs remain '
  'accessible without this policy because the bucket itself is set to public.';


-- ── 2a. assign_membership_number — revoke anon, grant authenticated ────────────

REVOKE EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.assign_membership_number(uuid, uuid) IS
  'Generates and assigns a membership number for the given member in the given '
  'assembly. SECURITY DEFINER (required to bypass RLS on members during sequence '
  'calculation). Callable by authenticated and service_role only — anon EXECUTE '
  'revoked to prevent unauthenticated invocation via /rest/v1/rpc/.';


-- ── 2b. can_read_directory — revoke anon, grant authenticated ─────────────────
-- This is a helper used only inside RLS policies; it should never be called
-- directly by the anon role.

REVOKE EXECUTE ON FUNCTION public.can_read_directory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_directory() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_read_directory() TO authenticated;

COMMENT ON FUNCTION public.can_read_directory() IS
  'Returns TRUE for admin, pastor, secretary, and volunteer roles. '
  'Used in directory-read SELECT policies on members and households. '
  'SECURITY DEFINER prevents RLS recursion on user_profiles. '
  'Callable by authenticated only — anon EXECUTE revoked.';


-- ── 2c. enforce_member_update_columns — revoke anon ───────────────────────────
-- This is a trigger function — it is called by the database engine, not by
-- external clients. Revoking anon EXECUTE is safe and correct.

REVOKE EXECUTE ON FUNCTION public.enforce_member_update_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_member_update_columns() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enforce_member_update_columns() TO authenticated;

COMMENT ON FUNCTION public.enforce_member_update_columns() IS
  'BEFORE UPDATE trigger that enforces column-level write permissions per role. '
  'Admin: unrestricted. Secretary: all except pastoral_notes. Pastor: pastoral_notes only. '
  'Volunteer/Member: all updates denied. SECURITY DEFINER to call get_user_role() safely. '
  'Callable by authenticated only — anon EXECUTE revoked.';


-- ── 2d. get_available_primary_contacts — revoke anon, grant authenticated ─────

REVOKE EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) IS
  'Returns assembly members eligible to be set as a household primary contact, '
  'excluding members already serving as a primary contact for another household. '
  'SECURITY DEFINER to query members_view without triggering RLS recursion. '
  'Callable by authenticated only — anon EXECUTE revoked.';
