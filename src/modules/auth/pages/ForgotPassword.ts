// src/modules/auth/pages/ForgotPassword.ts
// UI ported from: auth refs/caci_hub_auth_module.html (panel-forgot + panel-check-email)

import { authService, mapAuthError } from '../services/authService'
import type { PageModule }           from '../../../types/module.types'

let _container: HTMLElement | null = null
let _email = ''
let _cooldownActive = false

// ── Panel switching ───────────────────────────────────────────────────────────

function _showPanel(id: string) {
  _container?.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'))
  _container?.querySelector(`#${id}`)?.classList.add('active')
}

// ── Forgot password handler ───────────────────────────────────────────────────

async function _handleForgotPassword() {
  if (!_container) return
  const emailInput  = _container.querySelector('#forgot-email')       as HTMLInputElement
  const errorAlert  = _container.querySelector('#forgot-error-alert') as HTMLElement
  const errorText   = _container.querySelector('#forgot-error-text')  as HTMLElement
  const formatError = _container.querySelector('#email-format-error') as HTMLElement
  const btn         = _container.querySelector('#forgot-btn')         as HTMLButtonElement

  const email = emailInput.value.trim()

  // Reset errors
  emailInput.classList.remove('error')
  errorAlert.style.display = 'none'
  formatError.classList.remove('show')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!email || !isValidEmail) {
    emailInput.classList.add('error')
    formatError.classList.add('show')
    return
  }

  btn.disabled = true
  btn.innerHTML = '<span class="auth-spinner"></span> Sending…'

  try {
    await authService.resetPassword(email)
    _email = email
    ;(_container.querySelector('#reset-email-display') as HTMLElement).textContent = email
    btn.disabled = false
    btn.textContent = 'Send reset link'
    _showPanel('panel-check-email')
  } catch (err) {
    errorText.textContent = mapAuthError(err)
    errorAlert.style.display = 'flex'
    emailInput.classList.add('error')
    btn.disabled = false
    btn.textContent = 'Send reset link'
  }
}

// ── Resend handler ────────────────────────────────────────────────────────────

function _handleResend() {
  if (_cooldownActive || !_container) return
  const btn        = _container.querySelector('#resend-btn')      as HTMLButtonElement
  const cooldownEl = _container.querySelector('#resend-cooldown') as HTMLElement
  const timerEl    = _container.querySelector('#cooldown-timer')  as HTMLElement

  btn.disabled = true
  btn.textContent = 'Sending…'

  authService.resetPassword(_email).then(() => {
    btn.textContent = '✓ Email sent'
    _cooldownActive = true
    btn.style.display = 'none'
    cooldownEl.style.display = 'block'

    let seconds = 30
    const interval = setInterval(() => {
      seconds--
      timerEl.textContent = String(seconds)
      if (seconds <= 0) {
        clearInterval(interval)
        _cooldownActive  = false
        btn.disabled     = false
        btn.textContent  = 'Resend link'
        btn.style.display = ''
        cooldownEl.style.display = 'none'
      }
    }, 1000)
  }).catch(() => {
    btn.disabled    = false
    btn.textContent = 'Resend link'
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const ForgotPassword: PageModule = {
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
        </div>

        <!-- Container -->
        <div class="auth-container">
          <div class="auth-box">

            <div class="auth-heading">
              <div class="auth-h1">CACI Hub</div>
              <div class="auth-subtitle">Account Recovery</div>
            </div>

            <!-- Forgot panel -->
            <div id="panel-forgot" class="auth-panel active">
              <div class="auth-card">
                <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--auth-text-primary);">Reset your password</h2>
                <p style="font-size:13px;color:var(--auth-text-secondary);margin-bottom:20px;">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <div id="forgot-error-alert" class="auth-alert auth-alert-error" style="display:none;">
                  <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
                  </svg>
                  <div id="forgot-error-text"></div>
                </div>

                <div class="auth-field">
                  <label class="auth-label">Email address</label>
                  <input type="email" id="forgot-email" class="auth-input" placeholder="you@example.com" autocomplete="email">
                  <div id="email-format-error" class="auth-error-msg">Please enter a valid email address</div>
                </div>

                <button id="forgot-btn" class="auth-btn auth-btn-primary" style="margin-top:16px;">Send reset link</button>

                <div style="text-align:center;margin-top:16px;">
                  <a class="auth-link" href="#/login">← Back to sign in</a>
                </div>
              </div>
            </div>

            <!-- Check email panel -->
            <div id="panel-check-email" class="auth-panel">
              <div class="auth-card" style="text-align:center;">
                <div class="auth-email-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m2 7 10 6 10-6"/>
                  </svg>
                </div>

                <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--auth-text-primary);">Check your email</h2>
                <p style="font-size:14px;color:var(--auth-text-secondary);margin-bottom:4px;">We've sent a password reset link to</p>
                <p style="font-size:14px;font-weight:600;color:var(--auth-text-primary);margin-bottom:20px;" id="reset-email-display"></p>

                <div class="auth-alert auth-alert-info">
                  <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="8" r="6"/><path d="M8 8v3M8 5v.5"/>
                  </svg>
                  <div>Click the link in the email to reset your password. The link will expire in 1 hour.</div>
                </div>

                <div class="auth-resend-section">
                  <div class="auth-resend-text">Didn't receive the email?</div>
                  <button id="resend-btn" class="auth-btn auth-btn-secondary">Resend link</button>
                  <div id="resend-cooldown" style="display:none;font-size:12px;color:var(--auth-text-muted);margin-top:8px;">
                    You can resend in <span id="cooldown-timer">30</span> seconds
                  </div>
                </div>

                <div style="margin-top:20px;">
                  <a class="auth-link" href="#/login">← Back to sign in</a>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div class="auth-footer">
          <div class="auth-footer-links">
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Help</a>
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Privacy</a>
          </div>
        </div>

      </div>
    `

    container.querySelector('#forgot-btn')?.addEventListener('click', _handleForgotPassword)
    container.querySelector('#resend-btn')?.addEventListener('click', _handleResend)
    ;(container.querySelector('#forgot-email') as HTMLInputElement)
      ?.addEventListener('keydown', (e) => { if (e.key === 'Enter') _handleForgotPassword() })
  },

  destroy() { _container = null; _email = ''; _cooldownActive = false }
}

export default ForgotPassword
