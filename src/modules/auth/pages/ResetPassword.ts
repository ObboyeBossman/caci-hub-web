// src/modules/auth/pages/ResetPassword.ts
// UI ported from: auth refs/caci_hub_auth_module.html (panel-reset + panel-reset-success)

import { authService, mapAuthError } from '../services/authService'
import type { PageModule }           from '../../../types/module.types'

let _container: HTMLElement | null = null

const RULES = {
  length: (v: string) => v.length >= 8,
  upper:  (v: string) => /[A-Z]/.test(v),
  lower:  (v: string) => /[a-z]/.test(v),
  number: (v: string) => /\d/.test(v),
}

function _calcStrength(val: string): number {
  if (!val) return 0
  let score = 0
  if (val.length >= 8)  score++
  if (val.length >= 12) score++
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++
  if (/\d/.test(val))   score++
  if (/[^A-Za-z0-9]/.test(val)) score++
  return Math.min(Math.floor(score / 1.25), 4)
}

function _showPanel(id: string) {
  _container?.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'))
  _container?.querySelector(`#${id}`)?.classList.add('active')
}

function _toggleEye(inputId: string, eyeId: string) {
  const inp = _container?.querySelector(`#${inputId}`) as HTMLInputElement
  const eye = _container?.querySelector(`#${eyeId}`)   as HTMLElement
  if (!inp) return
  const show = inp.type === 'password'
  inp.type = show ? 'text' : 'password'
  if (eye) eye.style.opacity = show ? '1' : '0.4'
}

function _onPasswordInput() {
  if (!_container) return
  const val   = (_container.querySelector('#new-password') as HTMLInputElement).value
  const score = _calcStrength(val)

  const reqsEl    = _container.querySelector('#requirements')    as HTMLElement
  const swEl      = _container.querySelector('#strength-wrap')   as HTMLElement
  if (reqsEl) reqsEl.style.display = val ? '' : 'none'
  if (swEl)   swEl.style.display   = val ? '' : 'none'

  ;['length', 'upper', 'lower', 'number'].forEach(key => {
    _container!.querySelector(`#req-${key}`)
      ?.classList.toggle('met', RULES[key as keyof typeof RULES](val))
  })

  const tiers  = ['', 'weak', 'fair', 'good', 'strong']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  ;['bar1', 'bar2', 'bar3', 'bar4'].forEach((id, i) => {
    const bar = _container!.querySelector(`#${id}`)
    if (!bar) return
    bar.className = 'auth-strength-bar'
    if (i < score) bar.classList.add(`filled-${tiers[score]}`)
  })

  const sl = _container.querySelector('#strength-label') as HTMLElement
  if (sl) {
    sl.textContent = val ? labels[score] : ''
    sl.className   = 'auth-strength-label ' + (val ? tiers[score] : '')
  }
}

async function _handleSetPassword() {
  if (!_container) return
  const pw  = (_container.querySelector('#new-password')      as HTMLInputElement).value
  const cpw = (_container.querySelector('#confirm-password')  as HTMLInputElement).value
  const btn = _container.querySelector('#reset-btn')          as HTMLButtonElement
  const pwErr  = _container.querySelector('#pw-error')        as HTMLElement
  const cfmErr = _container.querySelector('#confirm-error')   as HTMLElement

  pwErr.classList.remove('show')
  cfmErr.classList.remove('show')
  ;(_container.querySelector('#new-password')     as HTMLInputElement).classList.remove('error')
  ;(_container.querySelector('#confirm-password') as HTMLInputElement).classList.remove('error')

  const allMet = Object.values(RULES).every(fn => fn(pw))
  if (!pw || !allMet) {
    ;(_container.querySelector('#new-password') as HTMLInputElement).classList.add('error')
    pwErr.classList.add('show')
    return
  }
  if (pw !== cpw || !cpw) {
    ;(_container.querySelector('#confirm-password') as HTMLInputElement).classList.add('error')
    cfmErr.classList.add('show')
    return
  }

  btn.disabled = true
  btn.innerHTML = '<span class="auth-spinner"></span> Updating…'

  try {
    await authService.updatePassword(pw)
    _showPanel('panel-reset-success')
  } catch (err) {
    const el = _container.querySelector('#global-error') as HTMLElement
    if (el) { el.style.display = 'flex'; (el.querySelector('div') as HTMLElement).textContent = mapAuthError(err) }
    btn.disabled = false
    btn.textContent = 'Set new password'
  }
}

