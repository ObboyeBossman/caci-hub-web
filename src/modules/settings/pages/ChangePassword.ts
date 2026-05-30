import { ChangePasswordSchema } from '../schemas/change-password.schema'
import { supabase }             from '../../../core/supabase'
import { loadCurrentUser,
         getCurrentUser }       from '../../../core/auth'
import { navigate }             from '../../../core/router'
import { getFirstModuleRoute }  from '../../../core/registry'
import { Toast }                from '../../../shared/components/Toast'
import type { PageModule }      from '../../../types/module.types'

// ── Inject component CSS once ────────────────────────────────────────────────
let _cssInjected = false
function _injectCSS() {
  if (_cssInjected) return
  _cssInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .cp-root{font-family:'DM Sans','Inter',sans-serif;min-height:100vh;background:var(--auth-body-bg);display:flex;align-items:center;justify-content:center;padding:2rem 1rem}
    .cp-card{background:var(--auth-card-bg);border:1px solid var(--border-color);border-radius:16px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)}
    .cp-header{padding:2rem 2rem 1.5rem;border-bottom:1px solid var(--border-color)}
    .cp-brand{display:flex;align-items:center;gap:10px;margin-bottom:1.25rem}
    .cp-brand-logo{width:32px;height:32px;border-radius:6px;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center}
    .cp-brand-logo img{width:100%;height:100%;object-fit:cover}
    .cp-brand-name{font-size: var(--text-base);font-weight:600;color:var(--text-secondary);letter-spacing:.04em;text-transform:uppercase}
    .cp-title{font-size: var(--text-2xl);font-weight:700;color:var(--text-primary);line-height:1.2;margin-bottom:.35rem}
    .cp-subtitle{font-size: var(--text-base);color:var(--text-secondary);line-height:1.5}
    .cp-body{padding:1.5rem 2rem 2rem}
    .cp-notice{display:flex;gap:10px;align-items:flex-start;background:rgba(0,75,160,.07);border:1px solid rgba(0,75,160,.18);border-radius:8px;padding:.75rem 1rem;margin-bottom:1.5rem}
    .cp-notice-icon{font-size: var(--text-lg);color:#004BA0;flex-shrink:0;margin-top:1px;line-height:1}
    .cp-notice span{font-size: var(--text-sm);color:var(--text-secondary);line-height:1.45}
    .cp-field{margin-bottom:1.1rem}
    .cp-label{display:block;font-size: var(--text-base);font-weight:500;color:var(--text-primary);margin-bottom:.4rem}
    .cp-input-wrap{position:relative}
    .cp-input{width:100%;height:40px;padding:0 40px 0 12px;font-size: var(--text-base);font-family:inherit;background:var(--input-bg, var(--auth-card-bg));border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}
    .cp-input:focus{border-color:#004BA0;box-shadow:0 0 0 3px rgba(0,75,160,.1)}
    .cp-input.cp-err-highlight{border-color:#e74c3c}
    .cp-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted, var(--text-secondary));display:flex;align-items:center;padding:2px;line-height:1}
    .cp-toggle:hover{color:var(--text-primary)}
    .cp-err-msg{font-size: var(--text-sm);color:#e74c3c;margin-top:.3rem;display:none}
    .cp-err-msg.show{display:block}
    .cp-strength{margin-top:.5rem}
    .cp-strength-bars{display:flex;gap:4px;margin-bottom:.3rem}
    .cp-strength-bar{height:3px;flex:1;border-radius:2px;background:var(--border-color);transition:background .3s}
    .cp-strength-label{font-size:11.5px;color:var(--text-secondary)}
    .cp-rules{display:grid;grid-template-columns:1fr 1fr;gap:.25rem .5rem;margin-top:.6rem}
    .cp-rule{font-size:11.5px;color:var(--text-secondary);display:flex;align-items:center;gap:5px;transition:color .2s}
    .cp-rule.met{color:#1D9E75}
    .cp-rule svg{width:12px;height:12px;flex-shrink:0}
    .cp-divider{height:1px;background:var(--border-color);margin:1.25rem 0}
    .cp-btn{width:100%;height:42px;background:#004BA0;color:white;border:none;border-radius:8px;font-size: var(--text-base);font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,transform .1s;display:flex;align-items:center;justify-content:center;gap:8px}
    .cp-btn:hover:not(:disabled){background:#003a7d}
    .cp-btn:active:not(:disabled){transform:scale(.98)}
    .cp-btn:disabled{background:var(--border-color);cursor:not-allowed;transform:none}
    .cp-btn.cp-success{background:#1D9E75;color:white}
    .cp-back{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:1rem;font-size: var(--text-base);color:var(--text-secondary);cursor:pointer;text-decoration:none;background:none;border:none;width:100%;font-family:inherit}
    .cp-back:hover{color:var(--text-primary)}
    @keyframes cp-spin{to{transform:rotate(360deg)}}
    .cp-spin{animation:cp-spin 1s linear infinite;display:inline-block}
  `
  document.head.appendChild(style)
}

// ── Strength scorer ───────────────────────────────────────────────────────────
const STRENGTH_COLORS = ['#E24B4A', '#ef9f27', '#639922', '#1D9E75']
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

function _scorePassword(container: HTMLElement, v: string) {
  const rules = {
    len:   v.length >= 8,
    upper: /[A-Z]/.test(v) && /[a-z]/.test(v),
    num:   /[0-9]/.test(v),
    sym:   /[^A-Za-z0-9]/.test(v),
  }
  const score = Object.values(rules).filter(Boolean).length
  const col   = score > 0 ? STRENGTH_COLORS[score - 1]! : 'var(--border-color)'

  ;['sb1','sb2','sb3','sb4'].forEach((id, i) => {
    const bar = container.querySelector<HTMLElement>(`#${id}`)
    if (bar) bar.style.background = i < score ? col : 'var(--border-color)'
  })

  const lbl = container.querySelector<HTMLElement>('#cp-strength-lbl')
  if (lbl) {
    lbl.textContent  = v.length ? STRENGTH_LABELS[score]! : ''
    lbl.style.color  = score > 0 ? col : 'var(--text-secondary)'
  }

  const map: Record<string, boolean> = { len: rules.len, upper: rules.upper, num: rules.num, sym: rules.sym }
  Object.entries(map).forEach(([k, met]) => {
    container.querySelector(`#r-${k}`)?.classList.toggle('met', met)
  })
}

// ── Toggle password visibility ────────────────────────────────────────────────
function _toggleVis(container: HTMLElement, inputId: string, btn: HTMLButtonElement) {
  const inp = container.querySelector<HTMLInputElement>(`#${inputId}`)!
  const isText = inp.type === 'text'
  inp.type = isText ? 'password' : 'text'
  // Swap icon
  btn.querySelector('svg')?.remove()
  btn.insertAdjacentHTML('beforeend', isText ? _eyeIcon() : _eyeOffIcon())
}

// ── Inline error helpers ─────────────────────────────────────────────────────
function _showErr(container: HTMLElement, errId: string, inputId: string, msg: string) {
  const el = container.querySelector(`#${errId}`)
  if (el) { el.textContent = msg; el.classList.add('show') }
  container.querySelector(`#${inputId}`)?.classList.add('cp-err-highlight')
}
function _clearErrs(container: HTMLElement) {
  container.querySelectorAll('.cp-err-msg').forEach(e => e.classList.remove('show'))
  container.querySelectorAll('.cp-err-highlight').forEach(i => i.classList.remove('cp-err-highlight'))
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const _lockIcon    = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
const _spinIcon    = () => `<svg class="cp-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`
const _checkIcon   = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
const _eyeIcon     = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const _eyeOffIcon  = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
const _ruleCheckIcon = () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
const _infoIcon    = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004BA0" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`

// ── HTML builder ──────────────────────────────────────────────────────────────
function _buildHTML(forced: boolean): string {
  return `
<div class="cp-root">
  <div class="cp-card">
    <div class="cp-header">
      <div class="cp-brand">
        <div class="cp-brand-logo">
          <img src="/caci-logo.jpeg" alt="CACI Logo" />
        </div>
        <span class="cp-brand-name">CACI Hub</span>
      </div>
      <div class="cp-title">${forced ? 'Set a new password' : 'Change your password'}</div>
      <div class="cp-subtitle">${forced ? "You need to set a new password before continuing." : "Choose something strong you haven't used before."}</div>
    </div>

    <div class="cp-body">
      <div class="cp-notice">
        <span class="cp-notice-icon">${_infoIcon()}</span>
        <span>For your security, please re-enter your current password to continue.</span>
      </div>

      <!-- Current password -->
      <div class="cp-field">
        <label class="cp-label" for="cp-current">Current password</label>
        <div class="cp-input-wrap">
          <input class="cp-input" type="password" id="cp-current"
            placeholder="Enter current password" autocomplete="current-password">
          <button class="cp-toggle" type="button" id="cp-toggle-current" aria-label="Show password">
            ${_eyeIcon()}
          </button>
        </div>
        <div class="cp-err-msg" id="cp-err-current">Current password is required.</div>
      </div>

      <div class="cp-divider"></div>

      <!-- New password -->
      <div class="cp-field">
        <label class="cp-label" for="cp-new">New password</label>
        <div class="cp-input-wrap">
          <input class="cp-input" type="password" id="cp-new"
            placeholder="At least 8 characters" autocomplete="new-password">
          <button class="cp-toggle" type="button" id="cp-toggle-new" aria-label="Show password">
            ${_eyeIcon()}
          </button>
        </div>
        <!-- Strength meter -->
        <div class="cp-strength">
          <div class="cp-strength-bars">
            <div class="cp-strength-bar" id="sb1"></div>
            <div class="cp-strength-bar" id="sb2"></div>
            <div class="cp-strength-bar" id="sb3"></div>
            <div class="cp-strength-bar" id="sb4"></div>
          </div>
          <div class="cp-strength-label" id="cp-strength-lbl"></div>
          <div class="cp-rules">
            <div class="cp-rule" id="r-len">${_ruleCheckIcon()} 8+ characters</div>
            <div class="cp-rule" id="r-upper">${_ruleCheckIcon()} Uppercase letter</div>
            <div class="cp-rule" id="r-num">${_ruleCheckIcon()} Number</div>
            <div class="cp-rule" id="r-sym">${_ruleCheckIcon()} Special character</div>
          </div>
        </div>
        <div class="cp-err-msg" id="cp-err-new">New password must be at least 8 characters.</div>
      </div>

      <!-- Confirm password -->
      <div class="cp-field" style="margin-bottom:0">
        <label class="cp-label" for="cp-confirm">Confirm new password</label>
        <div class="cp-input-wrap">
          <input class="cp-input" type="password" id="cp-confirm"
            placeholder="Repeat new password" autocomplete="new-password">
          <button class="cp-toggle" type="button" id="cp-toggle-confirm" aria-label="Show password">
            ${_eyeIcon()}
          </button>
        </div>
        <div class="cp-err-msg" id="cp-err-confirm">Passwords do not match.</div>
      </div>

      <div style="margin-top:1.5rem">
        <button class="cp-btn" id="cp-submit" type="button">
          ${_lockIcon()} Set password
        </button>
        ${!forced ? `<button class="cp-back" type="button" id="cp-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>` : ''}
      </div>
    </div>
  </div>
</div>`
}

// ── Module ────────────────────────────────────────────────────────────────────
const ChangePassword: PageModule = {

  async render(container) {
    _injectCSS()

    const forced = new URLSearchParams(
      location.hash.split('?')[1] ?? ''
    ).get('forced') === 'true'

    container.innerHTML = _buildHTML(forced)

    // ── Show/hide toggles ─────────────────────────────────────────────────────
    for (const [btnId, inputId] of [
      ['cp-toggle-current', 'cp-current'],
      ['cp-toggle-new',     'cp-new'],
      ['cp-toggle-confirm', 'cp-confirm'],
    ] as const) {
      container.querySelector<HTMLButtonElement>(`#${btnId}`)?.addEventListener('click', function () {
        _toggleVis(container, inputId, this as HTMLButtonElement)
      })
    }

    // ── Strength meter ────────────────────────────────────────────────────────
    container.querySelector('#cp-new')?.addEventListener('input', e => {
      _scorePassword(container, (e.target as HTMLInputElement).value)
    })

    // ── Clear errors on re-type ───────────────────────────────────────────────
    ;['cp-current', 'cp-new', 'cp-confirm'].forEach(id => {
      container.querySelector(`#${id}`)?.addEventListener('input', () => _clearErrs(container))
    })

    // ── Back button ───────────────────────────────────────────────────────────
    container.querySelector('#cp-back')?.addEventListener('click', () => history.back())

    // ── Submit ────────────────────────────────────────────────────────────────
    container.querySelector('#cp-submit')?.addEventListener('click', () => _handleSubmit(container, forced))

    // Forced mode: lock out sidebar/toolbar navigation
    if (forced) {
      document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
        (a as HTMLAnchorElement).style.pointerEvents = 'none'
      })
    }
  },

  destroy() {
    document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
      (a as HTMLAnchorElement).style.pointerEvents = ''
    })
  },
}

