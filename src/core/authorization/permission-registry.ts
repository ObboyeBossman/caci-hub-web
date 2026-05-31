// src/core/authorization/permission-registry.ts
// Collects PermissionDefinition objects from module manifests.
// Validates for duplicate keys and naming convention violations.
// Provides a catalogue for UI consumers (e.g. Role Builder) and for
// build-time seeding scripts.
//
// RULES:
//   - Permissions MUST be registered at module init, not at runtime
//   - Permission keys MUST follow <module>.<resource>.<action> dot-notation
//   - Duplicate keys are rejected with a thrown error
//   - Only assemblies, via admin UI, assign permissions to roles
//   - This registry never writes to the database

import type { PermissionDefinition } from './permissions'

export interface ModulePermissionManifest {
  moduleName:  string
  permissions: PermissionDefinition[]
}

const _registry: Map<string, PermissionDefinition & { moduleName: string }> = new Map()

/**
 * Validates a permission key conforms to dot-notation: lowercase letters, dots, no spaces.
 * Valid:   'members.view', 'finance.offerings.edit'
 * Invalid: 'editMembers', 'view_reports', 'members Edit'
 */
function isValidKey(key: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(key)
}

/**
 * Register all permissions declared by a module manifest.
 * Called by each module's manifest.ts at boot time.
 *
 * Throws if:
 *   - A permission key already exists from a different module
 *   - A key violates the dot-notation naming convention
 */
export function register(manifest: ModulePermissionManifest): void {
  for (const perm of manifest.permissions) {
    if (!isValidKey(perm.key)) {
      throw new Error(
        `[PermissionRegistry] Invalid permission key "${perm.key}" in module "${manifest.moduleName}". ` +
        `Keys must use dot-notation: <module>.<resource>.<action> (lowercase only, no underscores or spaces).`
      )
    }

    const existing = _registry.get(perm.key)
    if (existing && existing.moduleName !== manifest.moduleName) {
      throw new Error(
        `[PermissionRegistry] Duplicate permission key "${perm.key}": ` +
        `already registered by module "${existing.moduleName}", ` +
        `cannot re-register from "${manifest.moduleName}".`
      )
    }

    _registry.set(perm.key, { ...perm, moduleName: manifest.moduleName })
  }
}

/**
 * Returns all registered permissions across all modules.
 * Sorted by moduleName → category → key for consistent ordering.
 */
export function getAll(): (PermissionDefinition & { moduleName: string })[] {
  return [..._registry.values()].sort((a, b) => {
    if (a.moduleName !== b.moduleName) return a.moduleName.localeCompare(b.moduleName)
    if (a.category !== b.category)    return a.category.localeCompare(b.category)
    return a.key.localeCompare(b.key)
  })
}

/**
 * Returns permissions registered by a specific module.
 */
export function getByModule(moduleName: string): (PermissionDefinition & { moduleName: string })[] {
  return [..._registry.values()].filter(p => p.moduleName === moduleName)
}

/**
 * Returns assignable permissions only (isAssignable = true).
 * These are the permissions an admin may attach to assembly roles.
 */
export function getAssignable(): (PermissionDefinition & { moduleName: string })[] {
  return getAll().filter(p => p.isAssignable)
}

/**
 * Validate the entire registry for correctness.
 * Call this after all modules have registered, before the app boot completes.
 * Checks for duplicate keys across modules.
 */
export function validate(): void {
  // Check for duplicate keys (this would have thrown during register(), but
  // this is a second-pass safety net for dynamic module loading scenarios)
  const keys = [..._registry.keys()]
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`[PermissionRegistry] validate() found duplicate key: "${key}"`)
    }
    seen.add(key)
  }
}

/**
 * Returns the total count of registered permissions.
 * Useful for debug logging at boot.
 */
export function count(): number {
  return _registry.size
}
