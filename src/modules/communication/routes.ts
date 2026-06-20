import type { RouteDefinition } from '../../types/module.types'

export const communicationRoutes: RouteDefinition[] = [
  {
    path: '/communications',
    page: () => import('./CommunicationPage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/campaigns/new',
    page: () => import('./pages/CreateBroadcast'),
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
