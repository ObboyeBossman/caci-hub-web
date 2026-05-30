// src/shared/components/SignOutConfirm.ts
//
// Shared sign-out confirmation dialog — used by Toolbar profile popup
// and the Settings > Account panel.
//
// Usage:
//   import { showSignOutConfirm } from '@shared/components/SignOutConfirm';
//   showSignOutConfirm();

import { getCurrentUser }  from '@core/auth';
import { navigate }        from '@core/router';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Shows the confirmation modal before signing the user out.
 * The dialog includes the user's name, initials, and assembly context.
 * On confirmation it calls _performSignOut() which clears auth state
 * and navigates to /login.
 */
export function showSignOutConfirm(): void {
  // Remove any existing instance
  document.getElementById('lc-overlay')?.remove();

  const user     = getCurrentUser();
  const initials = user
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const fullName = user?.fullName ?? 'User';

  // Assembly name — try session storage first, then localStorage
  const sessionAsm = sessionStorage.getItem('selectedAssembly');
  const localAsm   = localStorage.getItem('caci:selected_assembly');
  let asmName      = 'CACI Hub';
  try {
    if (sessionAsm) asmName = (JSON.parse(sessionAsm) as { name: string }).name;
    else if (localAsm) asmName = (JSON.parse(localAsm) as { name: string }).name;
  } catch { /* ignore */ }

  const overlay = document.createElement('div');
  overlay.id = 'lc-overlay';
  overlay.style.cssText = [
    'position:fixed; inset:0; z-index:99999;',
    'background:rgba(0,0,0,0.6);',
    'display:flex; align-items:center; justify-content:center;',
    'padding:16px;',
    'animation:lcFadeIn 0.2s ease-out;',
  ].join('');

  overlay.innerHTML = `
    <div class="lc-modal">
      <!-- Icon -->
      <div style="
        width:60px; height:60px; border-radius:50%;
        background:var(--bg-page); border:1px solid var(--border-default);
        display:flex; align-items:center; justify-content:center;
        font-size: var(--text-4xl); color:var(--text-secondary); margin-bottom:20px;
      ">
        <i class="bi bi-box-arrow-right"></i>
      </div>

      <!-- Heading -->
      <div style="font-size: var(--text-2xl); font-weight:500; color:var(--text-primary); text-align:center; margin-bottom:6px; letter-spacing:-0.02em;">
        Sign out of CACI Hub?
      </div>
      <div style="font-size: var(--text-base); color:var(--text-secondary); text-align:center; line-height:1.55; margin-bottom:24px; max-width:280px;">
        You'll need to select your assembly and sign in again to access your account.
      </div>

      <!-- User card -->
      <div style="
        width:100%; background:var(--bg-page);
        border:1px solid var(--border-default);
        border-radius:10px; padding:12px 14px;
        display:flex; align-items:center; gap:12px; margin-bottom:24px;
      ">
        <div style="
          width:38px; height:38px; border-radius:50%; flex-shrink:0;
          background:var(--caci-blue-bg); border:1px solid var(--border-default);
          display:flex; align-items:center; justify-content:center;
          font-size: var(--text-base); font-weight:600; color:var(--text-link);
        ">${initials}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-size: var(--text-base); font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${fullName}
          </div>
          <div style="font-size: var(--text-xs); color:var(--text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${asmName}
          </div>
        </div>
        <div style="
          font-size: var(--text-xs); color:var(--text-success);
          background:var(--caci-success-bg, rgba(46,160,67,0.12));
          border:1px solid rgba(46,160,67,0.25);
          border-radius:20px; padding:2px 8px; white-space:nowrap;
        ">● Active</div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:10px; width:100%;">
        <button id="lc-cancel"  class="lc-btn lc-btn-cancel">Cancel</button>
        <button id="lc-confirm" class="lc-btn lc-btn-confirm">Sign out</button>
      </div>
    </div>
  `;


  document.body.appendChild(overlay);

  const cancelBtn  = overlay.querySelector<HTMLButtonElement>('#lc-cancel')!;
  const confirmBtn = overlay.querySelector<HTMLButtonElement>('#lc-confirm')!;

  const close = () => overlay.remove();

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.innerHTML = '<span class="auth-spinner" style="width:14px;height:14px;border-width:2px;margin-right:8px"></span> Signing out…';
    confirmBtn.disabled = true;

    await new Promise(r => setTimeout(r, 600));
    close();
    await _performSignOut();
  });
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function _performSignOut(): Promise<void> {
  try {
    const { supabase }        = await import('@core/supabase');
    const { clearCurrentUser } = await import('@core/auth');
    await supabase.auth.signOut();
    clearCurrentUser();
    navigate('/login');
  } catch (err) {
    console.error('[SignOutConfirm] Sign-out failed', err);
  }
}
