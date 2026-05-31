// src/core/guards/permissionGuard.ts
// Checks whether the current user is permitted to access a route.
// Delegates to authorization-service.ts (admin bypass + permission array check).
// Runs after authGuard in the middleware pipeline.
//
// If no permission is declared on the route, access is granted to all authenticated users.

import { getCurrentUser }  from '../auth'
import { can }             from '../authorization/authorization-service'
import type { RouteDefinition, GuardResult } from '../../types/module.types'

export async function permissionGuard(
  route: RouteDefinition,
  _path: string
): Promise<GuardResult> {
  // No permission requirement declared — allow all authenticated users
  if (!route.permission) return { allowed: true }

  const user = getCurrentUser()
  // Should not reach here without authGuard first, but be defensive
  if (!user) return { allowed: false, redirect: '/login' }

  return can(user, route.permission)
    ? { allowed: true }
    : { allowed: false, redirect: '/unauthorized' }
}
