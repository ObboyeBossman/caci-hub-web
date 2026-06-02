// src/modules/finance/routes.ts
// Routes for the Finance module.

import type { RouteDefinition } from '../../types/module.types'

export const financeRoutes: RouteDefinition[] = [
  // ── Finance Dashboard ─────────────────────────────────────────────────────
  {
    path: '/finance',
    page: () => import('./pages/Finance'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.view',
  },

  // ── Transactions ──────────────────────────────────────────────────────────
  {
    path: '/finance/transactions',
    page: () => import('./pages/Transactions'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.view',
  },
  {
    path: '/finance/transactions/new',
    page: () => import('./pages/TransactionCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.manage',
  },

  // ── Pledges ───────────────────────────────────────────────────────────────
  {
    path: '/finance/pledges',
    page: () => import('./pages/Pledges'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.view',
  },
  {
    path: '/finance/pledges/new',
    page: () => import('./pages/PledgeCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.manage',
  },

  // ── Categories ────────────────────────────────────────────────────────────
  {
    path: '/finance/categories',
    page: () => import('./pages/Categories'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.manage',
  },

  // ── Budgets ───────────────────────────────────────────────────────────────
  {
    path: '/finance/budgets',
    page: () => import('./pages/Budgets'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'finance.view',
  },
]
