// src/modules/admin/manifest.ts
// Updated: expanded permission set covering all admin tabs.

import { register }    from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export const AdminModule = {
  name: 'admin',
  permissions: [
    // ── Legacy (kept for backward compat) ──────────────────────────────────
    {
      key:          PERMISSIONS.ADMIN_VIEW,
      label:        'View Admin Panel',
      description:  'Allows access to the admin panel',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.ADMIN_USERS_MANAGE,
      label:        'Manage Users',
      description:  'Allows creating and managing user accounts and role assignments',
      category:     'Admin',
      isAssignable: true,
    },
    // ── Tab-level permissions ──────────────────────────────────────────────
    {
      key:          'admin.accounts.view',
      label:        'View Accounts',
      description:  'Allows viewing the Accounts tab in Admin',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          'admin.roles.view',
      label:        'View Roles',
      description:  'Allows viewing the Roles tab in Admin',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          'admin.permissions.view',
      label:        'View Permissions',
      description:  'Allows viewing the Permissions matrix in Admin',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          'admin.households.view',
      label:        'View Households',
      description:  'Allows viewing the Households tab in Admin',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          'admin.audit.view',
      label:        'View Audit Log',
      description:  'Allows viewing the Audit Log tab in Admin',
      category:     'Admin',
      isAssignable: true,
    },
    {
      key:          'admin.settings.view',
      label:        'View Settings',
      description:  'Allows viewing and editing assembly settings',
      category:     'Admin',
      isAssignable: true,
    },
  ],
}

export function registerAdminPermissions(): void {
  register({ moduleName: AdminModule.name, permissions: AdminModule.permissions })
}