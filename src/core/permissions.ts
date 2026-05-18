// src/core/permissions.ts
// Role → permission set mapping.
// Authoritative source: CACI_Hub_Phase1_Roles_Permissions_Matrix.md
//
// Permission string format: 'module.action'
//   e.g. 'membership.view', 'membership.create', 'finance.view'
//
// Wildcard: 'module.*' grants all permissions in that module namespace.
// Super-wildcard: '*' grants everything (admin, super_admin).
//
// Three enforcement layers (architecture doc §13):
//   1. permissionGuard — blocks navigation entirely
//   2. hasPermission() in-page — shows/hides action buttons
//   3. Supabase RLS — enforced at database layer regardless of UI
//
// Phase 1 active roles: admin, pastor, secretary, volunteer, member
// Future roles (declared in DB enum, not yet active in UI):
//   finance_officer, welfare_officer, cell_leader, elder,
//   children_worker, media_officer, district_overseer, national_admin

const rolePermissions: Record<string, string[]> = {
  // ── Phase 1 active ────────────────────────────────────────────────────────
  // admin: full access — mirrors user_role.dart canManageMembers/canManageUsers
  admin: ['*'],

  // pastor: broad read + pastoral notes write + dashboard
  // Mirrors: user_role.dart canEditPastoralNotes, hasDashboardAccess
  // Source: matrix §4.1 (directory ✅), §4.2 (profile ✅), §4.8 (dashboard ✅)
  //         §4.12 (pastoral notes view+write ✅), no create/delete
  pastor: [
    'membership.*',
    'communication.*',
    'pastoral-care.*',
    'events.*',
    'groups.*',
    'reports.view',
    'dashboard.view',
  ],

  // secretary: create + edit, no delete, no dashboard, no pastoral notes
  // Mirrors: user_role.dart canManageMembers (admin || secretary)
  // Source: matrix §4.3 (add ✅), §4.4 (edit ✅), §4.5 (delete ❌)
  //         §4.6 (households create/edit ✅, delete ❌), §4.8 (dashboard ❌)
  secretary: [
    'membership.view',
    'membership.create',
    'membership.edit',
    'households.view',
    'households.create',
    'households.edit',
    'groups.view',
    'attendance.view',
    'profile.view',
  ],

  // volunteer: read-only directory access
  // Source: matrix §4.1 (directory ✅), §4.2 (profile view ✅, no emergency contact)
  //         §4.3-4.5 (all ❌), §4.8 (dashboard ❌)
  volunteer: [
    'membership.view',
    'households.view',
    'groups.view',
    'events.view',
    'attendance.view',
    'profile.view',
  ],

  // member: own record only — no directory
  // Source: matrix §4.2 (own record ✏️ only), §4.1 (directory ❌)
  member: [
    'profile.view',
    'events.view',
    'media.view',
    'giving.view',
  ],

  // ── Future roles (grant minimal safe defaults until activated) ────────────
  finance_officer:  ['finance.*', 'giving.*', 'reports.*', 'membership.view'],
  welfare_officer:  ['membership.view', 'pastoral-care.*', 'groups.view'],
  cell_leader:      ['groups.*', 'attendance.*', 'membership.view'],
  elder:            ['membership.view', 'pastoral-care.view', 'reports.view'],
  children_worker:  ['membership.view', 'groups.view', 'attendance.*'],
  media_officer:    ['media.*', 'events.view'],
  district_overseer: ['*'],
  national_admin:   ['*'],
}

/**
 * Returns true if `role` has been granted `permission`.
 *
 * Matching rules (in order):
 *   1. Super-wildcard '*'  → grants everything
 *   2. Exact match         → 'membership.view' matches 'membership.view'
 *   3. Namespace wildcard  → 'membership.*' matches 'membership.view'
 *   4. Empty permission    → always allowed (no restriction declared)
 */
export function hasPermission(role: string, permission: string): boolean {
  if (!permission) return true
  const perms = rolePermissions[role] ?? []
  if (perms.includes('*')) return true
  if (perms.includes(permission)) return true
  const [ns] = permission.split('.')
  return perms.includes(`${ns}.*`)
}
