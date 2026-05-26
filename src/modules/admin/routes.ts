// src/modules/admin/routes.ts
// All admin routes — guarded with permission: 'admin.access'.
// Module is disabled (enabled: false in index.ts) so these never register.

import type { RouteDefinition } from '../../types/module.types'

export const adminRoutes: RouteDefinition[] = [
  {
    path: '/admin/audit',
    page: () => import('./pages/GlobalAuditLog'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.access',
  },
]