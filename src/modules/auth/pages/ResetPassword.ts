// src/modules/auth/pages/ResetPassword.ts

import { authService } from '../services/authService'
import { navigate } from '../../../core/router'
import type { PageModule } from '../../../types/module.types'

let _container: HTMLElement | null = null

function _showPanel(id: string) {
  if (!_container) return
  _container.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  const p = _container.querySelector(`#${id}`) as HTMLElement
  if (p) p.classList.add('active')
}

function _showError(msg: string) {
  if (!_container) return
  const errWrap = _container.querySelector('#reset-error') as HTMLElement
  if (errWrap) {
    errWrap.style.display = 'block'
    errWrap.textContent = msg
  }
}

function _hideError() {
  if (!_container) return
  const errWrap = _container.querySelector('#reset-error') as HTMLElement
  if (errWrap) errWrap.style.display = 'none'
}

function _setLoading(isLoading: boolean) {
  if (!_container) return
  const btn = _container.querySelector('#reset-btn') as HTMLButtonElement
  if (!btn) return
  if (isLoading) {
    btn.disabled = true
    btn.innerHTML = '<div class="spinner"></div> Updating...'
  } else {
    btn.disabled = false
    btn.innerHTML = 'Set new password'
  }
}

async function _handleSetPassword() {
  if (!_container) return
  const newPw = (_container.querySelector('#new-password') as HTMLInputElement).value
  const confirmPw = (_container.querySelector('#confirm-password') as HTMLInputElement).value

  if (newPw.length < 8) {
    _showError('Password must be at least 8 characters')
    return
  }

  if (newPw !== confirmPw) {
    _showError('Passwords do not match')
    return
  }

  _hideError()
  _setLoading(true)

  try {
    await authService.updatePassword(newPw)
    _showPanel('panel-reset-success')
  } catch (err: any) {
    console.error('Password target failed:', err)
    _showError(err.message || 'Failed to update password')
    _setLoading(false)
  }
}

export const ResetPassword: PageModule = {
  async render(container: HTMLElement) {
    _container = container

    container.innerHTML = `
      <div class="box">
        <div class="heading">
          <div class="h1">CACI Hub</div>
          <div class="subtitle">Set a new password</div>
        </div>

        <div id="panel-reset" class="panel active">
          <div class="card">
            <a class="back-link" href="#/login" style="display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--text-secondary);text-decoration:none;margin-bottom:16px;">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 12L6 8l4-4"/>
              </svg>
              Back to sign in
            </a>

            <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">
              Set a new password
            </h2>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">
              Choose a strong password that you haven't used before.
            </p>

            <div class="field">
              <label class="label">New password</label>
              <div class="input-wrap">
                <input type="password" id="new-password" class="input" placeholder="Enter new password">
                <button type="button" class="eye-btn" id="eye1">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="field">
              <label class="label">Confirm password</label>
              <div class="input-wrap">
                <input type="password" id="confirm-password" class="input" placeholder="Re-enter new password">
                <button type="button" class="eye-btn" id="eye2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                  </svg>
                </button>
              </div>
              <div id="reset-error" class="error-msg" style="display:none;margin-top:6px;"></div>
            </div>

            <button id="reset-btn" class="btn btn-primary" style="margin-top:16px;">
              Set new password
            </button>
          </div>
        </div>

        <div id="panel-reset-success" class="panel">
          <div class="card" style="text-align:center;">
            <div class="success-icon" style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:var(--success-icon-bg);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:24px;height:24px;stroke:var(--success-icon-fill);">
                <path d="M5 12l5 5L20 7"/>
              </svg>
            </div>
            <h2 style="font-size:18px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">
              Password reset successful
            </h2>
            <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;">
              Your password has been changed. You can now sign in with your new password.
            </p>
            <a href="#/login" class="btn btn-primary" style="text-decoration:none;">
              Continue to sign in
            </a>
          </div>
        </div>
      </div>
    `

    const btn = container.querySelector('#reset-btn')
    btn?.addEventListener('click', _handleSetPassword)

    container.querySelector('#eye1')?.addEventListener('click', () => {
      const input = container.querySelector('#new-password') as HTMLInputElement
      input.type = input.type === 'password' ? 'text' : 'password'
    })

    container.querySelector('#eye2')?.addEventListener('click', () => {
      const input = container.querySelector('#confirm-password') as HTMLInputElement
      input.type = input.type === 'password' ? 'text' : 'password'
    })
  },

  destroy() {
    _container = null
  }
}

export default ResetPassword
