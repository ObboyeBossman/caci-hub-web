// src/main.ts
// CACI Hub Web — App Entry Point

console.log('[main] Script evaluation started');

import './styles/theme.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'notyf/notyf.min.css'

import { runSplash } from './core/splash'

// Register PWA Service Worker
import { registerSW } from 'virtual:pwa-register'
registerSW({
  onNeedRefresh() {},
  onOfflineReady() {
    console.log('[pwa] Offline ready')
  },
})

async function boot(): Promise<void> {
  console.log('[main] CACI Hub Web boot() starting…')

  try {
    // Hand off to the splash boot flow (Stages 1 → 4)
    await runSplash()
    console.log('[main] runSplash() completed')
  } catch (err) {
    console.error('[main] runSplash failed:', err)
    throw err; // Re-throw to be caught by boot().catch()
  }
}

console.log('[main] Calling boot()');
boot().catch((err) => {
  console.error('[main] Boot failed:', err)
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;font-family:sans-serif;
        color:#656D76;gap:1rem;background:#f8f9fa;text-align:center;padding:2rem;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h1 style="font-size: 1.5rem;font-weight:600;color:#0D1117;margin:0">Unable to Start App</h1>
        <p style="font-size: 1rem;margin:0;max-width:400px;">
          ${err instanceof Error ? err.message : 'An unknown error occurred during initialization.'}
        </p>
        <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:#004BA0;color:white;border:none;border-radius:4px;cursor:pointer;">
          Retry
        </button>
      </div>
    `
  } else {
    alert('Critical Error: App element not found and boot failed: ' + err)
  }
})
