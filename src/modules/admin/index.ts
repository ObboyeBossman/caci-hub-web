// src/modules/admin/index.ts
// Updated: routes to AdminPage, sidebar points to /admin.

import type { ModuleManifest }      from '../../types/module.types'
import { registerAdminPermissions } from './manifest'
import { initUserProfileCache, clearUserProfileCache } from './utils/userProfileCache'
import { fetchUserProfile, fetchUserProfiles }         from './repository'

const AdminModule: ModuleManifest = {
  name:        'admin',
  version:     '2.0.0',
  description: 'Accounts, roles, permissions, households, audit log, and assembly settings',
  icon:        'shield-lock',
  enabled:     true,

  routes: [
    {
      path:         '/admin',
      page:         () => import('./AdminPage'),
      middleware:   ['auth', 'mustChangePassword', 'permissions'],
      permission:   'admin.view',
      presentation: 'shell',
    },
  ],

  sidebar: [
    {
      label:      'Administration',
      icon:       'shield-lock',
      path:       '/admin',
      permission: 'admin.view',
      order:      88,
    },
  ],

  async init(_ctx) {
    registerAdminPermissions()
    initUserProfileCache(fetchUserProfile, fetchUserProfiles)
    console.info('[admin] module initialised')
  },

  async dispose() {
    clearUserProfileCache()
    console.info('[admin] module disposed')
  },
}

export default AdminModule