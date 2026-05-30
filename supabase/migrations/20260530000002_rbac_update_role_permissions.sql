-- =============================================================================
-- CACI Hub — Migration 20260530000002_rbac_update_role_permissions
-- Purpose:  RBAC Phase 2 — Update role_permissions to use permission key (text)
--           instead of permission id, aligned with system_permissions.key.
--
-- What this changes:
--   * Adds a `key` TEXT column to system_permissions (unique, dot-notation)
--   * Updates role_permissions to use permission_key TEXT instead of permission_id TEXT
--   * Updates PK on role_permissions to (role_id, permission_key)
--   * Drops old FK to permissions(id), adds FK to system_permissions(key)
--
-- Depends on: 20260530000001 (system_permissions table must exist)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Add `key` column to system_permissions as the new semantic PK
-- The old `id` column (e.g. 'member:invite') was colon-separated and legacy.
-- The new `key` uses dot-notation (e.g. 'members.view').
-- We keep `id` for backward compat in this migration; deprecated going forward.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.system_permissions
  ADD COLUMN IF NOT EXISTS key TEXT;

-- Backfill key from id for legacy rows
UPDATE public.system_permissions SET key = id WHERE key IS NULL;

-- Now set NOT NULL and add unique constraint
ALTER TABLE public.system_permissions
  ALTER COLUMN key SET NOT NULL;

ALTER TABLE public.system_permissions
  ADD CONSTRAINT system_permissions_key_unique UNIQUE (key);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Add permission_key column to role_permissions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS permission_key TEXT;

-- Backfill permission_key from the linked permission's key
UPDATE public.role_permissions rp
SET permission_key = sp.key
FROM public.system_permissions sp
WHERE sp.id = rp.permission_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Drop old PK and FK constraints on role_permissions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_pkey;

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;

-- Drop old column
ALTER TABLE public.role_permissions
  DROP COLUMN IF EXISTS permission_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Set NOT NULL and add new FK + PK
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.role_permissions
  ALTER COLUMN permission_key SET NOT NULL;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_permission_key_fkey
    FOREIGN KEY (permission_key)
    REFERENCES public.system_permissions(key)
    ON DELETE CASCADE;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_pkey
    PRIMARY KEY (role_id, permission_key);

COMMENT ON TABLE public.role_permissions IS
  'Many-to-many junction between assembly_roles and system_permissions. '
  'Multiple roles can share the same permission. Only admin may modify this table. '
  'Backend must reject assignment of permissions where is_assignable = false.';
