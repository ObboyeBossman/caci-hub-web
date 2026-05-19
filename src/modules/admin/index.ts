// src/modules/admin/index.ts
// Admin module — disabled until Phase 2.
// enabled: false → registerModule() silently skips it.
// Zero routes, zero sidebar entry, init() never called.

import type { ModuleManifest } from '../../types/module.types'
import { adminRoutes }         from './routes'

const AdminModule: ModuleManifest = {
  name:        'admin',
  version:     '0.1.0',
  description: 'User management, provisioning, global audit log (Phase 2)',
  icon:        'shield-lock',
  enabled:     false,   // ← invisible to the entire app until Phase 2

  routes: adminRoutes,

  sidebar: {
    label:      'Admin',
    icon:       'shield-lock',
    path:       '/admin/users',
    permission: 'admin.access',
    order:      90,
  },
}

export default AdminModule