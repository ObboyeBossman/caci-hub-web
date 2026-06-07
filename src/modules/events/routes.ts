// src/modules/events_&_services/routes.ts
import type { RouteDefinition } from '../../types/module.types'

export const servicesRoutes: RouteDefinition[] = [
  {
    path:         '/services',
    page:         () => import('./pages/Services'),
    middleware:   ['auth', 'mustChangePassword', 'permissions'],
    permission:   'services.view',
    presentation: 'shell',
  },
]
