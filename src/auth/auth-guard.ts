// src/auth/auth-guard.ts
//
// Auth guard — called after the splash session check.
// Decides what to render next:
//   • Valid session  → renders the Members Portal homepage
//   • No session     → renders the login screen
//
// This is the ONLY place that makes the authenticated vs. unauthenticated
// routing decision. Import and call guardRoute() from splash.ts.

import type { Session } from '@supabase/supabase-js'
import { renderLoginView } from './login'
import { renderMembersHome } from '../members_portal/home'
import { renderAdminHome } from '../admin_portal/home'
import { supabase } from '../core/supabase'

/**
 * Evaluates the session and routes to the correct next view.
 * @param app   The root #app element.
 * @param session  The Supabase session (null = unauthenticated).
 */
export async function guardRoute(app: HTMLElement, session: Session | null): Promise<void> {
  if (session) {
    console.log('[auth-guard] Session valid — user:', session.user.phone || session.user.email)
    
    try {
      // Query user role to determine routing
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (error) throw error

      if (profile?.role === 'admin') {
        console.log('[auth-guard] Admin role detected — routing to Admin Portal.')
        await renderAdminHome(app, session)
      } else {
        console.log('[auth-guard] Member role detected — routing to Members Portal.')
        await renderMembersHome(app, session)
      }
    } catch (err) {
      console.error('[auth-guard] Failed to render authenticated home:', err)
      renderLoginView(app)
    }
  } else {
    // Unauthenticated — show the login screen.
    console.log('[auth-guard] No session — routing to login.')
    renderLoginView(app)
  }
}
