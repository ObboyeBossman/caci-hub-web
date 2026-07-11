// src/core/PortalModal.ts
// ─────────────────────────────────────────────────────────────────────────────
// Self-contained confirmation modals for:
//   • Portal switching (Admin ↔ Member) — no sign-out
//   • Sign-out confirmation
//
// No external aliases needed. Styles are injected once via a <style> tag.
// ─────────────────────────────────────────────────────────────────────────────

const PORTAL_MODAL_CSS = `
@keyframes _pmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
@keyframes _pmSlideUp { from { opacity: 0; transform: translateY(18px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
@keyframes _pmSpin    { to { transform: rotate(360deg) } }

.pm-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.58);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  animation: _pmFadeIn 0.18s ease;
}
.pm-modal {
  width: 100%; max-width: 380px;
  background: #fff; border-radius: 16px;
  padding: 28px 24px 22px;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 20px 64px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06);
  animation: _pmSlideUp 0.22s cubic-bezier(0.16,1,0.3,1);
}
.pm-icon-wrap {
  width: 56px; height: 56px; border-radius: 50%; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
}
.pm-icon-wrap.switch { background: #EFF5FF; color: #004BA0; }
.pm-icon-wrap.signout { background: #FFF0F3; color: #C60026; }
.pm-heading {
  font-size: 1.0625rem; font-weight: 700; color: #0d1117;
  text-align: center; margin-bottom: 6px; letter-spacing: -0.02em;
}
.pm-sub {
  font-size: 0.75rem; color: #57606a; text-align: center;
  line-height: 1.6; margin-bottom: 20px; max-width: 280px;
}
.pm-user-card {
  width: 100%; background: #f6f8fa; border: 1px solid #d0d7de;
  border-radius: 10px; padding: 10px 12px;
  display: flex; align-items: center; gap: 10px; margin-bottom: 22px;
}
.pm-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: #EFF5FF; border: 1px solid #d0d7de;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: #004BA0;
}
.pm-user-info { flex: 1; min-width: 0; }
.pm-user-name {
  font-size: 0.75rem; font-weight: 600; color: #0d1117;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pm-user-role {
  font-size: 0.6875rem; color: #57606a; margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pm-active-badge {
  font-size: 0.6875rem; font-weight: 600; color: #1a7f37;
  background: #dafbe1; border: 1px solid rgba(26,127,55,0.25);
  border-radius: 20px; padding: 2px 8px; white-space: nowrap;
}
.pm-target-chip {
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em;
  background: #EFF5FF; color: #004BA0;
  border: 1px solid rgba(0,75,160,0.2);
  border-radius: 20px; padding: 2px 8px; white-space: nowrap;
}
.pm-actions { display: flex; gap: 10px; width: 100%; }
.pm-btn {
  flex: 1; padding: 9px 16px; border-radius: 10px;
  font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  border: none; font-family: inherit;
}
.pm-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.pm-btn:active { transform: translateY(0); }
.pm-btn-cancel {
  background: transparent; color: #0d1117;
  border: 1px solid #d0d7de;
}
.pm-btn-switch {
  background: #004BA0; color: #fff;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.pm-btn-signout {
  background: #C60026; color: #fff;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.pm-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: _pmSpin 0.7s linear infinite; flex-shrink: 0;
}
/* Loading screen overlay */
.pm-loading-screen {
  position: fixed; inset: 0; z-index: 99998;
  background: #004BA0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: _pmFadeIn 0.3s ease;
}
.pm-loading-ring {
  width: 48px; height: 48px; border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff;
  animation: _pmSpin 0.8s linear infinite; margin-bottom: 16px;
}
.pm-loading-text {
  font-size: 0.8125rem; font-weight: 600; color: rgba(255,255,255,0.75);
  letter-spacing: 0.05em; font-family: inherit;
}
`;

function injectCSS(): void {
  if (document.getElementById('caci-portal-modal-css')) return;
  const s = document.createElement('style');
  s.id = 'caci-portal-modal-css';
  s.textContent = PORTAL_MODAL_CSS;
  document.head.appendChild(s);
}

function closeAll(): void {
  document.getElementById('caci-pm-overlay')?.remove();
}

