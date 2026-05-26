// src/shared/composables/usePermission.ts
// Reads assembly permissions from the active Supabase session's app_metadata.
//
// No extra DB call — the JWT sync trigger on user_profiles keeps this up-to-date.
// A session refresh (login / token refresh) is required to see new permissions.
//
// Usage:
//   import { hasAssemblyPermission } from '@shared/composables/usePermission'
//
//   if (await hasAssemblyPermission('financials:view')) { ... }

import { supabase } from '@core/supabase'

/** Cached permissions from the last session load (cleared on page reload). */
let _cachedPermissions: string[] | null = null

/**
 * Clear the in-memory cache.
 * Call this after a sign-in / sign-out event so the next call fetches fresh data.
 */
export function clearPermissionCache(): void {
  _cachedPermissions = null
}

/**
 * Returns the array of assembly permission IDs for the current user,
 * loaded from `session.user.app_metadata.permissions`.
 * Returns [] when there is no session or no permissions array.
 */
async function getSessionPermissions(): Promise<string[]> {
  if (_cachedPermissions !== null) return _cachedPermissions

  const { data: { session } } = await supabase.auth.getSession()
  const raw = session?.user?.app_metadata?.['permissions']
  _cachedPermissions = Array.isArray(raw) ? (raw as string[]) : []
  return _cachedPermissions
}

/**
 * Returns true if the current user's session contains `permission`
 * in their `app_metadata.permissions` array.
 *
 * @example
 *   if (await hasAssemblyPermission('financials:view')) { ... }
 */
export async function hasAssemblyPermission(permission: string): Promise<boolean> {
  const perms = await getSessionPermissions()
  return perms.includes(permission)
}

/**
 * Returns the full list of assembly permission IDs the current user holds.
 * Useful for rendering permission badge lists.
 */
export async function getAssemblyPermissions(): Promise<string[]> {
  return getSessionPermissions()
}
