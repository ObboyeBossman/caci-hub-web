// src/core/guards/permissionGuard.ts
// Checks whether the current user's role satisfies the route's declared permission.
// Runs after authGuard in the middleware pipeline.
//
// If no permission is declared on the route, access is granted.
// Mirrors: Flutter GoRouter redirect logic in auth_router.dart

import { getCurrentUser }  from '../auth'
import { hasPermission }   from '../permissions'
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

  return hasPermission(user.role, route.permission)
    ? { allowed: true }
    : { allowed: false, redirect: '/unauthorized' }
}
