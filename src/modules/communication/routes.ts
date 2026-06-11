import type { RouteDefinition } from '../../types/module.types'

export const communicationRoutes: RouteDefinition[] = [
  {
    path: '/communications',
    page: () => import('./CommunicationPage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send', // This acts as the base entry permission for now
  },
]
