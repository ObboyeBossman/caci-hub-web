// src/auth/auth-guard.ts
//
// Auth guard — called after the splash session check.
// Decides what to render next:
//   • Valid session  → renders the Members Portal homepage
//   • No session     → renders the login screen

import type { Session } from '@supabase/supabase-js'
import { supabase } from '../core/supabase'
import { showToast } from '../core/toast'

/**
 * Evaluates the session and routes to the correct next view.
 * @param app   The root #app element.
 * @param session  The Supabase session (null = unauthenticated).
 */
export async function guardRoute(app: HTMLElement, session: Session | null): Promise<void> {
  console.log('[auth-guard] Evaluating route. Session:', session ? 'Active' : 'None')

  if (session) {
    console.log('[auth-guard] Session valid — user:', session.user.phone || session.user.email)
    
    try {
      // Query user role to determine routing
      // Use maybeSingle() to avoid PGRST116 error if profile is missing
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('[auth-guard] Profile query error:', error)
        throw new Error(`Database Error: ${error.message} (Code: ${error.code})`)
      }

      if (!profile) {
        console.error('[auth-guard] Profile missing for UID:', session.user.id);
        // Force sign out because the user exists in Auth but has no application profile
        await supabase.auth.signOut();
        throw new Error('Account Incomplete: Your login exists but no CACI profile was found. Please contact your Assembly Admin to provision your account correctly.');
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Account Suspended: Your access to CACI Hub has been deactivated by an administrator.');
      }

      if (profile.role === 'admin') {
        console.log('[auth-guard] Admin role detected — routing to Admin Portal.')
        showToast('Access Granted', 'Welcome to the Admin Portal.', 'success')
        const { renderAdminHome } = await import('../admin_portal/home')
        await renderAdminHome(app, session)
      } else {
        console.log('[auth-guard] Member role detected — routing to Members Portal.')
        showToast('Access Granted', 'Welcome to the Member Portal.', 'success')
        const { renderMembersHome } = await import('../members_portal/home')
        await renderMembersHome(app, session)
      }
    } catch (err: any) {
      console.error('[auth-guard] Failed to determine role or render home:', err)

      const message = err?.message || 'Failed to load your portal. Please try again.'
      showToast('Portal Error', message, 'error')

      const { renderLoginView } = await import('./login')
      renderLoginView(app)
    }
  } else {
    // Unauthenticated — show the login screen.
    console.log('[auth-guard] No session — routing to login.')
    const { renderLoginView } = await import('./login')
    renderLoginView(app)
  }
}
