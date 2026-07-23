// src/core/loading.ts
// Stage 4 — App Boot Flow
//
// Full application boot sequence shown after successful auth.
// Runs all initialization steps (profile, modules, shell) while displaying
// a progress UI, then hands off to the router.
//
// NOTE: This stage is temporarily inactive while the upgrade screen is displayed.
// Module imports will be restored when the modules are re-added to the project.

import { supabase } from './supabase'

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
        margin-top: 12px; font-size: var(--text-xs); color: rgba(255,255,255,0.35);
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

  const fill = document.getElementById('loading-progress-fill') as HTMLElement
  const label = document.getElementById('loading-status') as HTMLElement

  const setProgress = (pct: number, text: string) => {
    if (fill) fill.style.width = `${pct}%`
    if (label) label.textContent = text
  }

  const tick = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))

  try {
    // Verify Supabase session is still valid
    setProgress(20, 'Verifying session…')
    await tick()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.warn('[loading] Session lost. Please refresh.')
      setProgress(100, 'Session expired')
      return
    }

    setProgress(100, 'Ready')
    await tick()

  } catch (err) {
    console.error('[loading] Boot failed:', err)
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;font-family:sans-serif;color:#656D76;gap:1rem">
        <h1 style="font-size: var(--text-lg);font-weight:600;color:#0D1117;margin:0">Initialization Failed</h1>
        <p style="font-size: var(--text-base);margin:0">${err instanceof Error ? err.message : 'Unknown error occurred.'}</p>
        <button onclick="location.reload()"
          style="padding:6px 16px;border-radius:6px;border:1px solid #d0d7de;
          background:#f6f8fa;cursor:pointer;font-size: var(--text-base)">
          Retry
        </button>
      </div>
    `
  }
}
