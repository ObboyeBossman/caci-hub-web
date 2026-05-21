// src/core/auth.ts
// Loads the current user from Supabase Auth + user_profiles table.
// Manages the active assembly context (critical for super_admin).
//
// Mirrors: auth_repository.dart _hydrateProfile / _mapProfile (Flutter)
//          auth_state_provider.dart currentUserProvider
//
// RULES:
//   - loadCurrentUser() MUST be called before startRouter()
//   - getCurrentUser() returns null when unauthenticated
//   - super_admin must select an assembly via the Toolbar before data access;
//     getActiveAssemblyId() returns null until they do
//   - All repository getAll() methods check getActiveAssemblyId() for super_admin

import { supabase } from './supabase'
import { emit }     from './events'
import type { AppUser } from '../types/auth.types'

let _currentUser: AppUser | null = null
let _activeAssemblyId: string | null = null

/**
 * Fetch the Supabase Auth user then join their user_profiles row.
 * Mirrors: auth_repository.dart _hydrateProfile()
 *
 * Called once at boot (main.ts), and again after login/logout via
 * supabase.auth.onAuthStateChange() if the app needs live updates.
 */
export async function loadCurrentUser(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('[auth] No session user found in loadCurrentUser')
    _currentUser = null
    _activeAssemblyId = null
    return
  }

  console.log('[auth] Loading profile for user.id:', user.id)
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    // PGRST116 = no row found — user exists in auth but not provisioned yet
    console.error('[auth] user_profiles row not found or error for', user.id, error)
    _currentUser = null
    _activeAssemblyId = null
    return
  }

  console.log('[auth] Profile loaded successfully:', profile)


  // Mirrors: auth_repository.dart _mapProfile()
  const p = profile as any // Fallback to any if inference fails, but use correct property names
  _currentUser = {
    id:           user.id,
    email:        user.email ?? null,
    phone:        user.phone ?? null,
    fullName:     (p.full_name as string) ?? '',
    role:         p.role,
    assemblyId:   (p.assembly_id as string) ?? null,
    isActive:     p.is_active as boolean,
    // MFA state is checked lazily in the onboarding guard.
    // Setting defaults here; Phase 3 auth module will set real values.
    isMfaEnrolled:  false,
    isMfaVerified:  false,
  }

  // super_admin has no RLS restriction and must select an assembly explicitly.
  // All other roles are auto-scoped to their assembly_id via RLS.
  _activeAssemblyId =
    p.role === 'national_admin' || p.role === 'district_overseer'
      ? null
      : (p.assembly_id as string | null)
}

/** Returns the current authenticated user, or null. */
export const getCurrentUser = (): AppUser | null => _currentUser

/** True only when a user is loaded and active. */
export const isAuthenticated = (): boolean =>
  !!_currentUser && _currentUser.isActive

/**
 * Returns the active assembly UUID.
 * null for super-admin who hasn't selected an assembly yet,
 * or when unauthenticated.
 */
export const getActiveAssemblyId = (): string | null => _activeAssemblyId

/**
 * Set the active assembly — called by Toolbar when super_admin switches assembly.
 * Emits 'auth:assemblyChanged' so memberCache and groupCache can clear.
 */
export function setActiveAssemblyId(id: string): void {
  _activeAssemblyId = id
  emit('auth:assemblyChanged', { assemblyId: id })
}

/**
 * Clear current user state — called on signOut.
 * Emits 'auth:signedOut' so all caches invalidate.
 */
export function clearCurrentUser(): void {
  _currentUser = null
  _activeAssemblyId = null
  emit('auth:signedOut')
}

/**
 * Subscribe to Supabase auth state changes.
 * Useful for keeping _currentUser in sync without a full page reload.
 * The auth module (Phase 3) calls this in its init() hook.
 */
export function onAuthStateChange(
  callback: (user: AppUser | null) => void
): void {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      clearCurrentUser()
      callback(null)
      return
    }
    await loadCurrentUser()
    callback(_currentUser)
  })
}
