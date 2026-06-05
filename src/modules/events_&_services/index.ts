// src/modules/services/index.ts
// The single public contract of the services module.

import type { ModuleManifest }  from '../../types/module.types'
import { getActiveAssemblyId }  from '@core/auth'
import { servicesRoutes }       from './routes'
import { registerServicesPermissions }  from './manifest'
import { subscribeToServices }  from './repository'
import type { RealtimeChannel } from '@supabase/supabase-js'

let _servicesChannel: RealtimeChannel | null = null

const ServicesModule: ModuleManifest = {
  name:        'services',
  version:     '1.0.0',
  description: 'Services, events, attendance, and templates',
  icon:        'calendar-event-fill',
  enabled:     true,

  routes: servicesRoutes,

  sidebar: [
    {
      label:      'All Services',
      path:       '/services',
      icon:       'calendar-event',
      permission: 'services.view',
      order:      50,
    },
    {
      label:      'Service Templates',
      path:       '/service-templates',
      icon:       'journal-album',
      permission: 'services.templates.manage',
      order:      55,
    },
  ],

  capabilities: ['dashboard-widgets', 'search', 'reports'],

  widgets: [
    /* To be implemented: quick summary widget for services */
  ],

  async init(_ctx) {
    registerServicesPermissions()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      console.info('[services] No assembly selected — Realtime not started')
      return
    }

    _servicesChannel = subscribeToServices(assemblyId, (eventType, id) => {
      // Future cache invalidations will go here via emit()
      // console.debug('[services realtime]', eventType, id)
    })

    console.info(`[services] Realtime subscribed for assembly ${assemblyId}`)
  },

  async dispose() {
    await _servicesChannel?.unsubscribe()
    _servicesChannel = null
    console.info('[services] Realtime unsubscribed')
  },
}

export default ServicesModule
