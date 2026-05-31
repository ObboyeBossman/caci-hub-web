// src/modules/admin/manifest.ts
// Declares all platform-defined permissions for the Admin module.
// Registered with permissionRegistry at module init.
//
// Keys MUST match values seeded in system_permissions via migration 20260530000006.

import { register } from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export const AdminModule = {
  name: 'admin',
  permissions: [
    {
      key:          PERMISSIONS.ADMIN_VIEW,
      label:        'View Admin Panel',
      description:  'Allows access to the admin panel and audit log',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.ADMIN_USERS_MANAGE,
      label:        'Manage Users',
      description:  'Allows creating and managing user accounts and assembly role assignments',
      category:     'Admin',
      isAssignable: true,
    },
  ],
}

/**
 * Register all Admin module permissions.
 * Called during module init() in admin/index.ts.
 */
export function registerAdminPermissions(): void {
  register({ moduleName: AdminModule.name, permissions: AdminModule.permissions })
}
