// src/modules/finance/manifest.ts

import { register } from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export function registerFinancePermissions(): void {
  register({
    moduleName: 'finance',
    permissions: [
      {
        key:          PERMISSIONS.FINANCE_VIEW,
        label:        'View Finance',
        description:  'Allows viewing transactions, pledges, budgets, and reports',
        category:     'Finance',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.FINANCE_MANAGE,
        label:        'Manage Finance',
        description:  'Allows creating and editing transactions, pledges, and budgets',
        category:     'Finance',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.FINANCE_EXPORT,
        label:        'Export Finance Reports',
        description:  'Allows exporting finance data as CSV/PDF',
        category:     'Finance',
        isAssignable: true,
      },
    ],
  })
}