// src/modules/finance/index.ts

import type { ModuleManifest }  from '../../types/module.types'
import { getActiveAssemblyId }  from '@core/auth'
import { financeRoutes }        from './routes'
import { registerFinancePermissions } from './manifest'
import { subscribeToFinance }   from './repository'
import type { RealtimeChannel } from '@supabase/supabase-js'

let _channels: ReturnType<typeof subscribeToFinance> | null = null

const FinanceModule: ModuleManifest = {
  name:        'finance',
  version:     '1.0.0',
  description: 'Church stewardship — transactions, pledges, budgets, and reports',
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
    { label: 'Transactions', path: '/finance?tab=transactions', parentPath: '/finance', permission: 'finance.view', order: 1, icon: '' },
    { label: 'Pledges',      path: '/finance?tab=pledges',      parentPath: '/finance', permission: 'finance.view', order: 2, icon: '' },
    { label: 'Budget',       path: '/finance?tab=budget',       parentPath: '/finance', permission: 'finance.view', order: 3, icon: '' },
    { label: 'Reports',      path: '/finance?tab=reports',      parentPath: '/finance', permission: 'finance.view', order: 4, icon: '' },
  ],

  capabilities: ['dashboard-widgets', 'search', 'reports'],

  widgets: [],

  async init(_ctx) {
    registerFinancePermissions()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      console.info('[finance] No assembly selected — Realtime not started')
      return
    }

    _channels = subscribeToFinance(assemblyId, (table, eventType, id) => {
      // Future: invalidate caches via emit()
    })

    console.info(`[finance] Realtime subscribed for assembly ${assemblyId}`)
  },

  async dispose() {
    if (_channels) {
      await Promise.all(_channels.map(ch => ch.unsubscribe()))
      _channels = null
    }
    console.info('[finance] Realtime unsubscribed')
  },
}

export default FinanceModule