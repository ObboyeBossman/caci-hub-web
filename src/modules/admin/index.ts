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
    { label: 'Accounts',      path: '/admin?tab=accounts',    parentPath: '/admin', permission: 'admin.accounts.view',   order: 1, icon: '' },
    { label: 'Roles',         path: '/admin?tab=roles',       parentPath: '/admin', permission: 'admin.roles.view',      order: 2, icon: '' },
    { label: 'Permissions',   path: '/admin?tab=permissions', parentPath: '/admin', permission: 'admin.permissions.view',order: 3, icon: '' },
    { label: 'Households',    path: '/admin?tab=households',  parentPath: '/admin', permission: 'admin.households.view', order: 4, icon: '' },
    { label: 'Audit Log',     path: '/admin?tab=audit',       parentPath: '/admin', permission: 'admin.audit.view',      order: 5, icon: '' },
    { label: 'Settings',      path: '/admin?tab=settings',    parentPath: '/admin', permission: 'admin.settings.view',   order: 6, icon: '' },
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