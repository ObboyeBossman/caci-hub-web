// src/core/guards/authGuard.ts
// Redirects unauthenticated users to /login.
// First guard in the middleware pipeline for all protected routes.

import { isAuthenticated }  from '../auth'
import type { RouteDefinition, GuardResult } from '../../types/module.types'

export async function authGuard(
  _route: RouteDefinition,
  _path:  string
): Promise<GuardResult> {
  return isAuthenticated()
    ? { allowed: true }
    : { allowed: false, redirect: '/login' }
}
