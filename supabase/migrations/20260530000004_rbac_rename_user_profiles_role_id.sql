-- =============================================================================
-- CACI Hub — Migration 20260530000004_rbac_rename_user_profiles_role_id
-- Purpose:  RBAC Phase 4 — Rename user_profiles.role_id → assembly_role_id
--           to avoid ambiguity and make the FK purpose explicit.
--
-- Depends on: 20260530000003
-- =============================================================================

-- Rename the column
ALTER TABLE public.user_profiles
  RENAME COLUMN role_id TO assembly_role_id;

-- Update the JWT sync trigger to reference the correct column name
-- The trigger fires on UPDATE OF role_id which needs to be updated too.
DROP TRIGGER IF EXISTS sync_permissions_on_profile_update ON public.user_profiles;

CREATE TRIGGER sync_permissions_on_profile_update
  AFTER UPDATE OF assembly_role_id, assembly_id
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_permissions_to_jwt();

COMMENT ON COLUMN public.user_profiles.assembly_role_id IS
  'Optional FK → assembly_roles(id). The custom role this user holds within '
  'their assembly (e.g. Secretary, Treasurer). NULL = no custom role assigned; '
  'user is governed by their system role only. '
  'Updated by admin via user management. '
  'Changing this triggers sync_user_permissions_to_jwt to refresh the JWT.';
