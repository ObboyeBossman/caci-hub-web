-- =============================================================================
-- Migration: fix_user_profiles_provisioning
--
-- Allows newly signed-up users to create their own initial profile record.
-- This is necessary during the provisioning flow if the admin's session
-- is temporarily swapped during a client-side auth.signUp call.
-- =============================================================================

-- ── 1. Fix INSERT policy ──────────────────────────────────────────────────────
-- Allow Admins to insert ANY profile.
-- Allow members to insert ONLY their own profile (matching their UID).

DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;

CREATE POLICY "user_profiles_insert"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR id = auth.uid()
);

-- ── 2. Fix UPDATE policy ──────────────────────────────────────────────────────
-- Similar logic: Admins can update any, users can update their own.

DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;

CREATE POLICY "user_profiles_update"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR id = auth.uid()
);
