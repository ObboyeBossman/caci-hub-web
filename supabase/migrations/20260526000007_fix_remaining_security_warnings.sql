-- =============================================================================
-- CACI Hub — Migration 20260526000007_fix_remaining_security_warnings
-- Purpose:  Resolve remaining Supabase Security Advisor warnings:
--
--  1. Multiple Permissive Policies — public.user_profiles (SELECT)
--     Merge user_profiles_select_admin + user_profiles_select_own into one
--     policy using OR so PostgreSQL evaluates a single policy per query.
--
--  2. Multiple Permissive Policies — public.members (SELECT)
--     Merge members_select_admin_include_deleted + members_select_directory_roles
--     + members_select_own_member_role into one policy using OR.
--
--  3. Security Definer View — public.members_view (CRITICAL)
--     Recreate the view with security_invoker = true so the RLS of the
--     querying user is enforced, not of the view owner (postgres).
--
--  4. Function Search Path Mutable — public.link_household_primary_contact
--     Add SET search_path = public to the function.
--
-- NOTE: "Leaked Password Protection Disabled" is an Auth dashboard setting
--       (supabase.com/dashboard → Auth → Security → Leaked Password Protection).
--       It cannot be set via a migration and must be enabled manually.
-- =============================================================================


-- ── 1. user_profiles — merge two SELECT policies ──────────────────────────────

DROP POLICY IF EXISTS user_profiles_select_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own   ON public.user_profiles;

-- Single policy using OR covering both cases.
-- Admin sees all profiles in their assembly; everyone else sees only their own.
CREATE POLICY user_profiles_select
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      public.is_admin()
      AND assembly_id = public.get_user_assembly_id()
    )
  );


-- ── 2. members — merge three SELECT policies ──────────────────────────────────

DROP POLICY IF EXISTS members_select_admin_include_deleted ON public.members;
DROP POLICY IF EXISTS members_select_directory_roles       ON public.members;
DROP POLICY IF EXISTS members_select_own_member_role       ON public.members;

-- Single policy with three OR branches:
--   a) Admin: all rows (including soft-deleted) in their assembly
--   b) Privileged roles (pastor, secretary, volunteer): active rows in their assembly
--   c) Member: own row matched via auth_user_id
CREATE POLICY members_select
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    -- Admin: all rows including soft-deleted
    (
      public.is_admin()
      AND assembly_id = public.get_user_assembly_id()
    )
    OR
    -- Directory roles: active rows only
    (
      public.can_read_directory()
      AND assembly_id = public.get_user_assembly_id()
      AND is_active = true
    )
    OR
    -- Member: own row via linked auth account
    (
      public.get_user_role() = 'member'
      AND auth_user_id = (SELECT auth.uid())
    )
  );


-- ── 3. members_view — add security_invoker = true ────────────────────────────
-- This forces the view to enforce RLS of the QUERYING user, not the view owner.
-- Only available in PostgreSQL 15+ (Supabase uses PG 15/16).

DROP VIEW IF EXISTS public.members_view;

CREATE VIEW public.members_view
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.other_names,
  m.date_of_birth,
  m.gender,
  m.marital_status,
  m.phone_number,
  m.email,
  m.physical_address,
  m.occupation,
  m.facebook_url,
  m.whatsapp_number,
  m.instagram_url,

  -- Emergency contact fields — hidden from volunteer
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,
  m.auth_user_id,

  -- Pastoral notes — visible to admin and pastor only (IMR-03)
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor')
    THEN m.pastoral_notes
    ELSE NULL
  END AS pastoral_notes,

  m.is_active,
  m.deleted_at,
  m.created_by,
  m.created_at,
  m.updated_at

FROM public.members m;

COMMENT ON VIEW public.members_view IS
  'Security barrier + invoker view over members. security_invoker=true ensures '
  'RLS of the querying user is applied, not the view owner. Handles column-level '
  'masking of emergency_contact_* (hidden from volunteer) and pastoral_notes '
  '(hidden from secretary, volunteer, member). Reference: Document 5, Section 4.2; IMR-03.';

-- Re-grant SELECT to authenticated (required after DROP/CREATE of view)
GRANT SELECT ON public.members_view TO authenticated;


-- ── 4. link_household_primary_contact — add SET search_path ──────────────────

CREATE OR REPLACE FUNCTION public.link_household_primary_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If primary_contact_id is set or changed
  IF NEW.primary_contact_id IS NOT NULL THEN
    UPDATE public.members
    SET household_id = NEW.id
    WHERE id = NEW.primary_contact_id;
  END IF;
  RETURN NEW;
END;
$$;
