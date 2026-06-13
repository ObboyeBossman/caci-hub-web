-- =============================================================================
-- CACI Hub — Squashed Migration 04: RBAC Tables
-- Final state of: system_permissions, assembly_roles, role_permissions
-- Also: user_profiles.assembly_role_id FK (depends on assembly_roles).
--
-- Consolidates:
--   20260526000004 (initial permissions/assembly_roles/role_permissions)
--   20260530000001 (rename permissions → system_permissions, add columns)
--   20260530000002 (role_permissions uses permission_key TEXT not id)
--   20260530000003 (assembly_roles: add is_active, is_system)
--   20260530000004 (user_profiles: role_id → assembly_role_id)
--   20260530000006 (seed system permissions)
--   20260606000001 (seed service/groups/pastoral/finance permissions)
--   20260610000002 (seed communications permissions)
-- =============================================================================


-- ── 1. system_permissions ─────────────────────────────────────────────────────
-- Platform-owned. Rows seeded by migrations only — never created at runtime.

CREATE TABLE public.system_permissions (
  id            text        PRIMARY KEY,   -- legacy colon-notation id, kept for compat
  key           text        NOT NULL UNIQUE, -- dot-notation canonical key e.g. 'members.view'
  label         text        NOT NULL,
  description   text,
  module_name   text        NOT NULL,
  category      text        NOT NULL,
  is_assignable boolean     NOT NULL DEFAULT true,
  is_active     boolean     NOT NULL DEFAULT true
);

COMMENT ON TABLE public.system_permissions IS
  'Platform-owned permission catalogue. Rows seeded via migrations only. '
  'Permissions are assigned to assembly_roles via role_permissions. '
  'Only is_assignable = true permissions may be used by assemblies.';

ALTER TABLE public.system_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_permissions_select_authenticated"
  ON public.system_permissions FOR SELECT
  TO authenticated
  USING (true);


-- ── 2. assembly_roles ─────────────────────────────────────────────────────────

CREATE TABLE public.assembly_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid        NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assembly_id, name)
);

COMMENT ON COLUMN public.assembly_roles.is_active IS
  'Soft-disable. Deactivated roles are excluded from UI pickers. '
  'Users assigned a deactivated role lose its permissions at next JWT refresh.';
COMMENT ON COLUMN public.assembly_roles.is_system IS
  'Platform-default roles seeded by migrations. is_system = true roles may not be deleted.';

ALTER TABLE public.assembly_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assembly_roles_select"
  ON public.assembly_roles FOR SELECT TO authenticated
  USING (assembly_id = public.get_user_assembly_id());

CREATE POLICY "assembly_roles_insert"
  ON public.assembly_roles FOR INSERT TO authenticated
  WITH CHECK (assembly_id = public.get_user_assembly_id() AND public.is_admin());

CREATE POLICY "assembly_roles_update"
  ON public.assembly_roles FOR UPDATE TO authenticated
  USING (assembly_id = public.get_user_assembly_id() AND public.is_admin());

CREATE POLICY "assembly_roles_delete"
  ON public.assembly_roles FOR DELETE TO authenticated
  USING (assembly_id = public.get_user_assembly_id() AND public.is_admin());

CREATE TRIGGER trg_assembly_roles_set_updated_at
  BEFORE UPDATE ON public.assembly_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. role_permissions ───────────────────────────────────────────────────────

CREATE TABLE public.role_permissions (
  role_id        uuid NOT NULL REFERENCES public.assembly_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.system_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

COMMENT ON TABLE public.role_permissions IS
  'Many-to-many junction between assembly_roles and system_permissions. '
  'Only admin may modify this table. Backend rejects is_assignable = false permissions.';

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
      WHERE ar.id = role_id
        AND ar.assembly_id = public.get_user_assembly_id()
    )
  );

CREATE POLICY "role_permissions_insert"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
      WHERE ar.id = role_id
        AND ar.assembly_id = public.get_user_assembly_id()
    )
  );

