// src/modules/settings/pages/panels/SecurityPanel.ts

import type { SettingsContext } from '../utils/settingsTypes';

const ALL_HISTORY = [
  { ok: true,  txt: 'Chrome · Accra, GH · Today 9:41 AM' },
  { ok: true,  txt: 'Safari iPhone · Accra, GH · Today 7:13 AM' },
  { ok: false, txt: 'Unknown · Lagos, NG · Yesterday 11:52 PM' },
  { ok: true,  txt: 'Firefox · Kumasi, GH · Yesterday 8:30 AM' },
  { ok: true,  txt: 'Chrome · Accra, GH · May 20, 2:15 PM' },
  { ok: true,  txt: 'Safari iPhone · Accra, GH · May 19, 9:00 AM' },
  { ok: false, txt: 'Chrome · Unknown · May 18, 3:44 AM' },
  { ok: true,  txt: 'Chrome · Accra, GH · May 17, 11:22 AM' },
  { ok: true,  txt: 'Firefox · Accra, GH · May 16, 4:05 PM' },
  { ok: true,  txt: 'Safari iPhone · Accra, GH · May 15, 8:50 AM' },
];

export function securityPanelHTML(): string {
  return `
    <section class="settings-panel" id="s-panel-security">
      <p class="settings-sec">Two-factor authentication</p>
      <div class="settings-row">
        <span class="settings-lbl">Authenticator app<small>Adds a second layer of security to your account.</small></span>
        <div class="settings-field-r">
          <span class="settings-badge settings-badge-yellow" id="s-tfa-badge">Not enabled</span>
          <button class="btn btn-ghost btn-sm" id="s-tfa-btn">Enable</button>
        </div>
      </div>

      <p class="settings-sec">Active sessions</p>
      <div id="s-sessions">
        <div class="settings-session-card" id="s-sess1">
          <div class="settings-session-icon"><i class="bi bi-laptop"></i></div>
          <div class="settings-session-info">
            <div class="settings-session-name">Chrome on macOS <span class="settings-badge settings-badge-green" style="font-size: var(--text-xs)">Current</span></div>
            <div class="settings-session-meta">Accra, GH · Active now</div>
          </div>
        </div>
        <div class="settings-session-card" id="s-sess2">
          <div class="settings-session-icon"><i class="bi bi-phone"></i></div>
          <div class="settings-session-info">
            <div class="settings-session-name">Safari on iPhone</div>
            <div class="settings-session-meta">Accra, GH · 2 hours ago</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-revoke="s-sess2">Revoke</button>
        </div>
        <div class="settings-session-card" id="s-sess3">
          <div class="settings-session-icon"><i class="bi bi-display"></i></div>
          <div class="settings-session-info">
            <div class="settings-session-name">Firefox on Windows</div>
            <div class="settings-session-meta">Kumasi, GH · Yesterday</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-revoke="s-sess3">Revoke</button>
        </div>
      </div>
      <div style="margin-top:var(--sp-md)">
        <button class="btn btn-warning btn-sm" id="s-revoke-all">
          <i class="bi bi-box-arrow-right"></i> Sign out all other sessions
        </button>
      </div>

      <p class="settings-sec">Login history</p>
      <div class="settings-history-list" id="s-history-list"></div>

      <p class="settings-sec">Data &amp; privacy</p>
      <div class="settings-row">
        <span class="settings-lbl">Export my data<small>Receive a full export via email within 24 hours.</small></span>
        <div class="settings-field-r">
          <button class="btn btn-ghost btn-sm" id="s-export-btn">
            <i class="bi bi-download"></i> Request export
          </button>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Deactivate account<small>Your account will be hidden. You can reactivate by signing in again.</small></span>
        <div class="settings-field-r">
          <div class="settings-danger-card">
            <div class="d-title">Danger zone</div>
            <p>This will immediately deactivate your account and sign you out. All data is retained and you can reactivate by contacting an administrator.</p>
            <button class="btn btn-danger btn-sm" id="s-deactivate-btn">
              <i class="bi bi-trash3"></i> Deactivate account
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindSecurityPanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;
  let tfaEnabled       = false;
  let lastExport: number | null = null;
  let deactivateReady  = false;
  let deactivateIv: ReturnType<typeof setInterval> | null = null;
  let historyShown     = 4;

  // History
  function renderHistory(): void {
    const list = el.querySelector('#s-history-list')!;
    list.innerHTML = ALL_HISTORY.slice(0, historyShown).map(h => `
      <div class="settings-history-item">
        <i class="bi ${h.ok ? 'bi-check-circle' : 'bi-x-circle'}" style="color:${h.ok ? 'var(--caci-success)' : 'var(--caci-red)'}"></i>
        <span style="flex:1">${h.txt}${!h.ok ? ' <span class="settings-badge settings-badge-red" style="font-size: var(--text-xs);margin-left:4px">Failed</span>' : ''}</span>
      </div>`).join('');
    if (historyShown < ALL_HISTORY.length) {
      list.innerHTML += `<button class="settings-show-more-btn" id="s-show-more">
        <i class="bi bi-chevron-down"></i> Show more (${ALL_HISTORY.length - historyShown} remaining)
      </button>`;
      el.querySelector('#s-show-more')?.addEventListener('click', () => {
        historyShown = Math.min(historyShown + 6, ALL_HISTORY.length);
        renderHistory();
      });
    }
  }
  renderHistory();

  // 2FA
  el.querySelector('#s-tfa-btn')?.addEventListener('click', () => {
    tfaEnabled = !tfaEnabled;
    el.querySelector('#s-tfa-badge')!.className  = `settings-badge ${tfaEnabled ? 'settings-badge-green' : 'settings-badge-yellow'}`;
    el.querySelector('#s-tfa-badge')!.textContent = tfaEnabled ? 'Enabled' : 'Not enabled';
    el.querySelector('#s-tfa-btn')!.textContent   = tfaEnabled ? 'Disable' : 'Enable';
    toast(tfaEnabled ? '2FA enabled' : '2FA disabled');
  });

  // Sessions
  el.querySelectorAll<HTMLElement>('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = el.querySelector<HTMLElement>(`#${btn.dataset['revoke']}`);
      if (card) { card.style.opacity = '0'; card.style.transition = 'opacity .3s'; setTimeout(() => card.remove(), 300); }
      toast('Session revoked');
    });
  });
  el.querySelector('#s-revoke-all')?.addEventListener('click', () => {
    ['s-sess2','s-sess3'].forEach(id => {
      const card = el.querySelector<HTMLElement>(`#${id}`);
      if (card) { card.style.opacity = '0'; card.style.transition = 'opacity .3s'; setTimeout(() => card.remove(), 300); }
    });
    toast('All other sessions signed out');
  });

  // Export
  el.querySelector('#s-export-btn')?.addEventListener('click', () => {
    const now = Date.now();
    if (lastExport && (now - lastExport) < 86400000) { toast('Export already requested — check your email', 'warn'); return; }
    lastExport = now;
    const btn = el.querySelector<HTMLButtonElement>('#s-export-btn')!;
    btn.textContent = '⏳ Requested';
    btn.disabled = true;
    toast('Export requested — email within 24 hours');
  });

  // Deactivation countdown
  el.querySelector('#s-deactivate-btn')?.addEventListener('click', () => {
    if (deactivateReady) {
      toast('Deactivation request submitted');
      const btn = el.querySelector<HTMLButtonElement>('#s-deactivate-btn')!;
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-check2"></i> Request submitted';
      return;
    }
    if (deactivateIv) return;
    let count = 10;
    const btn = el.querySelector<HTMLButtonElement>('#s-deactivate-btn')!;
    btn.innerHTML = `<i class="bi bi-clock"></i> Confirm in ${count}s`;
    btn.disabled = true;
    deactivateIv = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(deactivateIv!); deactivateIv = null; deactivateReady = true;
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-trash3"></i> Confirm deactivation';
        btn.classList.add('btn-danger');
      } else {
        btn.innerHTML = `<i class="bi bi-clock"></i> Confirm in ${count}s`;
      }
    }, 1000);
  });

  // Return cleanup for deactivation timer if needed
  return;
}