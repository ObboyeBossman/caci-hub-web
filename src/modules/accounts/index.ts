// src/modules/accounts/index.ts
// Accounts module — manages user login accounts, roles, and provisioning.
// Gated by 'accounts.access' — admin and super-admin roles only.

import type { ModuleManifest }      from '../../types/module.types'
import { accountsRoutes }           from './routes'
import { initUserProfileCache, clearUserProfileCache } from './utils/userProfileCache'
import { fetchUserProfile, fetchUserProfiles }         from './repository'

const AccountsModule: ModuleManifest = {
  name:        'accounts',
  version:     '1.0.0',
  description: 'User account provisioning, role management, and account lifecycle',
  icon:        'person-badge-fill',
  enabled:     true,

  routes: accountsRoutes,

  sidebar: [
    {
      label: 'Accounts',
      icon: 'person-badge',
      path: '/accounts',
      permission: 'accounts.access',
      order: 90,
    }
  ],

  async init(_ctx) {
    // Wire the cache with repository fetchers.
    // The cache registers its own invalidation listeners inside initUserProfileCache.
    initUserProfileCache(fetchUserProfile, fetchUserProfiles)
    console.info('[accounts] userProfileCache initialised')
  },

  async dispose() {
    clearUserProfileCache()
    console.info('[accounts] userProfileCache cleared')
  },
}

export default AccountsModule
