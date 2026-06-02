// src/modules/pastoral/routes.ts
// Routes for the Pastoral Care module.

import type { RouteDefinition } from '../../types/module.types'

export const pastoralRoutes: RouteDefinition[] = [
  // ── Cases Dashboard ────────────────────────────────────────────────────────
  {
    path: '/pastoral',
    page: () => import('./pages/Pastoral'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.view',
  },

  // ── Cases ─────────────────────────────────────────────────────────────────
  {
    path: '/pastoral/cases',
    page: () => import('./pages/Cases'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.view',
  },
  {
    path: '/pastoral/cases/new',
    page: () => import('./pages/CaseCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.manage',
  },
  {
    path: '/pastoral/cases/:id',
    page: () => import('./pages/CaseDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.view',
  },

  // ── Prayer Requests ────────────────────────────────────────────────────────
  {
    path: '/pastoral/prayer-requests',
    page: () => import('./pages/PrayerRequests'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.view',
  },
  {
    path: '/pastoral/prayer-requests/new',
    page: () => import('./pages/PrayerRequestCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'pastoral.prayer.manage',
  },
]
