// src/core/guards/permissionGuard.ts
// Checks whether the current user is permitted to access a route.
// Delegates to authorization-service.ts (admin bypass + permission array check).
// Runs after authGuard in the middleware pipeline.
//
// If no permission is declared on the route, access is granted to all authenticated users.
// On failure: renders an inline access-denied panel inside #page-content (shell stays mounted).

import { getCurrentUser }  from '../auth'
import { can }             from '../authorization/authorization-service'
import type { RouteDefinition, GuardResult } from '../../types/module.types'

export async function permissionGuard(
  route: RouteDefinition,
  _path: string
): Promise<GuardResult> {
  // No permission requirement declared — allow all authenticated users
  if (!route.permission) return { allowed: true }

  const user = getCurrentUser()
  // Should not reach here without authGuard first, but be defensive
  if (!user) return { allowed: false, redirect: '/login' }

  if (can(user, route.permission)) return { allowed: true }

  // ── Access denied — render inline so the shell (sidebar) stays visible ──────
  _renderAccessDenied(user.email ?? user.phone ?? null)
  // Return handled:true so the router skips page.render() — we've already
  // painted the content area ourselves.
  return { allowed: true, handled: true }
}

// ── Inline access-denied renderer ────────────────────────────────────────────

function _renderAccessDenied(userEmail: string | null): void {
  const container = document.getElementById('page-content')
  if (!container) return

  const who = userEmail
    ? `You're signed in as <strong>${userEmail}</strong>, but your current role doesn't include access to this section.`
    : `You need to be signed in with the appropriate permissions to access this section.`

  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      padding: 2rem 1.5rem;
      font-family: var(--font-sans);
      text-align: center;
    ">

      <!-- Shield icon with animated ring -->
      <div style="
        position: relative;
        width: 88px; height: 88px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 28px;
      ">
        <div style="
          position: absolute; inset: 0;
          border-radius: 50%;
          background: color-mix(in srgb, var(--caci-red, #e53e3e) 10%, transparent);
          border: 2px solid color-mix(in srgb, var(--caci-red, #e53e3e) 25%, transparent);
          animation: pulse-ring 2.4s ease-in-out infinite;
        "></div>
        <div style="
          width: 64px; height: 64px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--caci-red, #e53e3e) 12%, transparent);
          border: 2px solid color-mix(in srgb, var(--caci-red, #e53e3e) 30%, transparent);
          display: flex; align-items: center; justify-content: center;
        ">
          <i class="bi bi-shield-lock-fill" style="
            font-size: 1.75rem;
            color: var(--caci-red, #e53e3e);
          "></i>
        </div>
      </div>

      <!-- Headline -->
      <h1 style="
        margin: 0 0 8px;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.015em;
      ">Access Restricted</h1>

      <p style="
        margin: 0 0 24px;
        font-size: 0.9375rem;
        color: var(--text-secondary);
        max-width: 380px;
        line-height: 1.6;
      ">${who}</p>

      <!-- Help card -->
      <div style="
        max-width: 400px;
        width: 100%;
        background: var(--card-bg, var(--surface-2));
        border: 1px solid var(--card-border, var(--border-subtle));
        border-radius: var(--radius-lg, 12px);
        padding: 1.25rem 1.5rem;
        margin-bottom: 28px;
        text-align: left;
      ">
        <div style="
          display: flex;
          gap: 12px;
          align-items: flex-start;
        ">
          <i class="bi bi-info-circle-fill" style="
            font-size: 1.1rem;
            color: var(--caci-blue, #3b82f6);
            margin-top: 1px;
            flex-shrink: 0;
          "></i>
          <p style="
            margin: 0;
            font-size: 0.875rem;
            color: var(--text-secondary);
            line-height: 1.65;
          ">
            If you believe you should have access, please contact your
            <strong style="color: var(--text-primary);">assembly administrator</strong>
            to request the appropriate permissions.
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div style="
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      ">
        <button id="perm-back-btn" style="
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: var(--radius-md, 8px);
          border: none;
          background: var(--btn-primary-bg, var(--caci-blue, #3b82f6));
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity .15s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          <i class="bi bi-arrow-left"></i>
          Go Back
        </button>

        <button id="perm-home-btn" style="
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: var(--radius-md, 8px);
          border: 1px solid var(--card-border, var(--border-subtle));
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background .15s, color .15s;
        "
          onmouseover="this.style.background='var(--surface-hover, rgba(0,0,0,.05))'"
          onmouseout="this.style.background='transparent'"
        >
          <i class="bi bi-house"></i>
          Dashboard
        </button>
      </div>

      <!-- Error code -->
      <div style="
        margin-top: 32px;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        color: var(--text-tertiary, var(--text-secondary));
        letter-spacing: 0.04em;
        font-family: var(--font-mono, monospace);
      ">HTTP 403 · Forbidden</div>

    </div>

    <style>
      @keyframes pulse-ring {
        0%, 100% { transform: scale(1); opacity: 1; }
        50%       { transform: scale(1.12); opacity: .6; }
      }
    </style>
  `

  container.querySelector('#perm-back-btn')
    ?.addEventListener('click', () => history.back())

  container.querySelector('#perm-home-btn')
    ?.addEventListener('click', () => { location.hash = '/' })
}