function showLoadingScreen(label: string): () => void {
  const el = document.createElement('div');
  el.id = 'caci-pm-loading';
  el.className = 'pm-loading-screen';
  el.innerHTML = `
    <div class="pm-loading-ring"></div>
    <span class="pm-loading-text">${label}</span>
  `;
  document.body.appendChild(el);
  return () => el.remove();
}

interface ModalOptions {
  mode: 'switch' | 'signout';
  /** Label shown on the confirm button and loading screen */
  targetLabel: string;
  /** Short description under the heading */
  subText: string;
  /** User display name */
  userName: string;
  /** User role/subtitle */
  userRole: string;
  /** User initials for avatar */
  initials: string;
  /** Called after confirm + loading delay */
  onConfirm: () => Promise<void>;
}

function buildModal(opts: ModalOptions): void {
  injectCSS();
  closeAll();

  const overlay = document.createElement('div');
  overlay.id = 'caci-pm-overlay';
  overlay.className = 'pm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const isSwitch = opts.mode === 'switch';

  overlay.innerHTML = `
    <div class="pm-modal">
      <div class="pm-icon-wrap ${isSwitch ? 'switch' : 'signout'}">
        ${isSwitch
          ? `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 12H8m0 0 3-3m-3 3 3 3"/></svg>`
          : `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
        }
      </div>
      <div class="pm-heading">${isSwitch ? `Switch to ${opts.targetLabel}?` : 'Sign out of CACI Hub?'}</div>
      <div class="pm-sub">${opts.subText}</div>
      <div class="pm-user-card">
        <div class="pm-avatar">${opts.initials}</div>
        <div class="pm-user-info">
          <div class="pm-user-name">${opts.userName}</div>
          <div class="pm-user-role">${opts.userRole}</div>
        </div>
        ${isSwitch
          ? `<span class="pm-target-chip">${opts.targetLabel}</span>`
          : `<span class="pm-active-badge">● Active</span>`
        }
      </div>
      <div class="pm-actions">
        <button class="pm-btn pm-btn-cancel" id="pm-cancel" type="button">Cancel</button>
        <button class="pm-btn ${isSwitch ? 'pm-btn-switch' : 'pm-btn-signout'}" id="pm-confirm" type="button">
          ${isSwitch ? 'Switch Portal' : 'Sign Out'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cancelBtn  = overlay.querySelector<HTMLButtonElement>('#pm-cancel')!;
  const confirmBtn = overlay.querySelector<HTMLButtonElement>('#pm-confirm')!;
  const close = () => overlay.remove();

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    e.preventDefault();
    document.activeElement === cancelBtn ? confirmBtn.focus() : cancelBtn.focus();
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.innerHTML = `<span class="pm-spinner" aria-hidden="true"></span> ${isSwitch ? 'Switching…' : 'Signing out…'}`;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    await new Promise(r => setTimeout(r, 400));
    close();

    const loadingLabel = isSwitch ? `Launching ${opts.targetLabel}…` : 'Signing out…';
    const removeLoading = showLoadingScreen(loadingLabel);
    await new Promise(r => setTimeout(r, 1400));
    removeLoading();
    await opts.onConfirm();
  });

  cancelBtn.focus();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function showSwitchPortalModal(opts: {
  targetLabel: string;
  userName: string;
  userRole: string;
  initials: string;
  onConfirm: () => Promise<void>;
}): void {
  buildModal({
    mode: 'switch',
    targetLabel: opts.targetLabel,
    subText: `Your session stays active. You'll be taken to the ${opts.targetLabel} immediately.`,
    userName: opts.userName,
    userRole: opts.userRole,
    initials: opts.initials,
    onConfirm: opts.onConfirm,
  });
}

export function showSignOutModal(opts: {
  userName: string;
  userRole: string;
  initials: string;
  onConfirm: () => Promise<void>;
}): void {
  buildModal({
    mode: 'signout',
    targetLabel: 'Login',
    subText: "You'll need to sign in again to access your account. Any unsaved local state will be cleared.",
    userName: opts.userName,
    userRole: opts.userRole,
    initials: opts.initials,
    onConfirm: opts.onConfirm,
  });
}