export const ResetPassword: PageModule = {
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
              <div class="auth-subtitle">Set a new password</div>
            </div>

            <!-- Reset form panel -->
            <div id="panel-reset" class="auth-panel active">
              <div class="auth-card">

                <a class="auth-back-link" href="#/login">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 12L6 8l4-4"/>
                  </svg>
                  Back to sign in
                </a>

                <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--auth-text-primary);">Set a new password</h2>
                <p style="font-size:13px;color:var(--auth-text-secondary);margin-bottom:20px;">
                  Choose a strong password that you haven't used before.
                </p>

                <!-- Global error -->
                <div id="global-error" class="auth-alert auth-alert-error" style="display:none;">
                  <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
                  </svg>
                  <div></div>
                </div>

                <!-- New password -->
                <div class="auth-field">
                  <label class="auth-label">New password</label>
                  <div class="auth-input-wrap">
                    <input type="password" id="new-password" class="auth-input" placeholder="Enter new password" autocomplete="new-password">
                    <button type="button" class="auth-eye-btn" id="eye1" aria-label="Toggle visibility">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                  </div>
                  <div id="pw-error" class="auth-error-msg">Password does not meet requirements</div>

                  <div id="requirements" class="auth-requirements">
                    <div id="req-length" class="auth-req-item"><div class="auth-req-icon"></div><span>At least 8 characters</span></div>
                    <div id="req-upper"  class="auth-req-item"><div class="auth-req-icon"></div><span>One uppercase letter</span></div>
                    <div id="req-lower"  class="auth-req-item"><div class="auth-req-icon"></div><span>One lowercase letter</span></div>
                    <div id="req-number" class="auth-req-item"><div class="auth-req-icon"></div><span>One number</span></div>
                  </div>

                  <div id="strength-wrap" class="auth-strength-wrap">
                    <div class="auth-strength-bars">
                      <div id="bar1" class="auth-strength-bar"></div>
                      <div id="bar2" class="auth-strength-bar"></div>
                      <div id="bar3" class="auth-strength-bar"></div>
                      <div id="bar4" class="auth-strength-bar"></div>
                    </div>
                    <div id="strength-label" class="auth-strength-label"></div>
                  </div>
                </div>

                <!-- Confirm password -->
                <div class="auth-field">
                  <label class="auth-label">Confirm password</label>
                  <div class="auth-input-wrap">
                    <input type="password" id="confirm-password" class="auth-input" placeholder="Re-enter new password" autocomplete="new-password">
                    <button type="button" class="auth-eye-btn" id="eye2" aria-label="Toggle visibility">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                  </div>
                  <div id="confirm-error" class="auth-error-msg">Passwords do not match</div>
                </div>

                <button id="reset-btn" class="auth-btn auth-btn-primary" style="margin-top:16px;">Set new password</button>
              </div>
            </div>

            <!-- Success panel -->
            <div id="panel-reset-success" class="auth-panel">
              <div class="auth-card" style="text-align:center;">
                <div class="auth-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                </div>
                <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--auth-text-primary);">Password reset successful</h2>
                <p style="font-size:14px;color:var(--auth-text-secondary);margin-bottom:20px;">
                  Your password has been changed. You can now sign in with your new password.
                </p>
                <a href="#/login" class="auth-btn auth-btn-primary" style="text-decoration:none;">Continue to sign in</a>
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

    container.querySelector('#new-password')?.addEventListener('input', _onPasswordInput)
    container.querySelector('#confirm-password')?.addEventListener('input', () => {
      ;(_container?.querySelector('#confirm-password') as HTMLElement)?.classList.remove('error')
      _container?.querySelector('#confirm-error')?.classList.remove('show')
    })

    container.querySelector('#reset-btn')?.addEventListener('click', _handleSetPassword)
    container.querySelector('#eye1')?.addEventListener('click', () => _toggleEye('new-password', 'eye1'))
    container.querySelector('#eye2')?.addEventListener('click', () => _toggleEye('confirm-password', 'eye2'))
  },

  destroy() { _container = null }
}

export default ResetPassword
