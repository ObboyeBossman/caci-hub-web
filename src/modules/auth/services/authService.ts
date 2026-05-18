// src/modules/auth/services/authService.ts
// Ported from: supabase_auth_data_source.dart and auth_repository.dart

import { supabase } from '../../../core/supabase'
import { emit } from '../../../core/events'
import type { Session, AuthResponse, AuthMFAEnrollResponse, AuthMFAVerifyResponse } from '@supabase/supabase-js'

export const authService = {
  /**
   * Retrieves the current Supabase session.
   */
  async getSession(): Promise<Session | null> {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  /**
   * Signs in with email and password.
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    const res = await supabase.auth.signInWithPassword({ email, password })
    if (res.error) throw res.error
    return res
  },

  /**
   * Signs out the user, flushing both member and group caches via the event bus.
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[authService] Error signing out', error)
      // We still emit signedOut so local state clears even if server fails
    }
    emit('auth:signedOut')
  },

  /**
   * Sends a password reset email using magic links.
   */
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  /**
   * Updates the authenticated user's password.
   */
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  /**
   * Initiates TOTP enrollment.
   */
  async enrollTotp(): Promise<any> {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'CACI Hub',
    })
    if (error) throw error
    return data as any
  },

  /**
   * Verifies the provided TOTP code against an enrolled factor.
   */
  async verifyTotp(factorId: string, code: string): Promise<any> {
    // Challenge the factor to get a challengeId
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) throw challengeError

    // Verify using the acquired challengeId
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })
    if (error) throw error
    return data
  },

  /**
   * Returns true if the user has at least one verified TOTP enrolled.
   */
  async hasTotpEnrolled(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const verifiedTotp = data.totp.find((factor) => factor.status === 'verified')
      return verifiedTotp !== undefined
    } catch {
      return false
    }
  },

  /**
   * Load the current user's profile data from 'user_profiles' table
   */
  async loadCurrentUser(): Promise<Record<string, any> | null> {
    const session = await this.getSession()
    if (!session || !session.user) return null

    const { data, error } = await supabase
      .from('user_profiles')
      .select()
      .eq('id', session.user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // Ignore 116 (No rows found) - user might exist in Auth but not in profiles yet
      console.error('[authService] Failed to load current user profile:', error)
    }

    return data
  }
}
