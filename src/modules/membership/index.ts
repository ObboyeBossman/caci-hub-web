// src/modules/membership/index.ts
// The single public contract of the membership module.
// Nothing inside this module is imported from outside — only this manifest.
//
// init() responsibilities:
//   1. Wire memberCache and groupCache fetchers
//   2. Subscribe to Supabase Realtime (members + households channels)
//   3. Emit typed events → cache invalidation runs automatically via listeners
//      registered in initMemberCache() / initGroupCache()
//
// dispose() responsibilities:
//   1. Unsubscribe all Realtime channels
//   2. Caches self-clear via auth:signedOut listener (already registered in initMemberCache)

import type { ModuleManifest }  from '../../types/module.types'
import { initMemberCache }      from './utils/memberCache'
import { initGroupCache }       from './utils/groupCache'
import { emit }                 from '@core/events'
import { getActiveAssemblyId }  from '@core/auth'
import { membershipRoutes }     from './routes'
import {
  getMemberSummary,
  getMemberSummaries,
  subscribeToMembers,
  subscribeToHouseholds,
} from './repository'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Realtime channel refs — managed entirely by this module ───────────────────
let _memberChannel:    RealtimeChannel | null = null
let _householdChannel: RealtimeChannel | null = null

// ── Module manifest ───────────────────────────────────────────────────────────
const MembershipModule: ModuleManifest = {
  name:        'membership',
  version:     '1.0.0',
  description: 'Member directory, households, groups, attendance, pastoral care, reports',
  icon:        'people-fill',
  enabled:     true,

  routes: membershipRoutes,

  sidebar: [
    {
      label:      'All Members',
      path:       '/members',
      icon:       'people-fill',
      permission: 'membership.view',
      order:      10,
    },
    {
      label:      'Attendance',
      path:       '/attendance',
      icon:       'calendar-check-fill',
      permission: 'membership.view',
      order:      20,
    },
    {
      label:      'Groups & Units',
      path:       '/groups',
      icon:       'diagram-3-fill',
      permission: 'membership.view',
      order:      30,
    },
    {
      label:      'Pastoral Care',
      path:       '/pastoral-care',
      icon:       'heart-fill',
      permission: 'membership.view',
      order:      40,
    },
    {
      label:      'Reports',
      path:       '/reports',
      icon:       'bar-chart-fill',
      permission: 'membership.view',
      order:      50,
    },
    {
      label:      'Audit Log',
      path:       '/audit-log',
      icon:       'journal-text',
      permission: 'admin.view',
      order:      85,
    },
  ],

  capabilities: ['dashboard-widgets', 'search', 'reports'],

  widgets: [
    {
      id:         'new-members',
      component:  () => import('./widgets/NewMembersWidget'),
      permission: 'membership.view',
      size:       'small',
      order:      10,
    },
    {
      id:         'member-stats',
      component:  () => import('./widgets/MemberStatsWidget'),
      permission: 'membership.view',
      size:       'medium',
      order:      20,
    },
  ],

  // ── init() — called once at boot after loadCurrentUser() ──────────────────
  async init(_ctx) {
    // 1. Wire memberCache with repository fetchers
    //    The cache registers its own invalidation listeners (member:updated,
    //    member:deleted, member:restored, auth:signedOut) inside initMemberCache.
    initMemberCache(getMemberSummary, getMemberSummaries)

    // 2. Wire groupCache — groups module not yet implemented; wire stubs
    //    so groupCache doesn't warn on every access
    initGroupCache(
      async (_id) => null,   // TODO: wire real group fetcher in Phase 4g
      async (_ids) => []
    )

    // 3. Subscribe to Realtime — only when we have an active assembly
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      // super_admin without assembly selection — skip Realtime for now.
      // When they select an assembly (auth:assemblyChanged), a page refresh
      // is expected; subscriptions will be set up on next boot.
      console.info('[membership] No assembly selected — Realtime not started')
      return
    }

    // Members channel
    _memberChannel = subscribeToMembers(assemblyId, (eventType, id) => {
      switch (eventType) {
        case 'INSERT':
          // new member — no cache entry yet, no-op for cache
          emit('member:registered', { id })
          break
        case 'UPDATE':
          emit('member:updated', { id })
          break
        case 'DELETE':
          emit('member:deleted', { id })
          break
      }
    })

    // Households channel
    _householdChannel = subscribeToHouseholds(assemblyId, (eventType, id) => {
      switch (eventType) {
        case 'INSERT':
          emit('household:created', { id })
          break
        case 'UPDATE':
          emit('household:updated', { id })
          break
        case 'DELETE':
          emit('household:deleted', { id })
          break
      }
    })

    console.info(`[membership] Realtime subscribed for assembly ${assemblyId}`)
  },

  // ── dispose() — called on module unload (future lazy unloading) ───────────
  async dispose() {
    await _memberChannel?.unsubscribe()
    await _householdChannel?.unsubscribe()
    _memberChannel    = null
    _householdChannel = null
    console.info('[membership] Realtime unsubscribed')
  },
}

export default MembershipModule