import type { RouteDefinition } from '../../types/module.types'

export const communicationRoutes: RouteDefinition[] = [
  {
    path: '/communications',
    page: () => import('./pages/CommunicationsHub'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/campaigns',
    page: () => import('./pages/CampaignsList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/campaigns/:id',
    page: () => import('./pages/CampaignDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/broadcast',
    page: () => import('./pages/CreateBroadcast'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.broadcast.send',
  },
  {
    path: '/communications/audio-broadcast',
    page: () => import('./pages/AudioBroadcast'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.audio.broadcast',
  },
  {
    path: '/communications/messages',
    page: () => import('./pages/MessagesList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.direct.send',
  },
  {
    path: '/communications/announcements',
    page: () => import('./pages/AnnouncementsList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.announcements.manage',
  },
  {
    path: '/communications/templates',
    page: () => import('./pages/TemplatesList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'communications.templates.manage',
  },
]
