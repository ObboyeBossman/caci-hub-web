// src/main.ts
// CAC Hub Web — App Entry Point (updated for Phase 2)
//
// Boot sequence (strict order):
//   1. Apply saved theme
//   2. Register modules
//   3. Load current user
//   4. Mount shell (or fullscreen for auth routes)
//   5. Initialize modules
//   6. Start router

import './styles/theme.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/utilities.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'notyf/notyf.min.css'

import { registerModule, initModules } from '@core/registry'
import { startRouter }                 from '@core/router'
import { loadCurrentUser, getCurrentUser } from '@core/auth'
import { supabase }                    from '@core/supabase'
import { emit, on }                    from '@core/events'
import { hasPermission }               from '@core/permissions'
import { mountShell }                  from './shell/Shell'
import { initNotificationBell }        from './shell/NotificationBell'

// Phase 3+ module imports (uncomment after auth module is implemented)
import AuthModule       from './modules/auth/index'
// import DashboardModule  from '@modules/dashboard/index'
// import MembershipModule from '@modules/membership/index'
// import AdminModule      from '@modules/admin/index'
// import SettingsModule   from '@modules/settings/index'

async function boot(): Promise<void> {
  console.log('[main] CAC Hub Web starting...')

  // ── 0. Apply saved theme immediately (prevents flash) ───────────────────
  const savedTheme = localStorage.getItem('caci-theme')
  if (savedTheme) document.documentElement.dataset['theme'] = savedTheme

  // ── 1. Register modules ─────────────────────────────────────────────────
  registerModule(AuthModule)
  // registerModule(DashboardModule)
  // registerModule(MembershipModule)
  // registerModule(AdminModule)
  // registerModule(SettingsModule)

  // ── 2. Load authenticated user ──────────────────────────────────────────
  await loadCurrentUser()
  const user = getCurrentUser()
  console.log('[main] Auth state:', user ? `user=${user.id}` : 'unauthenticated')

  // ── 3. Mount shell ──────────────────────────────────────────────────────
  // For fullscreen routes (auth) the router will call mountFullscreen()
  // when it detects presentation: 'fullscreen'. For now, always mount the shell.
  mountShell()
  initNotificationBell()

  // ── 4. Initialize modules ───────────────────────────────────────────────
  await initModules({
    supabase,
    eventBus:    { emit, on },
    permissions: { hasPermission },
    currentUser: getCurrentUser,
  })

  // ── 5. Start router ─────────────────────────────────────────────────────
  startRouter()

  console.log('[main] Boot complete')
}

boot().catch((err) => {
  console.error('[main] Boot failed:', err)
  document.getElementById('app')!.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;
      justify-content:center;min-height:100vh;font-family:sans-serif;
      color:#656D76;gap:1rem">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="9" y="0" width="4" height="22" rx="2" fill="#004BA0"/>
        <rect x="0" y="9" width="22" height="4" rx="2" fill="#004BA0"/>
      </svg>
      <h1 style="font-size:16px;font-weight:600;color:#0D1117;margin:0">Failed to start</h1>
      <p style="font-size:13px;margin:0">Check the console for details.</p>
    </div>
  `
})