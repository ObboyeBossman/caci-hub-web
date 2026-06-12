// src/modules/auth/pages/Unauthorized.ts
// Rendered when a permissionGuard check fails (403 – no access).
// Presented in fullscreen so it works without the shell/sidebar.

import { navigate }       from '../../../core/router'
import { getCurrentUser } from '../../../core/auth'
import type { PageModule } from '../../../types/module.types'
import { logoUrl } from '@shell/Shell'

// ── Page ──────────────────────────────────────────────────────────────────────

export const Unauthorized: PageModule = {
  async render(container: HTMLElement) {
    const user = getCurrentUser()

    container.innerHTML = `
      <div class="auth-root">

        <!-- Header -->
        <div class="auth-header">
          <a class="auth-logo" href="#/">
            <img src="${logoUrl}" alt="CACI Logo" class="auth-logo-img">
            <div class="auth-logo-text">CACI Hub</div>
          </a>
        </div>

        <!-- Body -->
        <div class="auth-container">
          <div class="auth-box" style="max-width: 460px;">

            <!-- Icon badge -->
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 72px; height: 72px;
              border-radius: 50%;
              background: var(--auth-error-alert-bg);
              border: 2px solid var(--auth-error-border);
              margin: 0 auto 24px;
            ">
              <i class="bi bi-shield-lock-fill" style="
                font-size: 2rem;
                color: var(--auth-error);
              "></i>
            </div>

            <!-- Heading -->
            <div class="auth-heading" style="text-align: center; margin-bottom: 8px;">
              <div class="auth-h1">Access Restricted</div>
              <div class="auth-subtitle" style="margin-top: 6px;">
                You don't have permission to view this page.
              </div>
            </div>

            <!-- Explanation card -->
            <div class="auth-card" style="margin-top: 20px;">
              <p style="
                margin: 0 0 10px;
                font-size: var(--text-sm);
                color: var(--auth-text-secondary);
                line-height: 1.6;
              ">
                ${user
                  ? `You're signed in as <strong style="color: var(--auth-text-primary);">${user.email ?? user.phone ?? 'a known user'}</strong>, but your role doesn't include access to the requested section.`
                  : 'You need to be signed in with the appropriate role to access this section.'}
              </p>
              <p style="
                margin: 0;
                font-size: var(--text-sm);
                color: var(--auth-text-secondary);
                line-height: 1.6;
              ">
                If you believe this is a mistake, please contact your
                <strong style="color: var(--auth-text-primary);">assembly administrator</strong>.
              </p>
            </div>

            <!-- Actions -->
            <div style="
              display: flex;
              flex-direction: column;
              gap: 10px;
              margin-top: 20px;
            ">
              <button
                id="unauth-back-btn"
                class="auth-btn auth-btn-primary"
              >
                <i class="bi bi-arrow-left" style="margin-right: 6px;"></i>
                Go Back
              </button>

              <button
                id="unauth-home-btn"
                class="auth-btn"
                style="
                  background: none;
                  border: 1px solid var(--auth-card-border);
                  color: var(--auth-text-secondary);
                  font-size: var(--text-sm);
                "
              >
                <i class="bi bi-house" style="margin-right: 6px;"></i>
                Go to Dashboard
              </button>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div class="auth-footer">
          <div class="auth-footer-links">
            <span style="font-size: var(--text-sm); color: var(--auth-footer);">
              Error 403 &mdash; Forbidden
            </span>
          </div>
        </div>

      </div>
    `

    // ── Event Handlers ──────────────────────────────────────────────────────

    container
      .querySelector('#unauth-back-btn')
      ?.addEventListener('click', () => history.back())

    container
      .querySelector('#unauth-home-btn')
      ?.addEventListener('click', () => navigate('/'))
  },
}

export default Unauthorized
