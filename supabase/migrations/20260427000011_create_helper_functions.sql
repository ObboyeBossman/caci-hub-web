-- =============================================================================
-- CACI Hub — Migration 20260427000011
-- Purpose:  All 6 RLS helper functions
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      21
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000003_create_user_profiles.sql  (user_profiles table + stub functions)
-- =============================================================================
-- All 6 functions replace the stubs written in Migration 3.
-- All are SECURITY DEFINER to avoid RLS recursion: if user_profiles has RLS
-- enabled and a policy on another table calls a function that reads
-- user_profiles, that inner read would be subject to user_profiles RLS —
-- causing infinite recursion. SECURITY DEFINER elevates the call to run as
-- the database owner, bypassing RLS on user_profiles for the helper lookup only.
-- Reference: Document 5, Section 3
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. get_user_role()
-- -----------------------------------------------------------------------------
-- Returns the user_role enum for the currently authenticated user.
-- Returns NULL if the user has no active user_profiles row.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS
  'Returns the user_role enum for the authenticated user. NULL if no active profile. '
  'SECURITY DEFINER prevents RLS recursion on user_profiles.';


-- -----------------------------------------------------------------------------
-- 2. get_user_assembly_id()
-- -----------------------------------------------------------------------------
-- Returns the assembly_id UUID for the currently authenticated user.
-- Returns NULL if the user has no active user_profiles row.
-- When NULL, all RLS conditions that reference this function evaluate to FALSE —
-- ensuring unassigned users have no data access.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_assembly_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assembly_id
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_assembly_id() IS
  'Returns the assembly_id for the authenticated user. NULL if no active profile. '
  'SECURITY DEFINER prevents RLS recursion on user_profiles.';


-- -----------------------------------------------------------------------------
-- 3. is_admin()
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns TRUE if the authenticated user has the admin role and is active.';


-- -----------------------------------------------------------------------------
-- 4. is_admin_or_pastor()
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_pastor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'pastor')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_pastor() IS
  'Returns TRUE if the authenticated user has admin or pastor role and is active.';


-- -----------------------------------------------------------------------------
-- 5. is_admin_or_secretary()
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_secretary()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'secretary')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_secretary() IS
  'Returns TRUE if the authenticated user has admin or secretary role and is active.';


-- -----------------------------------------------------------------------------
-- 6. can_read_directory()
-- -----------------------------------------------------------------------------
-- Returns TRUE for roles permitted to read the member directory:
-- admin, pastor, secretary, volunteer. Excludes the member role.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'pastor', 'secretary', 'volunteer')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.can_read_directory() IS
  'Returns TRUE for admin, pastor, secretary, and volunteer roles. '
  'Used in directory-read SELECT policies on members and households.';


-- =============================================================================
-- END OF MIGRATION 20260427000011
-- =============================================================================
--
-- Post-apply verification:
--
-- Confirm all 6 functions exist:
--   SELECT routine_name, routine_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN (
--       'get_user_role', 'get_user_assembly_id', 'is_admin',
--       'is_admin_or_pastor', 'is_admin_or_secretary', 'can_read_directory'
--     );
--   -- Expected: 6 rows, all routine_type = 'FUNCTION'
-- =============================================================================
