// src/modules/auth/index.ts

import type { ModuleManifest } from '../../types/module.types'
import { routes } from './routes'

export const authModule: ModuleManifest = {
  name: 'auth',
  version: '1.0.0',
  description: 'Authentication functionality',
  enabled: true,
  routes,
}

export default authModule
