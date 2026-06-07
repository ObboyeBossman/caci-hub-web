// src/modules/membership/manifest.ts
// Declares all platform-defined permissions for the Membership module.
// Registered with permissionRegistry at module init.
//
// Keys MUST match values seeded in system_permissions via migration 20260530000006.
// DO NOT add permissions here without also adding them to the migration seed.

import { register } from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export const MembershipModule = {
  name: 'membership',
  permissions: [
    {
      key:          PERMISSIONS.MEMBERS_VIEW,
      label:        'View Members',
      description:  'Allows viewing the member directory and individual member records',
      category:     'Members',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.MEMBERS_CREATE,
      label:        'Create Members',
      description:  'Allows creating new member records',
      category:     'Members',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.MEMBERS_EDIT,
      label:        'Edit Members',
      description:  'Allows editing existing member records',
      category:     'Members',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.MEMBERS_DEACTIVATE,
      label:        'Deactivate Members',
      description:  'Allows soft-deactivating member records',
      category:     'Members',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.MEMBERS_IMPORT,
      label:        'Import Members',
      description:  'Allows bulk importing member records via CSV or spreadsheet',
      category:     'Members',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.HOUSEHOLDS_VIEW,
      label:        'View Households',
      description:  'Allows viewing household records and member groupings',
      category:     'Households',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.HOUSEHOLDS_CREATE,
      label:        'Create Households',
      description:  'Allows creating new household records',
      category:     'Households',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.HOUSEHOLDS_EDIT,
      label:        'Edit Households',
      description:  'Allows editing existing household records',
      category:     'Households',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.GROUPS_VIEW,
      label:        'View Groups',
      description:  'Allows viewing groups and age groups',
      category:     'Groups',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.GROUPS_CREATE,
      label:        'Create Groups',
      description:  'Allows creating new group records',
      category:     'Groups',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.GROUPS_EDIT,
      label:        'Edit Groups',
      description:  'Allows editing existing group records',
      category:     'Groups',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.GROUPS_DELETE,
      label:        'Delete Groups',
      description:  'Allows soft-deleting group records',
      category:     'Groups',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.GROUPS_MEMBERS_MANAGE,
      label:        'Manage Group Members',
      description:  'Allows adding and removing members from groups',
      category:     'Groups',
      isAssignable: true,
    },
    // ── Pastoral ────────────────────────────────────────────────────────────
    {
      key:          PERMISSIONS.PASTORAL_VIEW,
      label:        'View Pastoral Care',
      description:  'Allows viewing pastoral cases, visits, and prayer requests',
      category:     'Pastoral',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.PASTORAL_MANAGE,
      label:        'Manage Pastoral Care',
      description:  'Allows creating and updating pastoral cases and visits',
      category:     'Pastoral',
      isAssignable: true,
    },
    {
      key:          PERMISSIONS.PASTORAL_PRAYER_MANAGE,
      label:        'Manage Prayer Requests',
      description:  'Allows updating the status of prayer requests',
      category:     'Pastoral',
      isAssignable: true,
    },
  ],
}

/**
 * Register all Membership module permissions.
 * Called during module init() in membership/index.ts.
 */
export function registerMembershipPermissions(): void {
  register({ moduleName: MembershipModule.name, permissions: MembershipModule.permissions })
}
