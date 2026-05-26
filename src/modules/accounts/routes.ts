// src/modules/accounts/routes.ts

import type { RouteDefinition } from '../../types/module.types'

export const accountsRoutes: RouteDefinition[] = [
  {
    path:       '/accounts',
    page:       () => import('./pages/AccountList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'accounts.access',
  },
  {
    path:       '/accounts/provision/select-member',
    page:       () => import('./pages/SelectMemberToProvision'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'accounts.access',
  },
  {
    path:       '/accounts/provision/:memberId',
    page:       () => import('./pages/ProvisionAccount'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'accounts.access',
  },
  {
    path:       '/accounts/roles',
    page:       () => import('./pages/RoleManagerPage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'accounts.access',
  },
  {
    path:       '/accounts/:id',
    page:       () => import('./pages/AccountDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'accounts.access',
  },
]