CREATE POLICY "role_permissions_delete"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
      WHERE ar.id = role_id
        AND ar.assembly_id = public.get_user_assembly_id()
    )
  );


-- ── 4. Wire user_profiles.assembly_role_id FK ────────────────────────────────
-- assembly_roles now exists, so the FK can be added.

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_assembly_role_id_fkey
  FOREIGN KEY (assembly_role_id)
  REFERENCES public.assembly_roles(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.user_profiles.assembly_role_id IS
  'Optional FK → assembly_roles(id). The custom role this user holds within their assembly. '
  'NULL = governed by system role only. Changing this triggers sync_user_permissions_to_jwt.';


-- ── 5. Seed: system_permissions ──────────────────────────────────────────────
-- All permissions from migrations 20260530000006, 20260606000001, 20260610000002.

INSERT INTO public.system_permissions (id, key, label, description, module_name, category, is_assignable, is_active) VALUES

  -- Membership: Members
  ('members.view',            'members.view',            'View Members',            'View the member directory and individual records',                   'membership',     'Members',        true, true),
  ('members.create',          'members.create',          'Create Members',          'Create new member records',                                         'membership',     'Members',        true, true),
  ('members.edit',            'members.edit',            'Edit Members',            'Edit existing member records',                                       'membership',     'Members',        true, true),
  ('members.deactivate',      'members.deactivate',      'Deactivate Members',      'Soft-deactivate member records',                                     'membership',     'Members',        true, true),
  ('members.import',          'members.import',          'Import Members',          'Bulk import members via CSV',                                        'membership',     'Members',        true, true),
  ('members.export',          'members.export',          'Export Members',          'Export member records to CSV',                                       'membership',     'Members',        true, true),

  -- Membership: Households
  ('households.view',         'households.view',         'View Households',         'View household records and member groupings',                        'membership',     'Households',     true, true),
  ('households.create',       'households.create',       'Create Households',       'Create new household records',                                       'membership',     'Households',     true, true),
  ('households.edit',         'households.edit',         'Edit Households',         'Edit existing household records',                                    'membership',     'Households',     true, true),

  -- Reports
  ('reports.view',            'reports.view',            'View Reports',            'View generated reports and dashboards',                              'reports',        'Reports',        true, true),
  ('reports.export',          'reports.export',          'Export Reports',          'Download and export reports to CSV/PDF',                             'reports',        'Reports',        true, true),

  -- Finance
  ('finance.view',            'finance.view',            'View Finance',            'View financial records',                                             'finance',        'Finance',        true, true),
  ('finance.manage',          'finance.manage',          'Manage Finance',          'Manage and edit financial records',                                  'finance',        'Finance',        true, true),
  ('finance.export',          'finance.export',          'Export Finance',          'Export financial records',                                           'finance',        'Finance',        true, true),
  ('finance.offerings.view',  'finance.offerings.view',  'View Offerings',          'View tithes, offerings and financial records',                       'finance',        'Finance',        true, true),
  ('finance.offerings.edit',  'finance.offerings.edit',  'Edit Offerings',          'Record and edit tithes, offerings and expenses',                     'finance',        'Finance',        true, true),

  -- Admin
  ('admin.view',              'admin.view',              'View Admin Panel',        'Access the admin panel and audit log',                               'admin',          'Admin',          true, true),
  ('admin.users.manage',      'admin.users.manage',      'Manage Users',            'Create and manage user accounts and assembly role assignments',      'admin',          'Admin',          true, true),

  -- Services
  ('services.view',                'services.view',                'View Services',            'View services and attendance records',                 'events',         'Services',       true, true),
  ('services.create',              'services.create',              'Create Services',          'Create new services',                                  'events',         'Services',       true, true),
  ('services.edit',                'services.edit',                'Edit Services',            'Edit existing services',                               'events',         'Services',       true, true),
  ('services.delete',              'services.delete',              'Delete Services',          'Delete services',                                      'events',         'Services',       true, true),
  ('services.templates.manage',    'services.templates.manage',    'Manage Service Templates', 'Create and edit service templates',                    'events',         'Services',       true, true),
  ('services.attendance.mark',     'services.attendance.mark',     'Mark Attendance',          'Mark attendance for services',                         'events',         'Services',       true, true),

  -- Groups
  ('groups.view',              'groups.view',              'View Groups',              'View groups and their members',                               'membership',     'Groups',         true, true),
  ('groups.create',            'groups.create',            'Create Groups',            'Create new groups',                                           'membership',     'Groups',         true, true),
  ('groups.edit',              'groups.edit',              'Edit Groups',              'Edit existing groups',                                        'membership',     'Groups',         true, true),
  ('groups.delete',            'groups.delete',            'Delete Groups',            'Delete groups',                                               'membership',     'Groups',         true, true),
  ('groups.members.manage',    'groups.members.manage',    'Manage Group Members',     'Add and remove members from groups',                          'membership',     'Groups',         true, true),

  -- Pastoral Care
  ('pastoral.view',            'pastoral.view',            'View Pastoral Care',       'View pastoral care records',                                  'membership',     'Pastoral Care',  true, true),
  ('pastoral.manage',          'pastoral.manage',          'Manage Pastoral Care',     'Manage pastoral care records',                                'membership',     'Pastoral Care',  true, true),
  ('pastoral.prayer.manage',   'pastoral.prayer.manage',   'Manage Prayer Requests',   'Manage prayer requests',                                      'membership',     'Pastoral Care',  true, true),

  -- Communications
  ('communications.broadcast.send',           'communications.broadcast.send',           'Send Broadcasts',             'Create and send broadcast campaigns',                         'communications', 'messaging',      true, true),
  ('communications.broadcast.schedule',       'communications.broadcast.schedule',       'Schedule Broadcasts',         'Schedule broadcast campaigns for future delivery',             'communications', 'messaging',      true, true),
  ('communications.direct.send',              'communications.direct.send',              'Send Direct Messages',        'Send direct messages to members',                             'communications', 'messaging',      true, true),
  ('communications.direct.send_pastoral',     'communications.direct.send_pastoral',     'Send Pastoral Messages',      'Create pastoral threads and sensitive direct messages',        'communications', 'pastoral',       true, true),
  ('communications.direct.moderate',          'communications.direct.moderate',          'Moderate Threads',            'Delete any message in any thread',                            'communications', 'moderation',     true, true),
  ('communications.audio.broadcast',          'communications.audio.broadcast',          'Send Audio Broadcasts',       'Upload and broadcast audio messages',                         'communications', 'media',          true, true),
  ('communications.announcements.manage',     'communications.announcements.manage',     'Manage Announcements',        'Post, edit and pin assembly announcements',                   'communications', 'content',        true, true),
  ('communications.templates.manage',         'communications.templates.manage',         'Manage Templates',            'Create and edit message templates and trigger rules',         'communications', 'admin',          true, true),
  ('communications.attachments.view_pastoral','communications.attachments.view_pastoral','View Pastoral Attachments',   'Access media in pastoral and sensitive threads',              'communications', 'pastoral',       true, true),
  ('communications.attachments.manage',       'communications.attachments.manage',       'Manage Attachments',          'Delete any attachment in the assembly',                       'communications', 'admin',          true, true),
  ('communications.reports.view',             'communications.reports.view',             'View Comms Reports',          'View delivery stats, signed URL logs, storage usage',         'communications', 'reporting',      true, true)

ON CONFLICT (key) DO UPDATE SET
  label        = EXCLUDED.label,
  description  = EXCLUDED.description,
  module_name  = EXCLUDED.module_name,
  category     = EXCLUDED.category,
  is_assignable = EXCLUDED.is_assignable;
