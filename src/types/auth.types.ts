// auth.types.ts
// Mirrors: auth_user.dart, user_role.dart, auth_state_provider.dart
// Source of truth for all auth-related types in the web app.

import type { Database } from './database.types'

// ── UserRole ─────────────────────────────────────────────────────────────────
// Mirrors: user_role.dart (all enum values including future-phase roles)
// Source: migration 20260427000001_create_enums.sql user_role enum
export type UserRole = Database['public']['Enums']['user_role']

// Phase 1 active roles (from user_role.dart + migration)
export const PHASE1_ROLES = [
  'admin',
  'pastor',
  'secretary',
  'volunteer',
  'member',
] as const satisfies UserRole[]

// ── UserProfile ───────────────────────────────────────────────────────────────
// Mirrors: Database['public']['Tables']['user_profiles']['Row']
// The row from user_profiles joined after Supabase Auth confirms identity.
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// ── AppUser ───────────────────────────────────────────────────────────────────
// Mirrors: auth_user.dart AuthUser class
// Combines auth.users fields with user_profiles fields.
// Populated by core/auth.ts loadCurrentUser() after login.
export interface AppUser {
  // From auth.users
  id:              string
  email:           string | null
  phone:           string | null

  // From user_profiles (joined after auth)
  fullName:        string        // user_profiles.full_name
  role:            UserRole      // user_profiles.role
  assemblyId:      string | null // user_profiles.assembly_id; null only for super-admin before assembly selection
  isActive:        boolean       // user_profiles.is_active

  // MFA state — from supabase.auth.mfa.listFactors()
  // Mirrors: auth_user.dart isMfaEnrolled + isMfaVerified
  isMfaEnrolled:   boolean
  isMfaVerified:   boolean
}

// ── Role capability helpers ───────────────────────────────────────────────────
// Mirrors: user_role.dart computed properties
export function canManageMembers(role: UserRole): boolean {
  return role === 'admin' || role === 'secretary'
}

export function canEditPastoralNotes(role: UserRole): boolean {
  return role === 'admin' || role === 'pastor'
}

export function canViewAuditLog(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

export function hasDashboardAccess(role: UserRole): boolean {
  return ['admin', 'pastor', 'national_admin', 'district_overseer'].includes(role)
}

// MFA required roles — mirrors user_role.dart requiresMfa
// Currently false for all roles (re-enable when MFA enrollment flow is ready)
export function requiresMfa(_role: UserRole): boolean {
  return false
  // Future: return ['admin', 'pastor', 'national_admin', 'district_overseer'].includes(role)
}
