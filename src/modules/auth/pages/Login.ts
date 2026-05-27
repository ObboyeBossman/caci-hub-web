// src/modules/auth/pages/Login.ts
// UI ported from: auth refs/caci_hub_auth_module.html (panel-signin)

import { authService, mapAuthError } from '../services/authService'
import { navigate } from '../../../core/router'
import { getCurrentUser, loadCurrentUser } from '../../../core/auth'
import { getFirstModuleRoute } from '../../../core/registry'
import type { PageModule } from '../../../types/module.types'
import type { AppUser } from '../../../types/auth.types'
import logoUrl from '../../../assets/caci-logo.png'

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

// ── Page ──────────────────────────────────────────────────────────────────────


export const Login: PageModule = {
  async render(container: HTMLElement) {
    _container = container

    // ── 1. Read Assembly Branding ───────────────────────────────────────────
    const assemblyJson = sessionStorage.getItem('selectedAssembly')
    if (!assemblyJson) {
      console.warn('[Login] No assembly selected. Redirecting to selection.')
      navigate('/select-assembly')
      return
    }
    const assembly = JSON.parse(assemblyJson)

    // ── 2. Render UI ────────────────────────────────────────────────────────
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

            <!-- Church Branding -->
            <div class="auth-church-brand">
              <div class="auth-church-logo-wrap">
                <img src="${logoUrl}" alt="Christ Apostolic Church International logo">
              </div>
              <div>
                <div class="auth-church-name">Christ Apostolic Church International</div>
                <div class="auth-church-motto">"One Fold, One Shepherd"</div>
              </div>
              <div class="auth-church-divider"></div>
            </div>

            <div class="auth-heading">
              <div class="auth-h1">Sign in to CACI Hub</div>
              <div class="auth-subtitle">Securely access your account</div>
            </div>

            <!-- Assembly Badge -->
            <div class="assembly-badge" style="display: flex; align-items: center; gap: 12px; background: var(--auth-card-bg); border: 1px solid var(--auth-card-border); border-radius: 6px; padding: 10px 14px; margin-bottom: 20px;">
              <div class="assembly-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--auth-body-bg); border: 1px solid var(--auth-card-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                <img src="/caci-logo.jpeg" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <div class="assembly-badge-info" style="flex: 1; min-width: 0;">
                <p class="assembly-badge-name" style="font-size: 13px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--auth-text-primary);">${assembly.name}</p>
                <p class="assembly-badge-loc" style="font-size: 11px; color: var(--auth-text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  <i class="bi bi-geo-alt"></i> ${assembly.address || 'Unknown location'}
                </p>
              </div>

              <a class="auth-link" href="#/select-assembly" style="font-size: 12px; flex-shrink: 0;">Change</a>
            </div>

            <!-- Card -->
            <div class="auth-card">

              <!-- Tabs -->
              <div class="auth-tabs" style="display:flex;margin-bottom:16px;border-bottom:1px solid var(--auth-card-border);">
                <button type="button" class="auth-tab active" data-mode="email" style="flex:1;padding:8px;background:none;border:none;border-bottom:2px solid var(--primary-color);cursor:pointer;font-weight:600;color:var(--text-primary);">Email</button>
                <button type="button" class="auth-tab" data-mode="phone" style="flex:1;padding:8px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--text-secondary);">Phone</button>
              </div>

              <!-- Error alert -->
              <div id="signin-error" class="auth-alert auth-alert-error" style="display:none;">
                <svg class="auth-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="8" cy="8" r="6"/><path d="M8 4v4M8 10v.5"/>
                </svg>
                <div id="signin-error-text"></div>
              </div>

              <!-- Email field -->
              <div class="auth-field" id="email-field">
                <label class="auth-label">Email address</label>
                <input type="email" id="signin-email-input" class="auth-input" placeholder="you@example.com" autocomplete="email">
              </div>

              <!-- Phone field -->
              <div class="auth-field" id="phone-field" style="display:none;">
                <label class="auth-label">Phone number</label>
                <input type="tel" id="signin-phone-input" class="auth-input" placeholder="+233 24 123 4567" autocomplete="tel">
              </div>

              <!-- Password field -->
              <div class="auth-field">
                <div class="auth-field-header">
                  <label class="auth-label">Password</label>
                  <a class="auth-link" id="forgot-pw-link" href="#/forgot-password" style="font-size:13px;">Forgot?</a>
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

    // ── 3. Internal Logic ───────────────────────────────────────────────────
    let signInMode: 'email' | 'phone' = 'email'

    container.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLButtonElement
        signInMode = btn.dataset.mode as 'email' | 'phone'

        container.querySelectorAll('.auth-tab').forEach(t => {
          ;(t as HTMLElement).style.borderBottomColor = 'transparent'
          ;(t as HTMLElement).style.color = 'var(--text-secondary)'
          ;(t as HTMLElement).style.fontWeight = 'normal'
        })
        btn.style.borderBottomColor = 'var(--primary-color)'
        btn.style.color = 'var(--text-primary)'
        btn.style.fontWeight = '600'

        const emailField = container.querySelector('#email-field') as HTMLElement
        const phoneField = container.querySelector('#phone-field') as HTMLElement
        const forgotLink = container.querySelector('#forgot-pw-link') as HTMLAnchorElement

        if (signInMode === 'email') {
          emailField.style.display = 'block'
          phoneField.style.display = 'none'
          forgotLink.href = '#/forgot-password'
          forgotLink.onclick = null
        } else {
          emailField.style.display = 'none'
          phoneField.style.display = 'block'
          forgotLink.href = '#'
          forgotLink.onclick = (ev) => {
            ev.preventDefault()
            _showError('To reset your password, please contact your assembly administrator.')
          }
        }
      })
    })

    const handleSignInInternal = async () => {
      const emailInput = container.querySelector('#signin-email-input') as HTMLInputElement
      const phoneInput = container.querySelector('#signin-phone-input') as HTMLInputElement
      const pwInput = container.querySelector('#signin-pw') as HTMLInputElement

      _hideError()

      const identifierValue = signInMode === 'email' ? emailInput.value.trim() : phoneInput.value.trim()

      if (!identifierValue || !pwInput.value) {
        _showError('Please enter your credentials.')
        return
      }

      _setLoading(true)
      try {
        const identifier = signInMode === 'email' ? { email: identifierValue } : { phone: identifierValue }
        await authService.signIn(identifier, pwInput.value)
        await loadCurrentUser()
        const user = getCurrentUser() as AppUser

        // ── Membership Verification ──────────────────────────────────────────
        // Users must belong to the selected assembly to proceed.
        // Exception: National Admins / Overseers.
        const isStaff = user?.role === 'national_admin' || user?.role === 'district_overseer'
        if (user && !isStaff && user.assemblyId !== assembly.id) {
          await authService.signOut()
          _showError(`You are not registered with ${assembly.name}. Please select the correct assembly.`)
          _setLoading(false)
          return
        }

        // Progress to Stage 4 (Loading/Boot Sequence)
        const { runLoading } = await import('../../../core/loading')
        runLoading()

      } catch (err) {
        _showError(mapAuthError(err, signInMode))
        _setLoading(false)
      }
    }
    container.querySelector('#signin-btn')
      ?.addEventListener('click', handleSignInInternal)

    container.querySelector('#signin-pw')
      ?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') handleSignInInternal() })

    container.querySelector('#signin-email-input')
      ?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') handleSignInInternal() })

    container.querySelector('#signin-phone-input')
      ?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') handleSignInInternal() })

    container.querySelector('#eye-btn')
      ?.addEventListener('click', () => _toggleEye('signin-pw', 'eye-btn'))
  },

  destroy() { _container = null }
}

export default Login