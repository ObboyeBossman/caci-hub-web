// src/modules/finance/manifest.ts
// Declares platform-defined permissions for the Finance module.

import { register } from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export function registerFinancePermissions(): void {
  register({
    moduleName: 'finance',
    permissions: [
      {
        key:          PERMISSIONS.FINANCE_VIEW,
        label:        'View Finance',
        description:  'Allows viewing transactions, pledges, budgets, and categories',
        category:     'Finance',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.FINANCE_MANAGE,
        label:        'Manage Finance',
        description:  'Allows creating, editing, and deleting all finance records',
        category:     'Finance',
        isAssignable: true,
      },
    ],
  })
}
