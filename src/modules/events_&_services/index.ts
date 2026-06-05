// src/modules/events_&_services/index.ts
import type { ModuleManifest }         from '../../types/module.types'
import { getActiveAssemblyId }         from '@core/auth'
import { servicesRoutes }              from './routes'
import { registerServicesPermissions } from './manifest'
import { subscribeToServices }         from './repository'
import type { RealtimeChannel }        from '@supabase/supabase-js'

let _servicesChannel: RealtimeChannel | null = null

const ServicesModule: ModuleManifest = {
  name:        'services',
  version:     '1.1.0',
  description: 'Services, events, attendance, templates, and reports',
  icon:        'calendar-event-fill',
  enabled:     true,

  routes: servicesRoutes,

  sidebar: [
    {
      label:      'Services & Events',
      path:       '/services',
      icon:       'calendar-event',
      permission: 'services.view',
      order:      40,
    },
    {
      label:      'Schedule',
      path:       '/services?tab=schedule',
      icon:       'calendar3',
      permission: 'services.view',
      order:      41,
      parentPath: '/services',
    },
    {
      label:      'Attendance',
      path:       '/services?tab=attendance',
      icon:       'person-check',
      permission: 'services.attendance.mark',
      order:      42,
      parentPath: '/services',
    },
    {
      label:      'Templates',
      path:       '/services?tab=templates',
      icon:       'journal-album',
      permission: 'services.templates.manage',
      order:      43,
      parentPath: '/services',
    },
    {
      label:      'Reports',
      path:       '/services?tab=reports',
      icon:       'bar-chart-line',
      permission: 'services.view',
      order:      44,
      parentPath: '/services',
    },
    {
      label:      'Events',
      path:       '/services?tab=events',
      icon:       'calendar-event',
      permission: 'services.view',
      order:      45,
      parentPath: '/services',
    },
    {
      label:      'Settings',
      path:       '/services?tab=settings',
      icon:       'gear',
      permission: 'services.view',
      order:      46,
      parentPath: '/services',
    },
  ],

  capabilities: ['dashboard-widgets', 'search', 'reports', 'calendar'],

  widgets: [],

  async init(_ctx) {
    registerServicesPermissions()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      console.info('[services] No assembly — Realtime not started')
      return
    }

    _servicesChannel = subscribeToServices(assemblyId, (_eventType: 'INSERT' | 'UPDATE' | 'DELETE', _id: string) => {
      // Cache invalidation hooks will go here
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
