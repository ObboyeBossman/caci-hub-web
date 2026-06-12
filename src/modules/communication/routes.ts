import type { RouteDefinition } from '../../types/module.types'

export const communicationRoutes: RouteDefinition[] = [
  {
    path: '/communications',
    page: () => import('./CommunicationPage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/:tab',
    page: () => import('./CommunicationPage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
]
