// src/modules/admin/routes.ts
// All admin routes — guarded with RBAC permissions.

import type { RouteDefinition } from '../../types/module.types'

export const adminRoutes: RouteDefinition[] = [
  {
    path: '/admin/audit',
    page: () => import('./pages/GlobalAuditLog'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.view',
  },
  {
    path: '/admin/roles',
    page: () => import('./pages/RoleBuilder'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.users.manage',
  },
  {
    path: '/admin/users',
    page: () => import('./pages/UserManagement'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.users.manage',
  },
  {
    path: '/admin/users/provision/select-member',
    page: () => import('./pages/SelectMemberToProvision'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.users.manage',
  },
  {
    path: '/admin/users/provision/:memberId',
    page: () => import('./pages/ProvisionUser'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.users.manage',
  },
  {
    path: '/admin/users/:id',
    page: () => import('./pages/AccountDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.users.manage',
  },
]