// ── Submit handler ────────────────────────────────────────────────────────────
async function _handleSubmit(container: HTMLElement, forced: boolean) {
  _clearErrs(container)

  const currentPassword = (container.querySelector('#cp-current') as HTMLInputElement).value
  const newPassword     = (container.querySelector('#cp-new')     as HTMLInputElement).value
  const confirmPassword = (container.querySelector('#cp-confirm') as HTMLInputElement).value

  // ── Inline field validation ───────────────────────────────────────────────
  let valid = true
  if (!currentPassword) {
    _showErr(container, 'cp-err-current', 'cp-current', 'Current password is required.')
    valid = false
  }

  const cpResult = ChangePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword })
  if (!cpResult.success) {
    const msg = cpResult.error.errors[0]?.message ?? 'Validation failed'
    // Route the zod error to the right field
    const path = cpResult.error.errors[0]?.path[0]
    if (path === 'newPassword') {
      _showErr(container, 'cp-err-new', 'cp-new', msg)
    } else if (path === 'confirmPassword') {
      _showErr(container, 'cp-err-confirm', 'cp-confirm', msg)
    } else {
      Toast.error(msg)
    }
    valid = false
  }

  if (!valid) return

  // ── Loading state ─────────────────────────────────────────────────────────
  const btn = container.querySelector<HTMLButtonElement>('#cp-submit')!
  btn.disabled = true
  btn.innerHTML = `${_spinIcon()} Updating…`

  // ── Re-authenticate ───────────────────────────────────────────────────────
  const user       = getCurrentUser()!
  const identifier = user.email
    ? { email: user.email,  password: currentPassword }
    : { phone: user.phone!, password: currentPassword }

  const { error: reAuthError } = await supabase.auth.signInWithPassword(identifier)
  if (reAuthError) {
    _showErr(container, 'cp-err-current', 'cp-current', 'Current password is incorrect.')
    btn.disabled = false
    btn.innerHTML = `${_lockIcon()} Set password`
    return
  }

  // ── Update password ───────────────────────────────────────────────────────
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    Toast.error('Failed to update password. Please try again.')
    btn.disabled = false
    btn.innerHTML = `${_lockIcon()} Set password`
    return
  }

  // ── Clear must_change_password flag ──────────────────────────────────────
  await (supabase as any).rpc('clear_must_change_password')

  // ── Refresh user + success state ──────────────────────────────────────────
  await loadCurrentUser()

  btn.disabled = false
  btn.className = 'cp-btn cp-success'
  btn.innerHTML = `${_checkIcon()} Password updated`

  setTimeout(() => {
    if (forced) {
      navigate(getFirstModuleRoute())
    } else {
      Toast.success('Password changed successfully.')
      navigate('/settings')
    }
  }, 1200)
}

export default ChangePassword
