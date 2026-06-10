import type { RouteConfig } from '@/types/routing'

export const communicationRoutes: RouteConfig[] = [
  {
    path: '/communications',
    name: 'Communications',
    component: 'CommunicationsHub',
    requiredPermissions: ['communications.broadcast.send'],
    children: [
      {
        path: 'campaigns',
        name: 'Campaigns',
        component: 'CampaignsList'
      },
      {
        path: 'campaigns/:id',
        name: 'Campaign Details',
        component: 'CampaignDetail'
      },
      {
        path: 'broadcast',
        name: 'New Broadcast',
        component: 'CreateBroadcast',
        requiredPermissions: ['communications.broadcast.send']
      },
      {
        path: 'audio-broadcast',
        name: 'Audio Broadcast',
        component: 'AudioBroadcast',
        requiredPermissions: ['communications.audio.broadcast']
      },
      {
        path: 'messages',
        name: 'Messages',
        component: 'MessagesList'
      },
      {
        path: 'announcements',
        name: 'Announcements',
        component: 'AnnouncementsList'
      },
      {
        path: 'templates',
        name: 'Templates',
        component: 'TemplatesList',
        requiredPermissions: ['communications.templates.manage']
      }
    ]
  }
]
