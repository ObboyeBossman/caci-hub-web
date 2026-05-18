// src/modules/auth/pages/Login.ts
// UI ported from: auth refs/caci_hub_auth_module.html (panel-signin)

import { authService, mapAuthError } from '../services/authService'
import { navigate }                  from '../../../core/router'
import { loadCurrentUser }           from '../../../core/auth'
import type { PageModule }           from '../../../types/module.types'

let _container: HTMLElement | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function _showError(msg: string) {
  if (!_container) return
  const el = _container.querySelector('#signin-error') as HTMLElement
  const tx = _container.querySelector('#signin-error-text') as HTMLElement
  if (el && tx) { el.style.display = 'flex'; tx.textContent = msg }
}

function _hideError() {
  const el = _container?.querySelector('#signin-error') as HTMLElement
  if (el) el.style.display = 'none'
}

function _setLoading(on: boolean) {
  const btn = _container?.querySelector('#signin-btn') as HTMLButtonElement
  if (!btn) return
  if (on) {
    btn.disabled = true
    btn.innerHTML = '<span class="auth-spinner"></span> Signing in…'
  } else {
    btn.disabled = false
    btn.textContent = 'Sign in'
  }
}

function _toggleEye(pwId: string, eyeId: string) {
  const inp = _container?.querySelector(`#${pwId}`) as HTMLInputElement
  const eye = _container?.querySelector(`#${eyeId}`) as HTMLElement
  if (!inp) return
  const show = inp.type === 'password'
  inp.type = show ? 'text' : 'password'
  if (eye) eye.style.opacity = show ? '1' : '0.4'
}

// ── Sign-in handler ───────────────────────────────────────────────────────────

async function _handleSignIn() {
  if (!_container) return
  const emailInput = _container.querySelector('#signin-email-input') as HTMLInputElement
  const pwInput    = _container.querySelector('#signin-pw')          as HTMLInputElement

  _hideError()

  if (!emailInput.value.trim() || !pwInput.value) {
    _showError('Please enter both email and password.')
    return
  }

  _setLoading(true)
  try {
    await authService.signIn(emailInput.value.trim(), pwInput.value)
    await loadCurrentUser()  // refresh auth state

    // TEMPORARY: Skip TOTP verification/enrollment and go directly to dashboard
    // const enrolled = await authService.hasTotpEnrolled()
    // navigate(enrolled ? '/totp-verify' : '/totp-enroll')
    navigate('/')
  } catch (err) {
    _showError(mapAuthError(err))
    _setLoading(false)
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const Login: PageModule = {
  async render(container: HTMLElement) {
    _container = container

    container.innerHTML = `
      <div class="auth-root">

        <!-- Header -->
        <div class="auth-header">
          <a class="auth-logo" href="#/login">
            <div class="auth-cross"></div>
            <div class="auth-logo-text">CACI Hub</div>
          </a>
          <div class="auth-theme-toggle" id="auth-theme-toggle" role="button" tabindex="0" aria-label="Toggle theme">
            <span class="auth-toggle-icon">☀️</span>
            <div class="auth-toggle-track"><div class="auth-toggle-thumb"></div></div>
            <span class="auth-toggle-label">Light</span>
          </div>
        </div>

        <!-- Container -->
        <div class="auth-container">
          <div class="auth-box">

            <div class="auth-heading">
              <div class="auth-h1">Sign in to CACI Hub</div>
              <div class="auth-subtitle">Securely access your account</div>
            </div>

            <!-- Card -->
            <div class="auth-card">

              <!-- Error alert -->
              <div id="signin-error" class="auth-alert auth-alert-error" style="display:none;">
                <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
                </svg>
                <div id="signin-error-text"></div>
              </div>

              <!-- Email field -->
              <div class="auth-field">
                <label class="auth-label">Email address</label>
                <input type="email" id="signin-email-input" class="auth-input" placeholder="you@example.com" autocomplete="email">
              </div>

              <!-- Password field -->
              <div class="auth-field">
                <div class="auth-field-header">
                  <label class="auth-label">Password</label>
                  <a class="auth-link" href="#/forgot-password" style="font-size:13px;">Forgot?</a>
                </div>
                <div class="auth-input-wrap">
                  <input type="password" id="signin-pw" class="auth-input" placeholder="Enter your password" autocomplete="current-password">
                  <button type="button" class="auth-eye-btn" id="eye-btn" aria-label="Toggle password visibility">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                    </svg>
                  </button>
                </div>
              </div>

              <button id="signin-btn" class="auth-btn auth-btn-primary" style="margin-top:16px;">Sign in</button>
            </div>

            <!-- Footer card -->
            <div class="auth-card" style="text-align:center;padding:16px;">
              <span style="color:var(--auth-text-secondary);font-size:14px;">Don't have an account?</span>
              <a class="auth-link" href="#/login" style="margin-left:4px;">Contact your administrator</a>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div class="auth-footer">
          <div class="auth-footer-links">
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Help</a>
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Privacy</a>
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Terms</a>
          </div>
        </div>

      </div>
    `

    // Listeners
    container.querySelector('#signin-btn')
      ?.addEventListener('click', _handleSignIn)

    container.querySelector('#signin-pw')
      ?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') _handleSignIn() })

    container.querySelector('#signin-email-input')
      ?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') _handleSignIn() })

    container.querySelector('#eye-btn')
      ?.addEventListener('click', () => _toggleEye('signin-pw', 'eye-btn'))

    // Theme toggle
    const toggle = container.querySelector('#auth-theme-toggle')
    toggle?.addEventListener('click', () => {
      const html  = document.documentElement
      const next  = html.dataset['theme'] === 'dark' ? 'light' : 'dark'
      html.dataset['theme'] = next
      localStorage.setItem('caci-theme', next)
      const icon  = container.querySelector('.auth-toggle-icon') as HTMLElement
      const label = container.querySelector('.auth-toggle-label') as HTMLElement
      if (icon)  icon.textContent  = next === 'dark' ? '🌙' : '☀️'
      if (label) label.textContent = next === 'dark' ? 'Dark' : 'Light'
    })

    // Sync toggle label to current theme on mount
    const currentTheme = document.documentElement.dataset['theme'] || 'light'
    const icon  = container.querySelector('.auth-toggle-icon')  as HTMLElement
    const label = container.querySelector('.auth-toggle-label') as HTMLElement
    if (icon)  icon.textContent  = currentTheme === 'dark' ? '🌙' : '☀️'
    if (label) label.textContent = currentTheme === 'dark' ? 'Dark' : 'Light'
  },

  destroy() { _container = null }
}

export default Login
