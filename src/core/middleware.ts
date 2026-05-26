// src/core/middleware.ts
// Composes guards into a sequential pipeline.
// Guards run in the order declared in the route's `middleware` array.
// First denial wins — the pipeline short-circuits immediately.
//
// Adding a new guard:
//   1. Create one file in src/core/guards/
//   2. Add one entry to guardMap
//   3. Reference the key string in any route's middleware array
//   No other files change.

import { authGuard }        from './guards/authGuard'
import { permissionGuard }  from './guards/permissionGuard'
import { onboardingGuard }  from './guards/onboardingGuard'
import { mustChangePasswordGuard } from './guards/mustChangePasswordGuard'
import type { RouteDefinition, GuardResult, GuardFn } from '../types/module.types'

/** Registry of all available guard keys → guard functions. */
const guardMap: Record<string, GuardFn> = {
  auth:        authGuard,
  permissions: permissionGuard,
  onboarding:  onboardingGuard,
  mustChangePassword: mustChangePasswordGuard,
}

/**
 * Run the middleware pipeline for a matched route.
 * Returns { allowed: true } if all guards pass, or the first
 * { allowed: false, redirect } result from a guard that denies.
 */
export async function runMiddleware(
  route: RouteDefinition,
  path:  string
): Promise<GuardResult> {
  for (const key of route.middleware ?? []) {
    const guard = guardMap[key]
    if (!guard) {
      console.warn(`[middleware] Unknown guard key: "${key}" — skipping`)
      continue
    }
    const result = await guard(route, path)
    if (!result.allowed) return result
  }
  return { allowed: true }
}
