// src/modules/auth/pages/Totp.ts
// UI ported from: auth refs/caci_hub_auth_module.html (panel-totp)

import { authService, mapAuthError } from '../services/authService'
import { navigate }                  from '../../../core/router'
import { loadCurrentUser }           from '../../../core/auth'
import type { PageModule }           from '../../../types/module.types'
import logoUrl from '../../../assets/caci-logo.png'

let _container:    HTMLElement | null = null
let _isEnrollment: boolean            = false

// ── Helpers ───────────────────────────────────────────────────────────────────

function _showError(msg: string) {
  const el = _container?.querySelector('#totp-error-alert') as HTMLElement
  const tx = _container?.querySelector('#totp-error-text')  as HTMLElement
  if (el && tx) {
    el.style.display = 'flex'
    tx.textContent   = msg
    // Shake the code digits
    _container?.querySelectorAll('.auth-code-digit')
      .forEach(d => d.classList.add('error'))
    setTimeout(() => {
      el.style.display = 'none'
      _container?.querySelectorAll('.auth-code-digit')
        .forEach(d => d.classList.remove('error'))
    }, 3000)
  }
}

function _setLoading(on: boolean) {
  const btn = _container?.querySelector('#totp-btn') as HTMLButtonElement
  if (!btn) return
  if (on) {
    btn.disabled = true
    btn.innerHTML = '<span class="auth-spinner"></span> Verifying…'
  } else {
    btn.disabled = false
    btn.textContent = 'Verify'
  }
}

function _getCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += (_container?.querySelector(`#digit-${i}`) as HTMLInputElement)?.value ?? ''
  }
  return code
}

function _clearCode() {
  for (let i = 0; i < 6; i++) {
    const inp = _container?.querySelector(`#digit-${i}`) as HTMLInputElement
    if (inp) { inp.value = ''; inp.classList.remove('filled', 'error') }
  }
  (_container?.querySelector('#digit-0') as HTMLInputElement)?.focus()
}

// ── TOTP verify ───────────────────────────────────────────────────────────────

async function _handleVerify() {
  const code = _getCode()
  if (code.length !== 6) { _showError('Please enter all 6 digits'); return }

  _setLoading(true)
  try {
    await authService.verifyTotp(code)
    const btn = _container?.querySelector('#totp-btn') as HTMLButtonElement
    if (btn) { btn.textContent = '✓ Verified — redirecting…' }
    await loadCurrentUser()
    setTimeout(() => navigate('/'), 600)
  } catch (err) {
    _showError(mapAuthError(err))
    _clearCode()
    _setLoading(false)
  }
}

// ── Enroll init ───────────────────────────────────────────────────────────────

async function _initEnrollment() {
  try {
    const result = await authService.enrollTotp()

    const qrEl = _container?.querySelector('#qr-container') as HTMLElement
    if (qrEl) qrEl.innerHTML = result.qrCodeUrl  // SVG from Supabase

    const secretEl = _container?.querySelector('#totp-secret') as HTMLElement
    if (secretEl) secretEl.textContent = result.secret
  } catch (err) {
    _showError(mapAuthError(err))
  }
}

// ── Wire digit inputs ─────────────────────────────────────────────────────────

function _wireDigitInputs(container: HTMLElement) {
  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('.auth-code-digit'))

  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '')
      if (input.value) {
        input.classList.add('filled')
        if (i < inputs.length - 1) {
          inputs[i + 1].focus()
        } else {
          setTimeout(() => _handleVerify(), 100)
        }
      } else {
        input.classList.remove('filled')
      }
    })

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].focus()
        inputs[i - 1].value = ''
        inputs[i - 1].classList.remove('filled')
      }
      if (e.key === 'ArrowLeft'  && i > 0)               inputs[i - 1].focus()
      if (e.key === 'ArrowRight' && i < inputs.length - 1) inputs[i + 1].focus()
      if (e.key === 'Enter')                              _handleVerify()
    })

    input.addEventListener('paste', (e: ClipboardEvent) => {
      e.preventDefault()
      const paste = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6)
      paste.split('').forEach((char, j) => {
        if (inputs[j]) {
          inputs[j].value = char
          inputs[j].classList.add('filled')
        }
      })
      if (paste.length === 6) {
        inputs[5].focus()
        setTimeout(() => _handleVerify(), 100)
      }
    })
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const Totp: PageModule = {
  async render(container: HTMLElement) {
    _container    = container
    _isEnrollment = window.location.hash.includes('enroll')

    container.innerHTML = `
      <div class="auth-root">

        <!-- Header -->
        <div class="auth-header">
          <a class="auth-logo" href="#/login">
             <img src="${logoUrl}" alt="CACI Logo" class="auth-logo-img">
             <div class="auth-logo-text">CACI Hub</div>
          </a>
        </div>

        <!-- Container -->
        <div class="auth-container">
          <div class="auth-box">

            <div class="auth-heading">
              <div class="auth-h1">CACI Hub</div>
              <div class="auth-subtitle">Two-Factor Authentication</div>
            </div>

            <div class="auth-card">

              <!-- Back link (shown only on enroll) -->
              ${_isEnrollment ? `
                <a href="#/login" class="auth-back-link">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 12L6 8l4-4"/>
                  </svg>
                  Cancel
                </a>
              ` : ''}

              <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--auth-text-primary);">
                ${_isEnrollment ? 'Set up Authenticator' : 'Two-factor authentication'}
              </h2>
              <p style="font-size:13px;color:var(--auth-text-secondary);margin-bottom:20px;">
                ${_isEnrollment
                  ? 'Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </p>

              <!-- QR code (enrollment only) -->
              ${_isEnrollment ? `
                <div id="qr-container" class="auth-qr-container">
                  <span class="auth-spinner" style="border-top-color:var(--auth-btn-primary);border-color:rgba(0,0,0,.1);"></span>
                </div>
                <p style="font-size:11px;color:var(--auth-text-muted);text-align:center;margin-bottom:16px;">
                  Can't scan? Enter manually: <code id="totp-secret" style="font-size:11px;user-select:all;word-break:break-all;"></code>
                </p>
              ` : ''}

              <!-- Error alert -->
              <div id="totp-error-alert" class="auth-alert auth-alert-error" style="display:none;">
                <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
                </svg>
                <div id="totp-error-text"></div>
              </div>

              <!-- 6-digit code inputs -->
              <div class="auth-code-inputs">
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-0" autofocus>
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-1">
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-2">
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-3">
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-4">
                <input type="text" inputmode="numeric" maxlength="1" class="auth-code-digit" id="digit-5">
              </div>

              <button id="totp-btn" class="auth-btn auth-btn-primary">Verify</button>

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

    _wireDigitInputs(container)
    container.querySelector('#totp-btn')?.addEventListener('click', _handleVerify)

    if (_isEnrollment) {
      await _initEnrollment()
    }
  },

  destroy() { _container = null }
}

export default Totp
