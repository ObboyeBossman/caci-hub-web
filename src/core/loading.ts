// src/core/loading.ts
// Stage 4 — App Boot Flow
//
// Full application boot sequence shown after successful auth.
// Runs all initialization steps (profile, modules, shell) while displaying
// a progress UI, then hands off to the router.

import { supabase }                    from './supabase'
import { emit, on }                    from './events'
import { loadCurrentUser, getCurrentUser } from './auth'
import { registerModule, initModules }  from './registry'
import { startRouter, navigate }        from './router'
import { hasPermission }                from './permissions'
import { mountShell }                   from '../shell/Shell'
import { initNotificationBell }         from '../shell/NotificationBell'

// Modules (same list as before — kept here so main.ts stays minimal)
import AuthModule      from '../modules/auth/index'
import MembershipModule from '../modules/membership/index'
import AdminModule     from '../modules/admin/index'

export async function runLoading(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) return

  // ── Render progress UI ────────────────────────────────────────────────────
  app.innerHTML = `
    <style>
      #loading-screen {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; min-height: 100vh;
        background: #004BA0; gap: 0;
      }
      #loading-progress-wrap { width: 200px; }
      #loading-progress-track {
        height: 3px; background: rgba(255,255,255,0.12);
        border-radius: 9999px; overflow: hidden;
      }
      #loading-progress-fill {
        height: 100%; border-radius: 9999px; background: #E8003A;
        width: 5%; transition: width 0.4s ease;
      }
      #loading-status {
        margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.35);
        letter-spacing: 0.05em; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    </style>
    <div id="loading-screen" role="main" aria-label="CACI Hub initialising">
      <div id="loading-progress-wrap">
        <div id="loading-progress-track">
          <div id="loading-progress-fill"></div>
        </div>
        <p id="loading-status">Initialising…</p>
      </div>
    </div>
  `

  const fill  = document.getElementById('loading-progress-fill') as HTMLElement
  const label = document.getElementById('loading-status')        as HTMLElement

  const setProgress = (pct: number, text: string) => {
    if (fill)  fill.style.width   = `${pct}%`
    if (label) label.textContent  = text
  }

  try {
    // Step 1: Load user profile ──────────────────────────────────────────────
    setProgress(20, 'Loading your profile…')
    await loadCurrentUser()
    const user = getCurrentUser()

    if (!user) {
      // No valid profile → kick back to login
      startRouter()
      navigate('/login')
      return
    }

    // Step 2: Register modules ───────────────────────────────────────────────
    setProgress(40, 'Registering modules…')
    registerModule(AuthModule)
    registerModule(MembershipModule)
    registerModule(AdminModule)

    // Step 3: Mount shell chrome ─────────────────────────────────────────────
    setProgress(60, 'Mounting shell…')
    mountShell()
    initNotificationBell()

    // Step 4: Run module init hooks ──────────────────────────────────────────
    setProgress(80, 'Starting services…')
    await initModules({
      supabase,
      eventBus:    { emit, on },
      permissions: { hasPermission },
      currentUser: getCurrentUser,
    })

    // Step 5: Kick off router ────────────────────────────────────────────────
    setProgress(100, 'Ready')
    emit('app:ready')
    startRouter()

  } catch (err) {
    console.error('[loading] Boot failed:', err)
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;font-family:sans-serif;color:#656D76;gap:1rem">
        <h1 style="font-size:16px;font-weight:600;color:#0D1117;margin:0">Initialization Failed</h1>
        <p style="font-size:13px;margin:0">${err instanceof Error ? err.message : 'Unknown error occurred.'}</p>
        <button onclick="location.reload()"
          style="padding:6px 16px;border-radius:6px;border:1px solid #d0d7de;
          background:#f6f8fa;cursor:pointer;font-size:13px">
          Retry
        </button>
      </div>
    `
  }
}
