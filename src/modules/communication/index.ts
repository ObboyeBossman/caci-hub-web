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
  name: 'communication',
  version: '1.0.0',
  description: 'Multi-channel messaging, announcements, and audio broadcasts',
  icon: 'message-square',
  enabled: true,

  routes: communicationRoutes,

  sidebar: [
    {
      label: 'All Broadcasts',
      path: '/communications',
      icon: 'message-square',
      permission: 'communications.broadcast.send',
      order: 40,
    },
    
  ],

  capabilities: ['dashboard-widgets'],

  async init(_ctx) {
    registerCommunicationPermissions()
  },
}

export default CommunicationModule
