// src/main.ts
// CACI Hub Web — App Entry Point
//
// The boot sequence is now orchestrated by the splash screen:
//   Stage 1 (splash.ts)        → 2s branded splash + session check
//   Stage 2 (AssemblySelection) → public assembly picker  [unauthenticated path]
//   Stage 3 (Login)             → assembly-branded sign-in [unauthenticated path]
//   Stage 4 (loading.ts)        → profile + modules + shell + router [authenticated path]

import './styles/theme.css'
import './modules/auth/styles/auth.css'
import './modules/settings/styles/settings.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'notyf/notyf.min.css'

import { runSplash } from './core/splash'
import { registerModule } from './core/registry'
import SettingsModule  from './modules/settings'


import { applyAppearance, initThemeListener } from './core/theme'

async function boot(): Promise<void> {
  console.log('[main] CACI Hub Web starting…')

  // Register modules
  registerModule(SettingsModule)


  // Initialize theme and appearance (Manual pref or System default)
  applyAppearance()
  initThemeListener()

  // Hand off to the splash boot flow (Stages 1 → 4)
  await runSplash()
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
      <h1 style="font-size: var(--text-lg);font-weight:600;color:#0D1117;margin:0">Failed to start</h1>
      <p style="font-size: var(--text-base);margin:0">Check the console for details.</p>
    </div>
  `
})