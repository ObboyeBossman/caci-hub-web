// src/core/permissions.ts
// DEPRECATED — this file is retained only for backward compatibility.
// All new code should import from:
//   core/authorization/authorization-service.ts  → can(), hasPermission(), requirePermission()
//   core/authorization/permissions.ts             → PERMISSIONS constants
//
// The old static rolePermissions map is no longer authoritative.
// Permissions are now resolved at login by loading the user's assembly role
// from the database (see auth.ts loadCurrentUser()).

export { can as hasPermission } from './authorization/authorization-service'
export { PERMISSIONS }          from './authorization/permissions'
export type { Permission }      from './authorization/permissions'
