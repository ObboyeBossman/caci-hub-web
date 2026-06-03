// src/shell/SignOutModal.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sign-out confirmation modal — self-contained, no external imports needed
// beyond @core/auth and @core/router.
// ─────────────────────────────────────────────────────────────────────────────

import { getCurrentUser } from '@core/auth'
import { navigate }       from '@core/router'
import { _initials }      from './Sidebar'

const SIGN_OUT_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   SIGN-OUT MODAL
═══════════════════════════════════════════════════════════════════════════ */
@keyframes _soFadeIn   { from { opacity: 0; } to { opacity: 1; } }
@keyframes _soSlideUp  { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes _soSpin     { to { transform: rotate(360deg); } }

.so-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  animation: _soFadeIn 0.18s ease;
}
.so-modal {
  width: 100%; max-width: 380px; background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: 14px;
  padding: 28px 24px 24px;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 16px 60px rgba(0,0,0,0.24);
  animation: _soSlideUp 0.22s cubic-bezier(0.16,1,0.3,1);
}
.so-icon {
  width: 58px; height: 58px; border-radius: 50%;
  background: var(--bg-page); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; color: var(--text-secondary); margin-bottom: 18px;
}
.so-heading {
  font-size: var(--text-2xl); font-weight: 600; color: var(--text-primary);
  text-align: center; margin-bottom: 6px; letter-spacing: -0.02em;
}
.so-sub {
  font-size: var(--text-base); color: var(--text-secondary);
  text-align: center; line-height: 1.6; margin-bottom: 20px; max-width: 270px;
}
.so-user-card {
  width: 100%; background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 11px 13px;
  display: flex; align-items: center; gap: 11px; margin-bottom: 22px;
}
.so-user-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: var(--caci-blue-bg, #EFF5FF); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--text-base); font-weight: 600; color: var(--caci-blue, #004BA0);
  overflow: hidden;
}
.so-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.so-user-info { flex: 1; min-width: 0; }
.so-user-name {
  font-size: var(--text-base); font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.so-user-asm {
  font-size: var(--text-xs); color: var(--text-secondary);
  margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.so-active-badge {
  font-size: var(--text-xs); color: var(--caci-success, #1A7F37);
  background: var(--caci-success-bg, #DAFBE1); border: 1px solid rgba(26,127,55,0.25);
  border-radius: 20px; padding: 2px 8px; white-space: nowrap;
}
.so-actions { display: flex; gap: 10px; width: 100%; }
.so-btn {
  flex: 1; padding: 9px 16px; border-radius: var(--radius-md, 8px);
  font-size: var(--text-base); font-weight: 500; font-family: var(--font-sans);
  cursor: pointer; transition: opacity 0.15s;
}
.so-btn:hover { opacity: 0.85; }
.so-btn-cancel  { background: transparent; color: var(--text-primary); border: 1px solid var(--border-default); }
.so-btn-confirm { background: var(--caci-red, #C60026); color: #fff; border: none; display: flex; align-items: center; justify-content: center; gap: 6px; }
.so-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: _soSpin 0.7s linear infinite; flex-shrink: 0;
}
`

function _injectSignOutCSS(): void {
  if (document.getElementById('caci-signout-css')) return
  const style = document.createElement('style')
  style.id = 'caci-signout-css'
  style.textContent = SIGN_OUT_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export function _showSignOutConfirm(): void {
  _injectSignOutCSS()
  document.getElementById('caci-so-overlay')?.remove()

  const user     = getCurrentUser()
  const initials = user ? _initials(user.fullName) : 'U'
  const fullName = user?.fullName ?? 'User'
  const photoUrl = (user as any)?.avatarUrl ?? (user as any)?.photoUrl ?? ''

  let asmName = 'CACI Hub'
  try {
    const s = sessionStorage.getItem('selectedAssembly') ?? localStorage.getItem('caci:selected_assembly')
    if (s) asmName = (JSON.parse(s) as { name?: string }).name ?? asmName
  } catch { /* ignore */ }

  const overlay = document.createElement('div')
  overlay.id        = 'caci-so-overlay'
  overlay.className = 'so-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Sign out confirmation')

  overlay.innerHTML = /* html */`
    <div class="so-modal">
      <div class="so-icon"><i class="bi bi-box-arrow-right" aria-hidden="true"></i></div>
      <div class="so-heading">Sign out of CACI Hub?</div>
      <div class="so-sub">You'll need to select your assembly and sign in again to access your account.</div>
      <div class="so-user-card">
        <div class="so-user-avatar">
          ${photoUrl ? `<img src="${photoUrl}" alt="${fullName}"/>` : initials}
        </div>
        <div class="so-user-info">
          <div class="so-user-name">${fullName}</div>
          <div class="so-user-asm">${asmName}</div>
        </div>
        <div class="so-active-badge">● Active</div>
      </div>
      <div class="so-actions">
        <button class="so-btn so-btn-cancel"  id="so-cancel"  type="button">Cancel</button>
        <button class="so-btn so-btn-confirm" id="so-confirm" type="button">Sign out</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  const cancel  = overlay.querySelector<HTMLButtonElement>('#so-cancel')!
  const confirm = overlay.querySelector<HTMLButtonElement>('#so-confirm')!
  const close   = () => overlay.remove()

  cancel.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  // Focus trap (Tab cycles between Cancel and Confirm)
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return }
    if (e.key !== 'Tab') return
    e.preventDefault()
    document.activeElement === cancel ? confirm.focus() : cancel.focus()
  })

  confirm.addEventListener('click', async () => {
    confirm.innerHTML = `<span class="so-spinner" aria-hidden="true"></span> Signing out…`
    confirm.disabled  = true
    await new Promise(r => setTimeout(r, 500))
    close()
    await _performSignOut()
  })

  cancel.focus()
}

async function _performSignOut(): Promise<void> {
  try {
    const { supabase: sb }      = await import('@core/supabase')
    const { clearCurrentUser }  = await import('@core/auth')
    await sb.auth.signOut()
    clearCurrentUser()
    try {
      const { SettingsOverlay } = await import('@modules/settings/pages/SettingsOverlay')
      SettingsOverlay.close()
    } catch { /* not loaded */ }
    navigate('/login')
  } catch (err) {
    console.error('[Shell] Sign-out failed', err)
  }
}