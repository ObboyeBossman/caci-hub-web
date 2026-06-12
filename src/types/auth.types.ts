// auth.types.ts
// Source of truth for all auth-related types in the CACI Hub web app.
//
// RBAC model:
//   user_profiles.role = 'admin' | 'member'  (system role — DB-enforced)
//   user_profiles.assembly_role_id → assembly_roles → role_permissions → system_permissions
//
// Permission flow: User → Assembly Role → Permissions (array hydrated at login)
// Admin bypass: user.role === 'admin' grants all permissions at app layer

// ── SystemRole ────────────────────────────────────────────────────────────────
// Two system roles only — enforced by CHECK constraint on user_profiles.role.
// admin: bypasses all permission checks
// member: requires explicit permission via assembly role
export type SystemRole = 'admin' | 'member'

// ── AppUser ────────────────────────────────────────────────────────────────────
// Populated by core/auth.ts loadCurrentUser() after login.
// Combines auth.users fields + user_profiles + resolved permissions.
export interface AppUser {
  // From auth.users
  id:    string
  email: string | null
  phone: string | null

  // From user_profiles
  fullName:   string       // user_profiles.full_name
  role:       SystemRole   // user_profiles.role — 'admin' | 'member' only
  assemblyId: string | null

  // Assembly role (optional custom role within the assembly)
  assemblyRoleId: string | null  // user_profiles.assembly_role_id → assembly_roles
  assemblyRoleName?: string | null // hydrated name for the assembly role (if assigned)

  // Resolved permission keys for this user (from their assembly role → role_permissions)
  // Empty array for members with no assembly role (or no permissions assigned).
  // Admin: ignored — admin bypass is applied before this array is checked.
  permissions: string[]

  // Account state
  isActive:             boolean
  must_change_password: boolean

  // MFA state
  isMfaEnrolled: boolean
  isMfaVerified: boolean

  // Display
  avatarUrl: string | null
}
