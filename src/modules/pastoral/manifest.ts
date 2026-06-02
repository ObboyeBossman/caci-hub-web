// src/modules/pastoral/manifest.ts
// Declares all platform-defined permissions for the Pastoral Care module.
// Registered with permissionRegistry at module init.

import { register }    from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export function registerPastoralPermissions(): void {
  register({
    moduleName: 'pastoral',
    permissions: [
      {
        key:          PERMISSIONS.PASTORAL_VIEW,
        label:        'View Pastoral Cases',
        description:  'Allows viewing assigned pastoral cases, visits, and prayer requests',
        category:     'Pastoral Care',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.PASTORAL_MANAGE,
        label:        'Manage Pastoral Cases',
        description:  'Allows creating, editing, and closing pastoral cases and visits',
        category:     'Pastoral Care',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.PASTORAL_PRAYER_MANAGE,
        label:        'Manage Prayer Requests',
        description:  'Allows creating and updating prayer requests for the assembly',
        category:     'Pastoral Care',
        isAssignable: true,
      },
    ],
  })
}
