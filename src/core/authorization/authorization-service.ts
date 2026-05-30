// src/core/authorization/authorization-service.ts
// Application-layer permission enforcement.
// This is the single authority for "can this user do X?" decisions.
//
// Architecture rules (non-negotiable):
//   - Admin bypass: user.role === 'admin' immediately returns true
//   - Member path: check user.permissions[] array (loaded from JWT / DB at login)
//   - NO permission inference — only exact key match
//   - NO calls to the database at check time (permissions are pre-loaded)
//   - NOT called inside RLS policies — RLS only knows admin/member distinction
//
// Authorization flow:
//   User → Assembly Role → Permissions (array loaded at login)

import type { AppUser } from '../../types/auth.types'
import type { Permission } from './permissions'

/**
 * Returns true if the user is permitted to perform the given action.
 *
 * Rules:
 *   1. Admin → always true (bypasses all permission checks)
 *   2. Otherwise → checks user.permissions array for an exact match
 *
 * @param user       The authenticated AppUser (from getCurrentUser())
 * @param permission The permission key to check (e.g. 'members.view')
 */
export function can(user: AppUser, permission: Permission | string): boolean {
  if (!user) return false

  // Rule 1: Admin bypass — admin has unrestricted access to everything
  if (user.role === 'admin') return true

  // Rule 2: Exact permission key match in user's loaded permission set
  return user.permissions.includes(permission)
}

/**
 * Alias for can() — more readable in UI contexts.
 *
 * @example
 *   if (hasPermission(user, PERMISSIONS.MEMBERS_EDIT)) { ... }
 */
export function hasPermission(user: AppUser, permission: Permission | string): boolean {
  return can(user, permission)
}

/**
 * Throws an error if the user does not have the given permission.
 * Use in service functions and edge function handlers to gate mutations.
 *
 * @throws Error with code 'FORBIDDEN' if permission is denied
 *
 * @example
 *   requirePermission(user, PERMISSIONS.MEMBERS_EDIT)
 *   // continues only if allowed, otherwise throws
 */
export function requirePermission(user: AppUser, permission: Permission | string): void {
  if (!can(user, permission)) {
    const err: any = new Error(
      `Permission denied: user "${user.id}" does not have "${permission}"`
    )
    err.code = 'FORBIDDEN'
    throw err
  }
}

/**
 * Returns true if the user holds the admin system role.
 * Convenience helper for UI conditional rendering.
 */
export function isAdmin(user: AppUser | null): boolean {
  return user?.role === 'admin'
}

/**
 * Returns true if the user holds the member system role.
 * All non-admin users are members; their assembly role grants fine-grained access.
 */
export function isMember(user: AppUser | null): boolean {
  return user?.role === 'member'
}
