// src/modules/auth/pages/ForgotPassword.ts

import { authService } from '../services/authService'
import type { PageModule } from '../../../types/module.types'

let _container: HTMLElement | null = null
let _email: string = ''

function _showPanel(id: string) {
  if (!_container) return
  _container.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  const p = _container.querySelector(`#${id}`) as HTMLElement
  if (p) p.classList.add('active')
}

function _showError(msg: string) {
  if (!_container) return
  const errWrap = _container.querySelector('#forgot-error-alert') as HTMLElement
  const extText = _container.querySelector('#forgot-error-text') as HTMLElement
  if (errWrap && extText) {
    errWrap.style.display = 'flex'
    extText.textContent = msg
  }
}

function _hideError() {
  if (!_container) return
  const errWrap = _container.querySelector('#forgot-error-alert') as HTMLElement
  if (errWrap) errWrap.style.display = 'none'
}

function _setLoading(isLoading: boolean) {
  if (!_container) return
  const btn = _container.querySelector('#forgot-btn') as HTMLButtonElement
  if (!btn) return
  if (isLoading) {
    btn.disabled = true
    btn.innerHTML = '<div class="spinner"></div> Sending...'
  } else {
    btn.disabled = false
    btn.innerHTML = 'Send reset link'
  }
}

async function _handleForgotPassword() {
  if (!_container) return
  const emailInput = _container.querySelector('#forgot-email') as HTMLInputElement
  const email = emailInput.value.trim()

  if (!email) {
    _showError('Please enter a valid email address.')
    return
  }

  _hideError()
  _setLoading(true)

  try {
    await authService.resetPassword(email)
    _email = email
    
    const display = _container.querySelector('#reset-email-display')
    if (display) display.textContent = _email

    _showPanel('panel-check-email')
  } catch (err: any) {
    console.error('Reset password failed:', err)
    _showError(err.message || 'Something went wrong. Please try again.')
  } finally {
    _setLoading(false)
  }
}

export const ForgotPassword: PageModule = {
  async render(container: HTMLElement) {
    _container = container

    container.innerHTML = `
      <div class="box">
        <div class="heading">
          <div class="h1">CACI Hub</div>
          <div class="subtitle">Password Recovery</div>
        </div>

        <div id="panel-forgot" class="panel active">
          <div class="card">
            <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">Reset your password</h2>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div id="forgot-error-alert" class="alert alert-error" style="display:none;">
              <svg class="alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 4v4M8 10v.5"/>
              </svg>
              <div id="forgot-error-text"></div>
            </div>

            <div class="field">
              <label class="label">Email address</label>
              <input type="email" id="forgot-email" class="input" placeholder="you@example.com">
            </div>

            <button id="forgot-btn" class="btn btn-primary" style="margin-top:16px;">
              Send reset link
            </button>

            <div style="text-align:center;margin-top:16px;">
              <a class="link" href="#/login">← Back to sign in</a>
            </div>
          </div>
        </div>

        <div id="panel-check-email" class="panel">
          <div class="card" style="text-align:center;">
            <div class="email-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m2 7 10 6 10-6"/>
              </svg>
            </div>

            <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">
              Check your email
            </h2>
            <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;">
              We've sent a password reset link to
            </p>
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:20px;" id="reset-email-display">
            </p>

            <div class="alert alert-info">
              <svg class="alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 8v3M8 5v.5"/>
              </svg>
              <div>
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </div>
            </div>

            <div style="margin-top:20px;">
              <a class="link" href="#/login">← Back to sign in</a>
            </div>
          </div>
        </div>
      </div>
    `

    const btn = container.querySelector('#forgot-btn')
    btn?.addEventListener('click', _handleForgotPassword)

    const input = container.querySelector('#forgot-email') as HTMLInputElement
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleForgotPassword()
    })
  },

  destroy() {
    _container = null
    _email = ''
  }
}

export default ForgotPassword
