-- =============================================================================
-- CACI Hub — Migration 20260526000006_fix_security_advisor_warnings
-- Purpose:  Resolve all Supabase Security Advisor warnings:
--
--  1. Auth RLS Initialization Plan (3 policies):
--     Replace bare auth.uid() with (SELECT auth.uid()) so it is evaluated
--     once per statement, not once per row — prevents suboptimal query plans.
--     Affected policies:
--       - user_profiles_select_own
--       - members_select_own_member_role         (latest version uses auth_user_id)
--       - members_update_member_role_trigger_allow
--
--  2. Function Search Path Mutable (1 function):
--     Add SET search_path = public to set_updated_at() to prevent search_path
--     injection attacks.
-- =============================================================================

-- ── 1. user_profiles_select_own ──────────────────────────────────────────────
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
  );

-- ── 2. members_select_own_member_role ────────────────────────────────────────
-- Replaces the version in 20260509000005 (which already improved created_by →
-- auth_user_id, but still used bare auth.uid()).
DROP POLICY IF EXISTS members_select_own_member_role ON public.members;

CREATE POLICY members_select_own_member_role
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'member'
    AND auth_user_id = (SELECT auth.uid())
  );

-- ── 3. members_update_member_role_trigger_allow ───────────────────────────────
DROP POLICY IF EXISTS members_update_member_role_trigger_allow ON public.members;

CREATE POLICY members_update_member_role_trigger_allow
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'member'
    AND created_by = (SELECT auth.uid())
  );

-- ── 4. set_updated_at — add SET search_path ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Generic trigger function that sets updated_at = now() on every row UPDATE. '
  'Shared across all Phase 1 tables. SET search_path = public added per security advisor.';
