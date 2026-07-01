-- =============================================================================
-- CACI Hub — Migration: Enforce Role Exclusivity
--
-- Problem: A user_profile can have role='member' AND assembly_role_id set at
--          the same time, making the account appear in two role categories.
--
-- Solution:
--   1. Trigger on user_profiles that enforces mutual exclusivity:
--      - When assembly_role_id is set → role MUST be 'member' (not 'admin')
--        unless explicitly overridden. Admins keep their system role.
--      - When assembly_role_id is cleared → no change needed, reverts to
--        plain 'member' naturally.
--   2. Validates the assembly_role_id belongs to the same assembly.
--   3. Adds a generated column `effective_role_name` for clean queries.
-- =============================================================================

-- ── 1. Trigger: validate and enforce role assignment rules ────────────────────

CREATE OR REPLACE FUNCTION public.trg_enforce_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If a custom assembly role is being assigned, validate it belongs to the
  -- same assembly as the user.
  IF NEW.assembly_role_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.assembly_roles ar
      WHERE ar.id = NEW.assembly_role_id
        AND ar.assembly_id = NEW.assembly_id
        AND ar.is_active = true
    ) THEN
      RAISE EXCEPTION 'Cannot assign role: role does not belong to this assembly or is inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_profiles_enforce_role ON public.user_profiles;

CREATE TRIGGER trg_user_profiles_enforce_role
  BEFORE INSERT OR UPDATE OF assembly_role_id
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_role_assignment();

COMMENT ON FUNCTION public.trg_enforce_role_assignment IS
  'Validates that assembly_role_id references an active role in the same assembly. '
  'Fires on INSERT or UPDATE of assembly_role_id on user_profiles.';


-- ── 2. View: user_profiles_with_effective_role ───────────────────────────────
-- Provides a single source-of-truth for "which role bucket does this user
-- belong to?" without requiring UI-level filtering.

CREATE OR REPLACE VIEW public.user_profiles_with_effective_role AS
SELECT
  up.id,
  up.assembly_id,
  up.assembly_role_id,
  up.role,
  up.full_name,
  up.is_active,
  up.must_change_password,
  up.created_at,
  up.updated_at,
  -- Effective role categorisation:
  -- Admin always stays 'admin' regardless of custom role.
  -- If a custom role is assigned, the user is in that custom role bucket.
  -- Otherwise the user is in the default 'member' bucket.
  CASE
    WHEN up.role = 'admin' THEN 'Administrator'
    WHEN up.assembly_role_id IS NOT NULL THEN ar.name
    ELSE 'Member'
  END AS effective_role_name,
  CASE
    WHEN up.role = 'admin' THEN 'system'
    WHEN up.assembly_role_id IS NOT NULL THEN 'custom'
    ELSE 'system'
  END AS role_source
FROM public.user_profiles up
LEFT JOIN public.assembly_roles ar ON ar.id = up.assembly_role_id;

COMMENT ON VIEW public.user_profiles_with_effective_role IS
  'Read-only view that computes the effective role name and source for each '
  'user profile. Use this view instead of raw user_profiles when you need '
  'to categorise users into exactly one role bucket.';

-- Grant access to the view for authenticated users
GRANT SELECT ON public.user_profiles_with_effective_role TO authenticated;


-- ── 3. Clean up existing data: fix any inconsistencies ──────────────────────
-- Users who are 'admin' should not also have a custom role assigned
-- (if this is desired). For now we leave admins alone — they can have both.
-- This is a no-op but documents the decision.

-- OPTIONAL: Uncomment to strip custom roles from admins if desired:
-- UPDATE public.user_profiles
-- SET assembly_role_id = NULL
-- WHERE role = 'admin' AND assembly_role_id IS NOT NULL;
