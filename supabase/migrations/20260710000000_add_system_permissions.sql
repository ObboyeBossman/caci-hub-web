-- =============================================================================
-- Migration: add_system_permissions
-- Adds a system_permissions reference table — the single source of truth
-- for all named permissions in the system.
-- Replaces the hard-coded CHECK constraint on member_permissions.permission
-- with a proper FK relationship.
-- =============================================================================


-- =============================================================================
-- SECTION 1: system_permissions TABLE
-- =============================================================================

CREATE TABLE public.system_permissions (
  key         text        PRIMARY KEY,
  label       text        NOT NULL,
  description text        NOT NULL,
  module      text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_permissions IS
  'Registry of all named permissions available in CACI Hub. '
  'Seeded once at migration time. New permissions are added via new migrations. '
  'Drives the permission grant UI — query this table to build the checklist.';

COMMENT ON COLUMN public.system_permissions.key IS
  'Permission identifier used in member_permissions.permission. '
  'Format: <module>.<action>. Immutable once seeded.';

COMMENT ON COLUMN public.system_permissions.module IS
  'Logical module this permission belongs to. '
  'Used for grouping in the admin UI.';

COMMENT ON COLUMN public.system_permissions.sort_order IS
  'Display order within a module group in the admin UI.';

-- Read-only for all authenticated users (admin only writes via future migrations)
ALTER TABLE public.system_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_permissions_select"
ON public.system_permissions FOR SELECT
TO authenticated
USING (true);  -- all authenticated users can read the permission catalog


-- =============================================================================
-- SECTION 2: SEED — all v1 permissions
-- =============================================================================

INSERT INTO public.system_permissions (key, label, description, module, sort_order) VALUES

  -- Members module
  ('members.read',
   'View Members',
   'Can view the full church directory including all member profiles and contact details.',
   'members', 10),

  ('members.write',
   'Manage Members',
   'Can add new members, edit existing member records, and perform soft deletes.',
   'members', 20),

  -- Groups module
  ('groups.read',
   'View Groups',
   'Can view all groups, their descriptions, leaders, and member lists.',
   'groups', 30),

  ('groups.write',
   'Manage Groups',
   'Can create and edit groups, assign leaders, and add or remove group members.',
   'groups', 40),

  -- Broadcasts module
  ('broadcasts.read',
   'View Broadcasts',
   'Can view the full history of broadcasts sent to the assembly or any group.',
   'broadcasts', 50),

  ('broadcasts.write',
   'Send Broadcasts',
   'Can compose and send broadcasts to the assembly, a group, or specific members.',
   'broadcasts', 60),

  -- Notifications module
  ('notifications.read',
   'View Notifications',
   'Reserved for future use. Currently all members read only their own notifications.',
   'notifications', 70);


-- =============================================================================
-- SECTION 3: MIGRATE member_permissions constraint
-- Drop the hard-coded CHECK and replace with a FK to system_permissions.
-- =============================================================================

-- Drop the inline CHECK constraint (Postgres auto-names it <table>_<col>_check)
ALTER TABLE public.member_permissions
  DROP CONSTRAINT member_permissions_permission_check;

-- Add FK — only values that exist in system_permissions are now valid
ALTER TABLE public.member_permissions
  ADD CONSTRAINT member_permissions_permission_fkey
  FOREIGN KEY (permission)
  REFERENCES public.system_permissions(key)
  ON UPDATE CASCADE   -- if a key is ever renamed, it cascades
  ON DELETE RESTRICT; -- cannot remove a permission that is still granted

-- Index on permission key for fast lookups and join performance
CREATE INDEX IF NOT EXISTS idx_member_permissions_permission
  ON public.member_permissions (permission);
