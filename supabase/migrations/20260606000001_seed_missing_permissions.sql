-- =============================================================================
-- CACI Hub — Migration 20260606000001_seed_missing_permissions
-- Purpose:  Seed recently added modules' permissions (Services, Groups,
--           Pastoral Care, Finance updates) that were added to frontend
--           constants but missing from the database.
-- =============================================================================

INSERT INTO public.system_permissions (id, key, label, description, module_name, category, is_assignable, is_active) VALUES

  -- ── Services ─────────────────────────────────────────────────────────────
  ('services.view',              'services.view',              'View Services',             'Allows viewing services and attendance records',     'events', 'Services', true, true),
  ('services.create',            'services.create',            'Create Services',           'Allows creating new services',                       'events', 'Services', true, true),
  ('services.edit',              'services.edit',              'Edit Services',             'Allows editing existing services',                   'events', 'Services', true, true),
  ('services.delete',            'services.delete',            'Delete Services',           'Allows deleting services',                           'events', 'Services', true, true),
  ('services.templates.manage',  'services.templates.manage',  'Manage Service Templates',  'Allows creating and editing service templates',      'events', 'Services', true, true),
  ('services.attendance.mark',   'services.attendance.mark',   'Mark Attendance',           'Allows marking attendance for services',             'events', 'Services', true, true),

  -- ── Groups ───────────────────────────────────────────────────────────────
  ('groups.view',                'groups.view',                'View Groups',               'Allows viewing groups and their members',            'membership', 'Groups', true, true),
  ('groups.create',              'groups.create',              'Create Groups',             'Allows creating new groups',                         'membership', 'Groups', true, true),
  ('groups.edit',                'groups.edit',                'Edit Groups',               'Allows editing existing groups',                     'membership', 'Groups', true, true),
  ('groups.delete',              'groups.delete',              'Delete Groups',             'Allows deleting groups',                             'membership', 'Groups', true, true),
  ('groups.members.manage',      'groups.members.manage',      'Manage Group Members',      'Allows adding and removing members from groups',     'membership', 'Groups', true, true),

  -- ── Finance ──────────────────────────────────────────────────────────────
  ('finance.view',               'finance.view',               'View Finance',              'Allows viewing financial records',                   'finance', 'Finance', true, true),
  ('finance.manage',             'finance.manage',             'Manage Finance',            'Allows managing and editing financial records',      'finance', 'Finance', true, true),
  ('finance.export',             'finance.export',             'Export Finance',            'Allows exporting financial records',                 'finance', 'Finance', true, true),

  -- ── Pastoral Care ────────────────────────────────────────────────────────
  ('pastoral.view',              'pastoral.view',              'View Pastoral Care',        'Allows viewing pastoral care records',               'membership', 'Pastoral Care', true, true),
  ('pastoral.manage',            'pastoral.manage',            'Manage Pastoral Care',      'Allows managing pastoral care records',              'membership', 'Pastoral Care', true, true),
  ('pastoral.prayer.manage',     'pastoral.prayer.manage',     'Manage Prayer Requests',    'Allows managing prayer requests',                    'membership', 'Pastoral Care', true, true)

ON CONFLICT (key) DO UPDATE SET
  label         = EXCLUDED.label,
  description   = EXCLUDED.description,
  module_name   = EXCLUDED.module_name,
  category      = EXCLUDED.category,
  is_assignable = EXCLUDED.is_assignable;
