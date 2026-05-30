-- =============================================================================
-- CACI Hub — Migration 20260530000003_rbac_update_assembly_roles
-- Purpose:  RBAC Phase 3 — Add is_active and is_system columns to assembly_roles.
--           is_active: allows admins to soft-deactivate roles without deleting.
--           is_system: reserved for future platform-created default roles.
--
-- Depends on: 20260530000001
-- =============================================================================

ALTER TABLE public.assembly_roles
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_system  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assembly_roles.is_active IS
  'Soft-disable flag. Deactivated roles still exist in the DB but are excluded '
  'from UI role pickers. Users assigned a deactivated role lose its permissions '
  'at next JWT refresh.';

COMMENT ON COLUMN public.assembly_roles.is_system IS
  'Reserved for platform-default roles seeded by migrations. '
  'is_system = true roles may not be deleted by assemblies.';
