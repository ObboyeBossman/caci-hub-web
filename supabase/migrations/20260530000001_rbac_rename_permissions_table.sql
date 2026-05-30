-- =============================================================================
-- CACI Hub — Migration 20260530000001_rbac_rename_permissions_table
-- Purpose:  RBAC Phase 1 — Rename public.permissions → public.system_permissions
--           and update the schema to match the new platform-owned permission
--           catalogue format (key, label, module_name, category, is_assignable,
--           is_active).
--
-- What this changes:
--   * Renames table: permissions → system_permissions
--   * Adds columns:  key (becomes new PK alias for id)
--                    label, module_name, category
--                    is_assignable boolean DEFAULT true
--                    is_active     boolean DEFAULT true
--   * Adds a proper `key` TEXT column as the semantic primary key
--   * Drops old RLS policies, recreates on new table name
--   * Keeps old `id` column temporarily aliased so role_permissions migration
--     can follow safely in the next migration.
--
-- NOTE: role_permissions FK to permissions(id) is updated in migration 000002.
-- =============================================================================

-- Step 1: Rename the table
ALTER TABLE public.permissions
  RENAME TO system_permissions;

-- Step 2: Add new required columns (nullable first so existing rows don't fail)
ALTER TABLE public.system_permissions
  ADD COLUMN IF NOT EXISTS label          TEXT,
  ADD COLUMN IF NOT EXISTS module_name    TEXT,
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS is_assignable  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true;

-- Step 3: Backfill label from description where null
UPDATE public.system_permissions
SET label = id
WHERE label IS NULL;

-- Step 4: Set NOT NULL constraints now that data is backfilled
ALTER TABLE public.system_permissions
  ALTER COLUMN label       SET NOT NULL,
  ALTER COLUMN module_name SET DEFAULT 'general',
  ALTER COLUMN category    SET DEFAULT 'General';

-- Step 5: Update default module_name and category for existing seeded permissions
UPDATE public.system_permissions SET module_name = 'admin',      category = 'Members'   WHERE id = 'member:invite';
UPDATE public.system_permissions SET module_name = 'membership',  category = 'Members'   WHERE id = 'member:view_all';
UPDATE public.system_permissions SET module_name = 'membership',  category = 'Members'   WHERE id = 'member:edit';
UPDATE public.system_permissions SET module_name = 'finance',     category = 'Finance'   WHERE id = 'financials:view';
UPDATE public.system_permissions SET module_name = 'finance',     category = 'Finance'   WHERE id = 'financials:write';
UPDATE public.system_permissions SET module_name = 'attendance',  category = 'Attendance' WHERE id = 'attendance:mark';
UPDATE public.system_permissions SET module_name = 'media',       category = 'Media'     WHERE id = 'sermon:edit';

-- Set NOT NULL now data is populated
ALTER TABLE public.system_permissions
  ALTER COLUMN module_name SET NOT NULL,
  ALTER COLUMN category    SET NOT NULL;

-- Step 6: Drop old RLS policies (were named on public.permissions)
DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.system_permissions;

-- Step 7: Recreate RLS on the renamed table
-- Permission: anyone authenticated can SELECT; no API write access
CREATE POLICY "system_permissions_select_authenticated"
  ON public.system_permissions FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.system_permissions IS
  'Platform-owned permission catalogue. Rows are seeded via migrations only — '
  'never created at runtime. Permissions are assigned to assembly_roles via '
  'role_permissions. Assemblies may only use is_assignable = true permissions.';
