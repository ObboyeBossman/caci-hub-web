// src/modules/finance/index.ts
// The public contract of the Finance module.

import type { ModuleManifest }          from '../../types/module.types'
import { getActiveAssemblyId }          from '@core/auth'
import { financeRoutes }                from './routes'
import { registerFinancePermissions }   from './manifest'
import { subscribeToTransactions }      from './repository'
import type { RealtimeChannel }         from '@supabase/supabase-js'

let _txChannel: RealtimeChannel | null = null

const FinanceModule: ModuleManifest = {
  name:        'finance',
  version:     '1.0.0',
  description: 'Tithes, offerings, pledges, budgets & expense tracking',
  icon:        'cash-coin',
  enabled:     true,

  routes: financeRoutes,

  sidebar: [
    {
      label:      'Finance',
      path:       '/finance',
      icon:       'cash-coin',
      permission: 'finance.view',
      order:      60,
    },
  ],

  capabilities: ['dashboard-widgets', 'reports'],

  widgets: [],

  async init(_ctx) {
    registerFinancePermissions()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      console.info('[finance] No assembly selected — Realtime not started')
      return
    }

    _txChannel = subscribeToTransactions(assemblyId, (_eventType, _id) => {
      // Future: emit('finance:transaction:updated', { id }) for dashboard widget refresh
    })

    console.info(`[finance] Realtime subscribed for assembly ${assemblyId}`)
  },

  async dispose() {
    await _txChannel?.unsubscribe()
    _txChannel = null
    console.info('[finance] Realtime unsubscribed')
  },
}

export default FinanceModule
