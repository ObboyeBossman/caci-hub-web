// src/core/splash.ts
// Stage 1 — App Boot Flow

import { supabase } from './supabase'
import { guardRoute } from '../auth/auth-guard'

export async function runSplash(): Promise<void> {
  console.log('[splash] runSplash() starting…')
  const app = document.getElementById('app')
  if (!app) {
    console.error('[splash] #app element not found!')
    return
  }

  // ── Render branded splash ─────────────────────────────────────────────────
  console.log('[splash] Rendering splash UI')
  app.innerHTML = `
    <style>
      #splash-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #004BA0;
        position: relative;
        overflow: hidden;
      }
      #splash-bg-circles { position: absolute; inset: 0; pointer-events: none; }
      #splash-bg-circles circle { fill: none; stroke: rgba(255,255,255,0.04); }
      #splash-stripe { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: #C60026; }
      #splash-logo-wrap { position: relative; width: 112px; height: 112px; margin-bottom: 1.75rem; animation: splash-fade-up 0.6s ease both; }
      #splash-logo-img { width: 112px; height: 112px; border-radius: 50%; object-fit: cover; border: 2.5px solid rgba(255,255,255,0.2); }
      #splash-arc-svg { position: absolute; top: -10px; left: -10px; width: 132px; height: 132px; }
      #splash-arc-spinner { transform-origin: 66px 66px; animation: splash-spin-arc 2.2s cubic-bezier(0.4,0,0.2,1) infinite; }
      #splash-app-name { font-family: sans-serif; font-size: 2rem; font-weight: 500; color: #fff; margin: 0 0 5px; animation: splash-fade-up 0.6s ease 0.12s both; }
      #splash-app-name span { color: #E8003A; }
      #splash-tagline { font-family: sans-serif; font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; text-align: center; margin: 0 0 2.75rem; animation: splash-fade-up 0.6s ease 0.22s both; }
      #splash-progress-wrap { width: 200px; animation: splash-fade-up 0.6s ease 0.35s both; }
      #splash-progress-track { height: 3px; background: rgba(255,255,255,0.12); border-radius: 9999px; overflow: hidden; }
      #splash-progress-fill { height: 100%; border-radius: 9999px; width: 0%; background: #E8003A; animation: splash-bar-grow 3.5s forwards; }
      #splash-status { margin-top: 12px; font-size: 0.7rem; color: rgba(255,255,255,0.35); text-align: center; font-family: sans-serif; }
      @keyframes splash-spin-arc { 0% { stroke-dashoffset: 210; transform: rotate(-90deg); } 50% { stroke-dashoffset: 50; } 100% { stroke-dashoffset: 210; transform: rotate(270deg); } }
      @keyframes splash-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes splash-bar-grow { 0% { width: 0%; } 100%{ width: 95%; } }
    </style>

    <div id="splash-screen">
      <div id="splash-logo-wrap">
        <img id="splash-logo-img" src="/caci-logo.jpeg" alt="CACI Logo" />
      </div>
      <h1 id="splash-app-name">CACI <span>Hub</span></h1>
      <p id="splash-tagline">Christ Apostolic Church International</p>
      <div id="splash-progress-wrap">
        <div id="splash-progress-track"><div id="splash-progress-fill"></div></div>
        <p id="splash-status">Checking session…</p>
      </div>
      <div id="splash-stripe"></div>
    </div>
  `

  console.log('[splash] Checking session…')
  // ── Wait min 2 seconds AND the session check simultaneously ───────────────
  const sessionPromise = Promise.race([
    supabase.auth.getSession(),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Session check timed out (4s)')), 4000))
  ]).catch(err => {
    console.warn('[splash] Session check failed:', err)
    return { data: { session: null }, error: err }
  })

  const [sessionRes] = await Promise.all([
    sessionPromise,
    new Promise<void>(resolve => setTimeout(resolve, 2000)),
  ])

  console.log('[splash] Session check complete. Routing…')
  const session = (sessionRes as any)?.data?.session ?? null
  await guardRoute(app, session)
}
