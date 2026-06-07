// src/core/auth.ts
// Loads the current user from Supabase Auth + user_profiles table.
// Also resolves the user's assembly role permissions at login so they
// are available synchronously throughout the app via getCurrentUser().
//
// RULES:
//   - loadCurrentUser() MUST be called before startRouter()
//   - getCurrentUser() returns null when unauthenticated
//   - permissions[] is populated from DB at login; admin has empty [] (bypass applies)

import { supabase } from './supabase'
import { emit }     from './events'
import type { AppUser } from '../types/auth.types'

let _currentUser: AppUser | null = null
let _activeAssemblyId: string | null = null

/**
 * Fetch the Supabase Auth user, join their user_profiles row,
 * and resolve their assembly role permissions.
 * Called once at boot (main.ts), and again on auth state change.
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
    console.error('[auth] user_profiles row not found or error for', user.id, error)
    await supabase.auth.signOut()
    _currentUser = null
    _activeAssemblyId = null
    return
  }

  console.log('[auth] Profile loaded successfully:', profile)

  const p = profile as any

  // Resolve permissions from assembly role → role_permissions → system_permissions
  // Admin bypass: don't bother loading permissions (admin has all access)
  let permissions: string[] = []
  const assemblyRoleId: string | null = p.assembly_role_id ?? null
  let assemblyRoleName: string | null = null

  if (p.role === 'member' && assemblyRoleId) {
    const { data: rolePerms, error: rpErr } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', assemblyRoleId)

    if (rpErr) {
      console.warn('[auth] Failed to load role permissions:', rpErr)
    } else {
      permissions = (rolePerms ?? []).map((r: any) => r.permission_key)
    }
  }

  // Fetch assembly role name for display (optional)
  if (assemblyRoleId) {
    try {
      const { data: roleRow, error: rrErr } = await supabase
        .from('assembly_roles')
        .select('name')
        .eq('id', assemblyRoleId)
        .single()
      if (!rrErr && roleRow) assemblyRoleName = (roleRow as any).name ?? null
    } catch (e) {
      console.warn('[auth] Failed to load assembly role name', e)
    }
  }

  _currentUser = {
    id:                   user.id,
    email:                user.email ?? null,
    phone:                user.phone ?? null,
    fullName:             (p.full_name as string) ?? '',
    role:                 p.role as 'admin' | 'member',
    assemblyId:           (p.assembly_id as string) ?? null,
    assemblyRoleId,
    assemblyRoleName,
    permissions,
    isActive:             p.is_active as boolean,
    must_change_password: p.must_change_password as boolean,
    isMfaEnrolled:        false,
    isMfaVerified:        false,
  }

  // Automatically sign out if account is deactivated
  if (!_currentUser.isActive) {
    console.warn('[auth] User is deactivated. Signing out immediately.')
    await supabase.auth.signOut()
    _currentUser = null
    _activeAssemblyId = null
    return
  }

  _activeAssemblyId = (p.assembly_id as string | null)
}

/** Returns the current authenticated user, or null. */
export const getCurrentUser = (): AppUser | null => _currentUser

/** True only when a user is loaded and active. */
export const isAuthenticated = (): boolean =>
  !!_currentUser && _currentUser.isActive

/**
 * Returns the active assembly UUID.
 * null when unauthenticated.
 */
export const getActiveAssemblyId = (): string | null => _activeAssemblyId

/**
 * Set the active assembly — for future multi-assembly support.
 * Emits 'auth:assemblyChanged' so caches can clear.
 */
export function setActiveAssemblyId(id: string): void {
  _activeAssemblyId = id
  localStorage.setItem('caci:active_assembly_id', id)
  emit('auth:assemblyChanged', { assemblyId: id })
}

/**
 * Clear current user state — called on signOut.
 */
export function clearCurrentUser(): void {
  _currentUser = null
  _activeAssemblyId = null
  emit('auth:signedOut')
}

/**
 * Subscribe to Supabase auth state changes.
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
