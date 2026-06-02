// src/modules/pastoral/index.ts
// The public contract of the Pastoral Care module.

import type { ModuleManifest }        from '../../types/module.types'
import { getActiveAssemblyId }        from '@core/auth'
import { pastoralRoutes }             from './routes'
import { registerPastoralPermissions } from './manifest'
import { subscribeToCases }           from './repository'
import type { RealtimeChannel }       from '@supabase/supabase-js'

let _casesChannel: RealtimeChannel | null = null

const PastoralModule: ModuleManifest = {
  name:        'pastoral',
  version:     '1.0.0',
  description: 'Pastoral cases, visits & prayer requests',
  icon:        'heart-pulse',
  enabled:     true,

  routes: pastoralRoutes,

  sidebar: [
    {
      label:      'Pastoral Care',
      path:       '/pastoral',
      icon:       'heart-pulse',
      permission: 'pastoral.view',
      order:      70,
    },
  ],

  capabilities: ['dashboard-widgets'],

  widgets: [],

  async init(_ctx) {
    registerPastoralPermissions()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      console.info('[pastoral] No assembly selected — Realtime not started')
      return
    }

    _casesChannel = subscribeToCases(assemblyId, (_eventType, _id) => {
      // Future: emit('pastoral:case:updated', { id }) for dashboard widget refresh
    })

    console.info(`[pastoral] Realtime subscribed for assembly ${assemblyId}`)
  },

  async dispose() {
    await _casesChannel?.unsubscribe()
    _casesChannel = null
    console.info('[pastoral] Realtime unsubscribed')
  },
}

export default PastoralModule
