// src/modules/admin/index.ts
// Admin module manifest — user management, roles, audit log.

import type { ModuleManifest }      from '../../types/module.types'
import { adminRoutes }              from './routes'
import { registerAdminPermissions } from './manifest'
import { initUserProfileCache, clearUserProfileCache } from './utils/userProfileCache'
import { fetchUserProfile, fetchUserProfiles }         from './repository'

const AdminModule: ModuleManifest = {
  name:        'admin',
  version:     '1.0.0',
  description: 'User management, role builder, provisioning, audit log',
  icon:        'shield-lock',
  enabled:     true,

  routes: adminRoutes,

  sidebar: [
    {
      label:      'Users',
      icon:       'people',
      path:       '/admin/users',
      permission: 'admin.users.manage',
      order:      88,
    },
    {
      label:      'Roles',
      icon:       'key-fill',
      path:       '/admin/roles',
      permission: 'admin.users.manage',
      order:      89,
    },
    {
      label:      'Security & Audit',
      icon:       'shield-lock',
      path:       '/admin/audit',
      permission: 'admin.view',
      order:      90,
    },
  ],

  async init(_ctx) {
    registerAdminPermissions()
    // Wire the cache with repository fetchers.
    initUserProfileCache(fetchUserProfile, fetchUserProfiles)
    console.info('[admin] userProfileCache initialised')
  },

  async dispose() {
    clearUserProfileCache()
    console.info('[admin] userProfileCache cleared')
  },
}

export default AdminModule