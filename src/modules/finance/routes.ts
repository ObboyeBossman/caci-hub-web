// src/modules/finance/routes.ts

import type { RouteDefinition } from '../../types/module.types'

export const financeRoutes: RouteDefinition[] = [
  {
    path:       '/finance',
    page:       () => import('./pages/FinancePage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.view',
  },
]