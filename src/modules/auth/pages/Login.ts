// src/modules/auth/pages/Login.ts

import { authService } from '../services/authService'
import { navigate } from '../../../core/router'
import type { PageModule } from '../../../types/module.types'

// No renderSkeleton() for auth pages per architectural rule.

let _container: HTMLElement | null = null

function _showError(msg: string) {
  if (!_container) return
  const errWrap = _container.querySelector('#signin-error') as HTMLElement
  if (errWrap) {
    errWrap.style.display = 'flex'
    errWrap.innerHTML = `
      <svg class="alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
      </svg>
      <div>${msg}</div>
    `
  }
}

function _hideError() {
  if (!_container) return
  const errWrap = _container.querySelector('#signin-error') as HTMLElement
  if (errWrap) errWrap.style.display = 'none'
}

function _setLoading(isLoading: boolean) {
  if (!_container) return
  const btn = _container.querySelector('#signin-btn') as HTMLButtonElement
  if (!btn) return
  if (isLoading) {
    btn.disabled = true
    btn.innerHTML = '<div class="spinner"></div> Signing in...'
  } else {
    btn.disabled = false
    btn.innerHTML = 'Sign in'
  }
}

async function _handleSignIn() {
  if (!_container) return
  const emailInput = _container.querySelector('#signin-email-input') as HTMLInputElement
  const pwInput = _container.querySelector('#signin-pw') as HTMLInputElement

  const email = emailInput.value.trim()
  const password = pwInput.value

  if (!email || !password) {
    _showError('Please enter both email and password.')
    return
  }

  _hideError()
  _setLoading(true)

  try {
    await authService.signIn(email, password)
    
    // Check TOTP requirement post-login
    const enrolled = await authService.hasTotpEnrolled()
    if (enrolled) {
      navigate('/totp-verify')
    } else {
      navigate('/totp-enroll')
    }
  } catch (err: any) {
    console.error('Sign in failed:', err)
    let msg = 'Invalid email or password.'
    if (err.message && String(err.message).toLowerCase().includes('rate')) {
      msg = 'Too many attempts. Please try again later.'
    } else if (err.message) {
      msg = err.message
    }
    _showError(msg)
    _setLoading(false)
  }
}

export const Login: PageModule = {
  async render(container: HTMLElement) {
    _container = container

    container.innerHTML = `
      <div class="box">
        <div class="heading">
          <div class="h1">Sign in to CACI Hub</div>
          <div class="subtitle">Securely access your account</div>
        </div>

        <div class="card">
          <!-- Error alert -->
          <div id="signin-error" class="alert alert-error" style="display:none;margin-bottom:16px;"></div>

          <!-- Email Panel -->
          <div id="signin-email-panel">
            <div class="field">
              <label class="label">Email address</label>
              <input type="email" id="signin-email-input" class="input" placeholder="you@example.com">
            </div>
            <div class="field">
              <div class="field-header">
                <label class="label">Password</label>
                <a class="link" href="#/forgot-password">Forgot?</a>
              </div>
              <div class="input-wrap">
                <input type="password" id="signin-pw" class="input" placeholder="Enter your password">
                <button type="button" class="eye-btn" id="eye-btn" aria-label="Toggle password visibility">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                    <circle cx="8" cy="8" r="2"/>
                  </svg>
                </button>
              </div>
            </div>
            <button id="signin-btn" class="btn btn-primary" style="margin-top:16px;">
              Sign in
            </button>
          </div>
        </div>
      </div>
    `

    // Attach listeners
    const btn = container.querySelector('#signin-btn')
    btn?.addEventListener('click', _handleSignIn)

    // Optional pressing Enter submits
    const pwInput = container.querySelector('#signin-pw') as HTMLInputElement
    pwInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleSignIn()
    })

    const eyeBtn = container.querySelector('#eye-btn')
    eyeBtn?.addEventListener('click', () => {
      const type = pwInput.getAttribute('type') === 'password' ? 'text' : 'password'
      pwInput.setAttribute('type', type)
    })
  },

  destroy() {
    _container = null
  }
}

export default Login
