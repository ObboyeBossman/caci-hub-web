// src/modules/services/routes.ts
// Route definitions for the Services module.

import type { RouteDefinition } from '../../types/module.types'

export const servicesRoutes: RouteDefinition[] = [
  // ── Services ──────────────────────────────────────────────────────────────
  {
    path:       '/services',
    page:       () => import('./pages/ServiceList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.view',
  },
  {
    path:       '/services/new',
    page:       () => import('./pages/CreateService'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.create',
  },
  {
    path:       '/services/:id',
    page:       () => import('./pages/ServiceDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.view',
  },
  {
    path:       '/services/:id/edit',
    page:       () => import('./pages/EditService'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.edit',
  },
  {
    path:       '/services/:id/attendance',
    page:       () => import('./pages/RecordServiceAttendance'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.attendance.mark',
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  {
    path:       '/service-templates',
    page:       () => import('./pages/TemplateList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.templates.manage',
  },
  {
    path:       '/service-templates/new',
    page:       () => import('./pages/CreateTemplate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.templates.manage',
  },
  {
    path:       '/service-templates/:id/edit',
    page:       () => import('./pages/EditTemplate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'services.templates.manage',
  },
]
