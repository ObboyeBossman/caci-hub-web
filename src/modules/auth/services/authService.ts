// src/modules/auth/services/authService.ts
// Ported from: auth_datasource.dart + auth_repository.dart
//
// Design principles mirrored from Flutter:
//   - Service resolves factorId internally (never leaked to UI layer)
//   - enrollTotp() returns a clean typed shape, not raw Supabase data
//   - loadCurrentUser() hydrates isMfaEnrolled + isMfaVerified
//   - mapAuthError() centralises error message mapping

import { supabase } from '../../../core/supabase'
import { emit } from '../../../core/events'
import type { Session, AuthResponse } from '@supabase/supabase-js'
import type { Database } from '../../../types/database.types'

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

// ── Typed return shapes ───────────────────────────────────────────────────────

export interface EnrollTotpResult {
  factorId:  string
  qrCodeUrl: string
  secret:    string
}

export interface HydratedUser {
  id:            string
  email:         string | null
  phone:         string | null
  fullName:      string
  role:          string
  assemblyId:    string | null
  isActive:      boolean
  isMfaEnrolled: boolean
  isMfaVerified: boolean
}

// ── Error mapping ─────────────────────────────────────────────────────────────
// Mirrors: auth_repository.dart _mapAuthException()

export function mapAuthError(err: unknown, mode: 'email' | 'phone' = 'email'): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  if (msg.includes('rate') || msg.includes('too many')) {
    return 'Too many attempts. Please try again in 15 minutes.'
  }
  if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
    return mode === 'phone'
      ? 'Invalid phone number or password.'
      : 'Invalid email or password.'
  }
  if (msg.includes('phone') && (msg.includes('not') || msg.includes('disabled') || msg.includes('unsupported'))) {
    return 'Phone sign-in is not enabled. Please use email or contact your administrator.'
  }
  if (msg.includes('not found') || msg.includes('no user')) {
    return 'Authentication succeeded but no user profile exists. Please contact support.'
  }
  if (msg.includes('mfa') || msg.includes('aal')) {
    return 'MFA verification required.'
  }
  if (msg.includes('refresh_token_already_used') || msg.includes('session')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (msg.includes('pgrst116') || msg.includes('not provisioned')) {
    return 'Your account is not set up yet. Please contact your administrator.'
  }
  return 'An unexpected error occurred. Please try again.'
}

// ── Service ───────────────────────────────────────────────────────────────────

export const authService = {

  // ── Session ────────────────────────────────────────────────────────────────

  async getSession(): Promise<Session | null> {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // ── Email & password ───────────────────────────────────────────────────────

  async signIn(identifier: { email?: string; phone?: string }, password: string): Promise<AuthResponse> {
    const creds = identifier.email 
      ? { email: identifier.email, password } 
      : { phone: identifier.phone!, password };
    const res = await supabase.auth.signInWithPassword(creds as any)
    if (res.error) throw res.error
    return res
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Log but continue — we still flush local state
      console.error('[authService] Error signing out:', error.message)
    }
    emit('auth:signedOut')
  },

  /**
   * Local-scope sign-out: clears locally stored session without
   * invalidating the server session.
   * Mirrors: auth_datasource.dart clearSession()
   */
  async clearPersistedSession(): Promise<void> {
    await supabase.auth.signOut({ scope: 'local' })
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    })
    if (error) throw error
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  // ── TOTP MFA ───────────────────────────────────────────────────────────────

  /**
   * Initiates TOTP enrollment.
   * Returns a clean shaped result — factorId, qrCodeUrl (SVG or URL), secret.
   * Mirrors: auth_repository.dart enrollTotp() named-tuple return
   */
  async enrollTotp(): Promise<EnrollTotpResult> {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'CACI Hub',
    })
    if (error) throw error
    if (!data || !data.totp) throw new Error('TOTP enrollment returned no data.')

    return {
      factorId:  data.id,
      qrCodeUrl: data.totp.qr_code,
      secret:    data.totp.secret,
    }
  },

  /**
   * Verifies a TOTP code.
   * Resolves factorId internally (never leaks Supabase internals to UI).
   * Mirrors: auth_datasource.dart verifyTotp(String code)
   */
  async verifyTotp(code: string): Promise<void> {
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) throw listError

    const totp = factors.totp[0]
    if (!totp) throw new Error('No TOTP factor enrolled for this account.')

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totp.id,
    })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId:    totp.id,
      challengeId: challenge.id,
      code,
    })
    if (verifyError) throw verifyError
  },

  /**
   * Returns true if the current user has at least one verified TOTP factor.
   * Mirrors: auth_datasource.dart hasTotpEnrolled()
   */
  async hasTotpEnrolled(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp.some((f) => f.status === 'verified')
    } catch {
      return false
    }
  },

  /**
   * Remove a TOTP factor from the current user's account.
   * Mirrors: auth_datasource.dart unenrollTotp(String factorId)
   */
  async unenrollTotp(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw error
  },

  // ── Profile ────────────────────────────────────────────────────────────────

  /**
   * Loads the full user profile including MFA state.
   * Mirrors: auth_repository.dart _hydrateProfile()
   * Returns a shaped HydratedUser (not raw Record<string,any>).
   */
  async loadCurrentUser(): Promise<HydratedUser | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return null

    const { data: profile, error: profileError } = await (supabase
      .from('user_profiles') as any)
      .select('id, full_name, role, assembly_id, is_active')
      .eq('id', user.id)
      .single() as { data: UserProfileRow | null; error: any }

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Profile not provisioned yet — auth exists but profile row missing
        throw new Error('Your account is not set up yet. Please contact your administrator.')
      }
      throw profileError
    }

    // Hydrate MFA state — mirrors Flutter _hydrateProfile isMfaEnrolled check
    const isMfaEnrolled = await this.hasTotpEnrolled()

    // isMfaVerified: check AMR claims to confirm AAL2
    const amr = user.app_metadata?.['amr'] as string[] | undefined
    const isMfaVerified = Array.isArray(amr) && amr.includes('mfa')

    return {
      id:            user.id,
      email:         user.email ?? null,
      phone:         user.phone ?? null,
      fullName:      profile?.full_name ?? '',
      role:          profile?.role ?? 'member',
      assemblyId:    profile?.assembly_id ?? null,
      isActive:      profile?.is_active ?? true,
      isMfaEnrolled,
      isMfaVerified,
    }
  },

  /**
   * Re-hydrates the current user after a state change (e.g. after TOTP verify).
   * Mirrors: auth_repository.dart refreshCurrentUser()
   */
  async refreshCurrentUser(): Promise<HydratedUser | null> {
    return this.loadCurrentUser()
  },

  /**
   * Updates the current user's profile fields in user_profiles.
   * Mirrors: auth_datasource.dart updateProfile() + auth_repository.dart updateProfile()
   */
  async updateProfile(fields: {
    fullName?: string
    role?: string
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be signed in to perform this action.')

    const updateData: UserProfileUpdate = { updated_at: new Date().toISOString() }
    if (fields.fullName !== undefined) updateData.full_name = fields.fullName
    if (fields.role !== undefined) updateData.role = fields.role as UserProfileRow['role']

    const { error } = await (supabase
      .from('user_profiles') as any)
      .update(updateData)
      .eq('id', user.id)

    if (error) throw error
  },
}
