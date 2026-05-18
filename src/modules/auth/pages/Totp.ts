// src/modules/auth/pages/Totp.ts

import { authService, mapAuthError } from '../services/authService'
import { navigate } from '../../../core/router'
import type { PageModule } from '../../../types/module.types'

let _container: HTMLElement | null = null
let _isEnrollment = false

function _showError(msg: string) {
  if (!_container) return
  const errWrap = _container.querySelector('#totp-error-alert') as HTMLElement
  const extText = _container.querySelector('#totp-error-text') as HTMLElement
  if (errWrap && extText) {
    errWrap.style.display = 'flex'
    extText.textContent = msg
  }
}

function _hideError() {
  if (!_container) return
  const errWrap = _container.querySelector('#totp-error-alert') as HTMLElement
  if (errWrap) errWrap.style.display = 'none'
}

function _setLoading(isLoading: boolean) {
  if (!_container) return
  const btn = _container.querySelector('#totp-btn') as HTMLButtonElement
  if (!btn) return
  if (isLoading) {
    btn.disabled = true
    btn.innerHTML = '<div class="spinner"></div> Verifying...'
  } else {
    btn.disabled = false
    btn.innerHTML = 'Verify code'
  }
}

async function _initEnrollment() {
  if (!_container) return
  try {
    // enrollTotp() now returns { factorId, qrCodeUrl, secret }
    const result = await authService.enrollTotp()

    const qrContainer = _container.querySelector('#qr-container') as HTMLElement
    if (qrContainer) {
      // qrCodeUrl is an SVG string from Supabase
      qrContainer.innerHTML = result.qrCodeUrl
    }

    // Optionally show the secret key for manual entry
    const secretEl = _container.querySelector('#totp-secret') as HTMLElement
    if (secretEl) {
      secretEl.textContent = result.secret
    }
  } catch (err) {
    _showError(mapAuthError(err))
  }
}

function _getCode(): string {
  if (!_container) return ''
  let code = ''
  for (let i = 0; i < 6; i++) {
    const input = _container.querySelector(`#digit-${i}`) as HTMLInputElement
    code += input?.value ?? ''
  }
  return code
}

async function _handleVerify() {
  if (!_container) return

  const code = _getCode()
  if (code.length !== 6) {
    _showError('Please enter all 6 digits.')
    return
  }

  _hideError()
  _setLoading(true)

  try {
    // verifyTotp now only takes `code` — resolves factorId internally
    await authService.verifyTotp(code)
    // Refresh user state to mark isMfaVerified = true
    await authService.refreshCurrentUser()
    navigate('/')
  } catch (err) {
    _showError(mapAuthError(err))
    _setLoading(false)
  }
}

export const Totp: PageModule = {
  async render(container: HTMLElement) {
    _container = container
    _isEnrollment = window.location.hash.includes('enroll')

    container.innerHTML = `
      <div class="box">
        <div class="heading">
          <div class="h1">CACI Hub</div>
          <div class="subtitle">Two-Factor Authentication</div>
        </div>

        <div id="panel-totp" class="panel active">
          <div class="card">
            <a href="#/login" style="display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--text-secondary);text-decoration:none;margin-bottom:16px;">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 12L6 8l4-4"/>
              </svg>
              Cancel
            </a>

            <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">
              ${_isEnrollment ? 'Set up Authenticator' : 'Verification Required'}
            </h2>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">
              ${_isEnrollment
                ? 'Scan the QR code below with your authenticator app, then enter the 6-digit code.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>

            ${_isEnrollment ? `
              <div id="qr-container" style="display:flex;justify-content:center;margin-bottom:12px;background:white;padding:10px;border-radius:8px;">
                <div class="spinner"></div>
              </div>
              <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-bottom:16px;">
                Can't scan? Enter manually: <code id="totp-secret" style="font-size:11px;user-select:all;"></code>
              </p>
            ` : ''}

            <div id="totp-error-alert" class="alert alert-error" style="display:none;margin-bottom:16px;">
              <svg class="alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 4v4M8 10v.5"/>
              </svg>
              <div id="totp-error-text"></div>
            </div>

            <div class="code-inputs" style="display:flex;gap:8px;justify-content:center;margin-bottom:20px;">
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-0" autofocus>
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-1">
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-2">
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-3">
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-4">
              <input type="text" inputmode="numeric" maxlength="1" class="code-digit" id="digit-5">
            </div>

            <button id="totp-btn" class="btn btn-primary" style="margin-top:16px;">
              Verify code
            </button>
          </div>
        </div>
      </div>
    `

    // Auto-advance digit inputs
    for (let i = 0; i < 6; i++) {
      const input = container.querySelector(`#digit-${i}`) as HTMLInputElement
      if (!input) continue

      input.addEventListener('input', () => {
        // Strip non-digits
        input.value = input.value.replace(/\D/g, '')
        if (input.value.length === 1 && i < 5) {
          (container.querySelector(`#digit-${i + 1}`) as HTMLInputElement)?.focus()
        }
      })

      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Backspace' && input.value === '' && i > 0) {
          (container.querySelector(`#digit-${i - 1}`) as HTMLInputElement)?.focus()
        } else if (e.key === 'Enter') {
          _handleVerify()
        }
      })
    }

    container.querySelector('#totp-btn')?.addEventListener('click', _handleVerify)

    if (_isEnrollment) {
      await _initEnrollment()
    }
  },

  destroy() {
    _container = null
  }
}

export default Totp
