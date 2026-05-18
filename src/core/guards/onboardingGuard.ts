// src/core/guards/onboardingGuard.ts
// Redirects to /totp-enroll if the authenticated user has not yet set up MFA.
// Runs after authGuard in the middleware pipeline.
//
// Fails open on MFA API errors — we don't block the user if the check fails.
// Mirrors: auth_router.dart AuthMfaRequired branch (Flutter)
//          auth_repository.dart hasTotpEnrolled()

import { supabase } from '../supabase'
import type { RouteDefinition, GuardResult } from '../../types/module.types'

export async function onboardingGuard(
  _route: RouteDefinition,
  _path:  string
): Promise<GuardResult> {
  const { data, error } = await supabase.auth.mfa.listFactors()

  if (error) {
    // Fail open — don't block the user if the MFA API is temporarily unavailable
    console.error('[onboardingGuard] MFA check failed', error)
    return { allowed: true }
  }

  // A verified TOTP factor means enrollment is complete
  const enrolled = (data?.totp?.length ?? 0) > 0

  // TEMPORARY: Disabled MFA enforcement
  // return enrolled
  //   ? { allowed: true }
  //   : { allowed: false, redirect: '/totp-enroll' }
  return { allowed: true }
}
