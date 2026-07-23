-- =============================================================================
-- Migration: fix_user_profiles_recursion
--
-- Fixes infinite recursion (42P17) on the user_profiles_select RLS policy.
--
-- Root cause:
--   Migration 20260712000000_fix_rls_policies.sql replaced the user_profiles_select
--   policy with one containing an inline subquery:
--
--     (SELECT role FROM public.user_profiles WHERE id = auth.uid() ...) = 'admin'
--
--   This subquery runs as the calling user (NOT SECURITY DEFINER), so Postgres
--   evaluates the user_profiles_select policy to authorise it — which runs the
--   subquery again → infinite recursion (SQLSTATE 42P17).
--
-- Fix:
--   Use public.is_admin() which is SECURITY DEFINER. SECURITY DEFINER functions
--   run as their owner (postgres) and bypass RLS entirely, breaking the cycle.
--   The policy reads: "you can see your own row, OR you are an admin."
-- =============================================================================

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;

CREATE POLICY "user_profiles_select"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
);
