// src/core/splash.ts
// Stage 1 — App Boot Flow
//
// Entry point for every page load.
// Renders the branded splash, enforces a 2-second minimum display time,
// checks for an existing Supabase session, then routes accordingly:
//   • Session found  → Stage 4 (src/core/loading.ts)
//   • No session     → Stage 2 (AssemblySelection /select-assembly)

import { supabase }         from './supabase'
import { registerModule }   from './registry'
import { startRouter, navigate } from './router'
import { mountFullscreen }  from '../shell/Shell'
import AuthModule           from '../modules/auth/index'
import { renderUpgradeView } from './upgrade'

export async function runSplash(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) return

  // ── Render branded splash ─────────────────────────────────────────────────
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

      /* Concentric circle background */
      #splash-bg-circles {
        position: absolute; inset: 0; pointer-events: none;
      }
      #splash-bg-circles circle { fill: none; stroke: rgba(255,255,255,0.04); }

      /* Red bottom stripe */
      #splash-stripe {
        position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
        background: #C60026;
      }

      /* Logo + spinner */
      #splash-logo-wrap {
        position: relative; width: 112px; height: 112px; margin-bottom: 1.75rem;
        animation: splash-fade-up 0.6s ease both;
      }
      #splash-logo-img {
        width: 112px; height: 112px; border-radius: 50%; object-fit: cover;
        border: 2.5px solid rgba(255,255,255,0.2);
      }
      #splash-arc-svg {
        position: absolute; top: -10px; left: -10px; width: 132px; height: 132px;
      }
      #splash-arc-spinner {
        transform-origin: 66px 66px;
        animation: splash-spin-arc 2.2s cubic-bezier(0.4,0,0.2,1) infinite;
      }

      /* Text */
      #splash-app-name {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: var(--text-4xl); font-weight: 500; color: #fff; letter-spacing: 0.02em;
        margin: 0 0 5px;
        animation: splash-fade-up 0.6s ease 0.12s both;
      }
      #splash-app-name span { color: #E8003A; }

      #splash-tagline {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: var(--text-xs); color: rgba(255,255,255,0.5);
        letter-spacing: 0.1em; text-transform: uppercase;
        text-align: center; margin: 0 0 2.75rem; line-height: 1.7;
        animation: splash-fade-up 0.6s ease 0.22s both;
      }

      /* Progress bar */
      #splash-progress-wrap {
        width: 200px;
        animation: splash-fade-up 0.6s ease 0.35s both;
      }
      #splash-progress-track {
        height: 3px; background: rgba(255,255,255,0.12);
        border-radius: 9999px; overflow: hidden;
      }
      #splash-progress-fill {
        height: 100%; border-radius: 9999px; width: 0%;
        background: linear-gradient(90deg, #E8003A 0%, rgba(232,0,58,0.6) 50%, #E8003A 100%);
        background-size: 200% 100%;
        animation:
          splash-bar-grow 3.5s cubic-bezier(0.4,0,0.2,1) forwards,
          splash-shimmer  1.4s linear infinite;
      }
      #splash-status {
        margin-top: 12px; font-size: var(--text-xs); color: rgba(255,255,255,0.35);
        letter-spacing: 0.05em; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: splash-pulse 2s ease-in-out infinite;
      }

      /* Keyframes */
      @keyframes splash-spin-arc {
        0%   { stroke-dashoffset: 210; transform: rotate(-90deg); }
        50%  { stroke-dashoffset: 50; }
        100% { stroke-dashoffset: 210; transform: rotate(270deg); }
      }
      @keyframes splash-fade-up {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes splash-bar-grow {
        0%   { width: 0%; }  20% { width: 18%; }
        45%  { width: 47%; } 70% { width: 71%; }
        90%  { width: 88%; } 100%{ width: 95%; }
      }
      @keyframes splash-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      @keyframes splash-pulse {
        0%, 100% { opacity: 1; } 50% { opacity: 0.65; }
      }
    </style>

    <div id="splash-screen" role="main" aria-label="CACI Hub loading">

      <svg id="splash-bg-circles" viewBox="0 0 680 580" aria-hidden="true">
        <circle cx="340" cy="290" r="120" stroke-width="1"/>
        <circle cx="340" cy="290" r="200" stroke-width="1"/>
        <circle cx="340" cy="290" r="290" stroke-width="0.7"/>
        <circle cx="340" cy="290" r="390" stroke-width="0.5"/>
      </svg>

      <div id="splash-logo-wrap">
        <img id="splash-logo-img" src="/caci-logo.jpeg" alt="CACI Logo" />
        <svg id="splash-arc-svg" viewBox="0 0 132 132" fill="none" aria-hidden="true">
          <circle cx="66" cy="66" r="60" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
          <circle id="splash-arc-spinner" cx="66" cy="66" r="60"
            stroke="#E8003A" stroke-width="2.5" stroke-linecap="round"
            stroke-dasharray="280" stroke-dashoffset="210"/>
        </svg>
      </div>

      <h1 id="splash-app-name">CACI <span>Hub</span></h1>
      <p id="splash-tagline">Christ Apostolic Church<br>International</p>

      <div id="splash-progress-wrap">
        <div id="splash-progress-track">
          <div id="splash-progress-fill"></div>
        </div>
        <p id="splash-status">Checking session…</p>
      </div>

      <div id="splash-stripe"></div>
    </div>
  `

  // ── Wait min 2 seconds AND the session check simultaneously ───────────────
  const sessionPromise = Promise.race([
    supabase.auth.getSession(),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 4000))
  ]).catch(err => {
    console.warn('[splash] Session check timed out or failed:', err)
    return { data: { session: null }, error: err }
  })

  const [sessionRes] = await Promise.all([
    sessionPromise,
    new Promise<void>(resolve => setTimeout(resolve, 2000)),
  ])

  // ── Show upgrade screen after splash ──────────────────────────────────────
  renderUpgradeView(app)
}
