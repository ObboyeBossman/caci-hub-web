-- =============================================================================
-- CACI Hub — Migration 20260530000005_rbac_restrict_user_profiles_role
-- Purpose:  RBAC Phase 5 — Restrict user_profiles.role to ('admin', 'member')
--           only. All other enum values (pastor, secretary, etc.) are removed
--           from the system role model — they belong to assembly_roles instead.
--
-- IMPORTANT: This migration migrates all users with non-admin/member roles to
--            'member' before applying the check constraint. Admins must then
--            create assembly roles and assign users via user management.
--
-- What this changes:
--   1. Migrates rows: pastor/secretary/volunteer/etc. → 'member'
--   2. Drops the user_role enum type
--   3. Changes user_profiles.role to TEXT with CHECK constraint
--   4. Updates RLS helper functions that return/compare user_role type
--   5. Drops composite helpers that reference legacy roles
--
-- Depends on: 20260530000004
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Migrate non-admin users to 'member' role
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.user_profiles
SET role = 'member'
WHERE role NOT IN ('admin', 'member');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Change user_profiles.role column from enum to text with CHECK
-- We cannot just alter the type directly when a CHECK constraint uses an enum.
-- Strategy: add new text column, copy data, drop old, rename.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new text column
ALTER TABLE public.user_profiles
  ADD COLUMN role_text TEXT;

-- Copy data
UPDATE public.user_profiles SET role_text = role::text;

-- Drop old enum column
ALTER TABLE public.user_profiles DROP COLUMN role;

-- Rename new column and add constraint
ALTER TABLE public.user_profiles
  RENAME COLUMN role_text TO role;

ALTER TABLE public.user_profiles
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('admin', 'member'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Recreate get_user_role() — now returns TEXT instead of user_role enum
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id        = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS
  'Returns the system role (admin | member) of the currently authenticated user. '
  'Returns NULL if no active user_profiles row exists for auth.uid(). '
  'SECURITY DEFINER prevents infinite recursion in RLS policies on tables '
  'that join user_profiles. Used in RLS enforcement for admin override.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Update is_admin() — now compares TEXT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id        = auth.uid()
      AND role      = 'admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true iff the current user is an active admin. '
  'Compares against the TEXT system role. Returns false (not NULL) for '
  'unauthenticated or inactive users. Used in admin-only RLS policies.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Add is_member() helper for clarity in RLS policies
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id        = auth.uid()
      AND role      = 'member'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_member() IS
  'Returns true iff the current user is an active member (non-admin system role). '
  'In the new RBAC model, permission checks happen at the app layer — not in RLS. '
  'RLS only uses is_admin() and is_member() for assembly isolation.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Drop legacy composite helper functions
-- These used to check for pastor/secretary/volunteer in RLS. No longer valid
-- since those are no longer system roles. RLS must not understand custom roles.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin_or_pastor() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_secretary() CASCADE;
DROP FUNCTION IF EXISTS public.can_read_directory() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7: Drop the user_role enum type (no longer used)
-- ─────────────────────────────────────────────────────────────────────────────
-- Note: we can only drop the enum after the column is changed to TEXT.
DROP TYPE IF EXISTS public.user_role;
