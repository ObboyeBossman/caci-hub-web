// src/core/authorization/permissions.ts
// Platform-defined permission constants.
// These must exactly match the `key` values seeded in system_permissions via migrations.
//
// Naming convention: <module>.<resource>.<action> (dot-separated, lowercase only)
// Examples: 'members.view', 'finance.offerings.edit'
//
// DO NOT:
//   - Add camelCase or underscored names
//   - Create permissions at runtime
//   - Hardcode permission strings elsewhere in the app — import from here

export const PERMISSIONS = {
  // ── Membership: Members ─────────────────────────────────────────────────────
  MEMBERS_VIEW:       'members.view',
  MEMBERS_CREATE:     'members.create',
  MEMBERS_EDIT:       'members.edit',
  MEMBERS_DEACTIVATE: 'members.deactivate',
  MEMBERS_IMPORT:     'members.import',
  MEMBERS_EXPORT:     'members.export',

  // ── Membership: Households ───────────────────────────────────────────────────
  HOUSEHOLDS_VIEW:    'households.view',
  HOUSEHOLDS_CREATE:  'households.create',
  HOUSEHOLDS_EDIT:    'households.edit',

  // ── Reports ───────────────────────────────────────────────────────────────────
  REPORTS_VIEW:       'reports.view',
  REPORTS_EXPORT:     'reports.export',


  // ── Admin ─────────────────────────────────────────────────────────────────────
  ADMIN_VIEW:           'admin.view',
  ADMIN_USERS_MANAGE:   'admin.users.manage',

  // ── Services ─────────────────────────────────────────────────────────────────
  SERVICES_VIEW:              'services.view',
  SERVICES_CREATE:            'services.create',
  SERVICES_EDIT:              'services.edit',
  SERVICES_DELETE:            'services.delete',
  SERVICES_TEMPLATES_MANAGE:  'services.templates.manage',
  SERVICES_ATTENDANCE_MARK:   'services.attendance.mark',

  // ── Groups ────────────────────────────────────────────────────────────────
  GROUPS_VIEW:            'groups.view',
  GROUPS_CREATE:          'groups.create',
  GROUPS_EDIT:            'groups.edit',
  GROUPS_DELETE:          'groups.delete',
  GROUPS_MEMBERS_MANAGE:  'groups.members.manage',

  // ── Finance ────────────────────────────────────────────────────────────────
  FINANCE_VIEW:    'finance.view',
  FINANCE_MANAGE:  'finance.manage',
  FINANCE_EXPORT:  'finance.export',

  // ── Pastoral Care ──────────────────────────────────────────────────────────
  PASTORAL_VIEW:          'pastoral.view',
  PASTORAL_MANAGE:        'pastoral.manage',
  PASTORAL_PRAYER_MANAGE: 'pastoral.prayer.manage',
} as const

/** Union of all valid platform permission keys. */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

/** Definition shape for a permission as declared in a module manifest. */
export interface PermissionDefinition {
  key:          Permission | string  // string for future modules not yet in constants
  label:        string
  description?: string
  category:     string
  isAssignable: boolean
}
