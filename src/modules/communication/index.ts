// Module metadata
export { CommunicationModule as communicationManifest } from './manifest'
export { communicationRoutes } from './routes'

// Schemas
export * from './schemas'

// Services
export * from './services'

// Hooks
export * from './hooks'

// Widgets
export * from './widgets'

// Utils
export * from './utils'

// Module manifest (default export for registry)
import type { ModuleManifest } from '../../types/module.types'
import { communicationRoutes } from './routes'
import { registerCommunicationPermissions } from './manifest'

const CommunicationModule: ModuleManifest = {
  name:        'communication',
  version:     '1.0.0',
  description: 'Multi-channel messaging, announcements, and audio broadcasts',
  icon:        'message-square',
  enabled:     true,

  routes: communicationRoutes,

  sidebar: [
    {
      label:      'Communications',
      path:       '/communications',
      icon:       'message-square',
      permission: 'communications.broadcast.send',
      order:      40,
    },
    {
      label:      'Campaigns',
      path:       '/communications/campaigns',
      icon:       'megaphone-fill',
      permission: 'communications.broadcast.send',
      order:      41,
      parentPath: '/communications',
    },
    {
      label:      'Messages',
      path:       '/communications/messages',
      icon:       'chat-dots-fill',
      permission: 'communications.direct.send',
      order:      42,
      parentPath: '/communications',
    },
    {
      label:      'Announcements',
      path:       '/communications/announcements',
      icon:       'bullhorn-fill',
      permission: 'communications.announcements.manage',
      order:      43,
      parentPath: '/communications',
    },
    {
      label:      'Templates',
      path:       '/communications/templates',
      icon:       'file-earmark-text-fill',
      permission: 'communications.templates.manage',
      order:      44,
      parentPath: '/communications',
    },
  ],

  capabilities: ['dashboard-widgets'],

  async init(_ctx) {
    registerCommunicationPermissions()
  },
}

export default CommunicationModule
