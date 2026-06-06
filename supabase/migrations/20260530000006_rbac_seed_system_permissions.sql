-- =============================================================================
-- CACI Hub — Migration 20260530000006_rbac_seed_system_permissions
-- Purpose:  RBAC Phase 6 — Seed all platform-defined permissions into
--           system_permissions. These are declared in module manifests and
--           owned by the platform — not creatable by assemblies at runtime.
--
-- Permission naming: <module>.<resource>.<action> (dot-notation only)
-- Use ON CONFLICT (key) DO UPDATE to keep this idempotent.
-- Never hard-delete permissions — use is_active = false to deprecate.
--
-- Depends on: 20260530000001 (system_permissions table with key column)
-- =============================================================================

INSERT INTO public.system_permissions (id, key, label, description, module_name, category, is_assignable, is_active) VALUES

  -- ── Membership: Members ────────────────────────────────────────────────────
  ('members.view',       'members.view',       'View Members',       'Allows viewing the member directory and individual member records',         'membership', 'Members',    true,  true),
  ('members.create',     'members.create',     'Create Members',     'Allows creating new member records',                                        'membership', 'Members',    true,  true),
  ('members.edit',       'members.edit',       'Edit Members',       'Allows editing existing member records',                                    'membership', 'Members',    true,  true),
  ('members.deactivate', 'members.deactivate', 'Deactivate Members', 'Allows soft-deactivating member records',                                   'membership', 'Members',    true,  true),
  ('members.import',     'members.import',     'Import Members',     'Allows bulk importing member records via CSV or spreadsheet',               'membership', 'Members',    true,  true),
  ('members.export',     'members.export',     'Export Members',     'Allows exporting member records to CSV or other formats',                   'membership', 'Members',    true,  true),

  -- ── Membership: Households ────────────────────────────────────────────────
  ('households.view',    'households.view',    'View Households',    'Allows viewing household records and member groupings',                     'membership', 'Households', true,  true),
  ('households.create',  'households.create',  'Create Households',  'Allows creating new household records',                                     'membership', 'Households', true,  true),
  ('households.edit',    'households.edit',    'Edit Households',    'Allows editing existing household records',                                 'membership', 'Households', true,  true),

  -- ── Reports ────────────────────────────────────────────────────────────────
  ('reports.view',       'reports.view',       'View Reports',       'Allows viewing generated reports and dashboards',                           'reports',    'Reports',    true,  true),
  ('reports.export',     'reports.export',     'Export Reports',     'Allows downloading and exporting reports to CSV/PDF',                       'reports',    'Reports',    true,  true),

  -- ── Finance ────────────────────────────────────────────────────────────────
  ('finance.offerings.view',  'finance.offerings.view',  'View Offerings',  'Allows viewing tithes, offerings and financial records',            'finance',    'Finance',    true,  true),
  ('finance.offerings.edit',  'finance.offerings.edit',  'Edit Offerings',  'Allows recording and editing tithes, offerings and expenses',       'finance',    'Finance',    true,  true),

  -- ── Admin ──────────────────────────────────────────────────────────────────
  ('admin.view',          'admin.view',          'View Admin Panel',   'Allows access to the admin panel and audit log',                          'admin',      'Admin',      true,  true),
  ('admin.users.manage',  'admin.users.manage',  'Manage Users',       'Allows creating and managing user accounts and assembly role assignments', 'admin',      'Admin',      true,  true)

ON CONFLICT (key) DO UPDATE SET
  label        = EXCLUDED.label,
  description  = EXCLUDED.description,
  module_name  = EXCLUDED.module_name,
  category     = EXCLUDED.category,
  is_assignable = EXCLUDED.is_assignable;
  -- NOTE: is_active is NOT updated on conflict — deprecation is a manual decision.

COMMENT ON TABLE public.system_permissions IS
  'Platform-owned permission catalogue. Rows are seeded via migrations only — '
  'never created at runtime. Permissions are assigned to assembly_roles via '
  'role_permissions. Assemblies may only use is_assignable = true permissions.';
