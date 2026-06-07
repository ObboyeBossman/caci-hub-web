// src/modules/settings/pages/SettingsOverlay.ts

import { getCurrentUser }  from '@core/auth';
import { formatRole } from '../../../shared/utils/format';
import { makeToast }       from './utils/settingsToast';
import { profilePanelHTML, profilePanelSkeleton, bindProfilePanel, onPwdStrengthInput } from './panels/ProfilePanel';
import { appearancePanelHTML, bindAppearancePanel, syncAppearancePanel } from './panels/AppearancePanel';
import { localePanelHTML, bindLocalePanel }                       from './panels/LocalePanel';
import { notificationsPanelHTML, bindNotificationsPanel }         from './panels/NotificationsPanel';
import { securityPanelHTML, bindSecurityPanel }                   from './panels/SecurityPanel';
import { accountPanelHTML, bindAccountPanel }                     from './panels/AccountPanel';
import { getOwnMemberProfile }                                    from '../../membership/repository';

const TABS = ['profile','account','appearance','locale','notifications','security'] as const;
type Tab = typeof TABS[number];

export class SettingsOverlay {
  private static _instance: SettingsOverlay | null = null;
  private _el: HTMLElement | null = null;
  private _escHandler: ((e: KeyboardEvent) => void) | null = null;

  static open(): void {
    if (this._instance) return;
    this._instance = new SettingsOverlay();
    this._instance._render();
  }

  static close(): void {
    if (!this._instance) return;
    this._instance._destroy();
    this._instance = null;
  }

  private async _render(): Promise<void> {
    const user        = getCurrentUser();
    const displayName = user?.fullName ?? 'User';
    const email       = user?.email    ?? '';
    const role        = (() => {
      if (!user) return '';
      if (user.role === 'admin') return 'Admin';
      return user.assemblyRoleName ? formatRole(user.assemblyRoleName) : '';
    })();
    const initials    = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    this._el = document.createElement('div');
    this._el.className = 'settings-overlay';
    this._el.setAttribute('role', 'dialog');
    this._el.setAttribute('aria-modal', 'true');
    this._el.setAttribute('aria-label', 'Settings');

    this._el.innerHTML = `
      <div class="settings-toast" id="s-toast"></div>

      <!-- Password modal -->
      <div class="settings-pwd-overlay" id="s-pwd-overlay">
        <div class="settings-pwd-modal">
          <h3>Change password</h3>
          <div class="settings-pwd-field">
            <label>Current password</label>
            <input type="password" id="s-pwd-current" placeholder="Enter current password"/>
          </div>
          <div class="settings-pwd-field">
            <label>New password</label>
            <input type="password" id="s-pwd-new" placeholder="At least 8 characters"/>
            <div class="settings-strength-bar">
              <div class="settings-strength-seg" id="s-s1"></div>
              <div class="settings-strength-seg" id="s-s2"></div>
              <div class="settings-strength-seg" id="s-s3"></div>
              <div class="settings-strength-seg" id="s-s4"></div>
            </div>
            <div class="settings-strength-label" id="s-strength-lbl"></div>
          </div>
          <div class="settings-pwd-field">
            <label>Confirm new password</label>
            <input type="password" id="s-pwd-confirm" placeholder="Repeat new password"/>
          </div>
          <div class="settings-pwd-actions">
            <button class="btn btn-ghost" id="s-pwd-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="s-pwd-save-btn">Update password</button>
          </div>
        </div>
      </div>

      <div class="settings-modal">
        <div class="settings-head">
          <span class="settings-head-title">Settings</span>
          <div class="settings-head-actions">
            <button class="settings-icon-btn" id="s-close-btn" title="Close">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div class="settings-offline-banner" id="s-offline-banner">
          <i class="bi bi-wifi-off"></i>
          <span>You're offline — changes will sync when you reconnect.</span>
        </div>

        <div class="settings-tab-strip">
          ${TABS.map((t, i) => {
            const isDisabled = !['profile', 'account', 'appearance'].includes(t);
            return `
              <button class="settings-tab-item ${i === 0 ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" data-tab="${t}">
                <i class="bi bi-${_tabIcon(t)}"></i> ${_tabLabel(t)}
                ${isDisabled ? '<span class="soon-badge">SOON</span>' : ''}
              </button>`;
          }).join('')}
        </div>
 
        <div class="settings-body-split">
          <nav class="settings-sidebar scrollbar-hide">
            <div class="settings-search-box">
              <i class="bi bi-search"></i>
              <input type="text" placeholder="Search settings" id="s-nav-search"/>
            </div>
            <div class="settings-nav-sep">Account</div>
            ${['profile', 'account', 'appearance', 'locale'].map((t, i) => {
              const isDisabled = !['profile', 'account', 'appearance'].includes(t);
              return `
                <button class="settings-nav-btn ${i === 0 ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" data-tab="${t}">
                  <i class="bi bi-${_tabIcon(t as Tab)}"></i> ${_tabLabel(t as Tab)}
                  ${isDisabled ? '<span class="soon-badge">SOON</span>' : ''}
                </button>`;
            }).join('')}
            <div class="settings-nav-sep">Preferences</div>
            ${['notifications', 'security'].map(t => {
              const isDisabled = true;
              return `
                <button class="settings-nav-btn disabled" data-tab="${t}">
                  <i class="bi bi-${_tabIcon(t as Tab)}"></i> ${_tabLabel(t as Tab)}
                  <span class="soon-badge">SOON</span>
                </button>`;
            }).join('')}
            <div class="settings-nav-spacer"></div>
          </nav>
 
          <div class="settings-content scrollbar-hide">
            ${profilePanelSkeleton()}
            ${accountPanelHTML()}
            ${appearancePanelHTML()}
            ${localePanelHTML()}
            ${notificationsPanelHTML(true)}
            ${securityPanelHTML()}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);
    this._bindShellEvents();

    // Delegate to panels
    const ctx = { el: this._el, toast: makeToast(this._el) };
    bindProfilePanel(ctx);
    bindAccountPanel(ctx);
    bindAppearancePanel(ctx);
    bindLocalePanel(ctx);
    bindNotificationsPanel(ctx, true);
    bindSecurityPanel(ctx);
    syncAppearancePanel(this._el);

    // Wire password strength (no inline handlers needed)
    this._el.querySelector('#s-pwd-new')?.addEventListener('input', (e) => {
      onPwdStrengthInput((e.target as HTMLInputElement).value, this._el!);
    });

    // ── Async: fetch member profile and hydrate the profile panel ─────────────
    const member = await getOwnMemberProfile();
    const profileSlot = this._el?.querySelector('#s-panel-profile')?.closest('.settings-panel') ??
                        this._el?.querySelector('#s-panel-profile');
    const profileContent = this._el?.querySelector('#s-panel-profile');
    if (profileContent && this._el) {
      // Replace skeleton with real panel — swap only the active panel section
      const panelParent = profileContent.parentElement!;
      const wasActive   = profileContent.classList.contains('active');
      const realHTML    = document.createElement('div');
      realHTML.innerHTML = profilePanelHTML(displayName, email, role, initials, member ?? undefined);
      const newPanel = realHTML.querySelector('#s-panel-profile') as HTMLElement | null;
      if (newPanel) {
        if (wasActive) newPanel.classList.add('active');
        panelParent.replaceChild(newPanel, profileContent);
        // Re-bind profile panel events on the fresh DOM node
        bindProfilePanel(ctx);
      }
    }
  }

  private _bindShellEvents(): void {
    if (!this._el) return;
    const el = this._el;
    const toast = makeToast(el);

    el.querySelector('#s-close-btn')?.addEventListener('click', () => SettingsOverlay.close());
    el.addEventListener('click', (e) => { if (e.target === el) SettingsOverlay.close(); });

    this._escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') SettingsOverlay.close(); };
    document.addEventListener('keydown', this._escHandler);

    el.querySelectorAll<HTMLElement>('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) {
          toast(`${_tabLabel(btn.dataset['tab'] as Tab)} is coming soon!`, 'warn');
          return;
        }
        this._switchTab(btn.dataset['tab'] as Tab);
      });
    });

    el.querySelector('#s-nav-search')?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.toLowerCase();
      el.querySelectorAll<HTMLElement>('.settings-nav-btn').forEach(b => {
        b.style.display = b.textContent!.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    const banner = el.querySelector<HTMLElement>('#s-offline-banner')!;
    window.addEventListener('online',  () => banner.classList.remove('show'));
    window.addEventListener('offline', () => banner.classList.add('show'));
    if (!navigator.onLine) banner.classList.add('show');
  }

  private _switchTab(tabId: Tab): void {
    if (!this._el) return;
    this._el.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
    this._el.querySelectorAll(`[data-tab="${tabId}"]`).forEach(b => b.classList.add('active'));
    this._el.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    this._el.querySelector(`#s-panel-${tabId}`)?.classList.add('active');
  }

  private _destroy(): void {
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    this._el?.remove();
    this._el = null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _tabIcon(tab: Tab): string {
  const map: Record<Tab, string> = {
    profile: 'person-circle', account: 'shield-lock',
    appearance: 'palette',    locale: 'globe',
    notifications: 'bell',    security: 'shield-check',
  };
  return map[tab];
}

function _tabLabel(tab: Tab): string {
  const map: Record<Tab, string> = {
    profile: 'Profile',        account: 'Account',
    appearance: 'Appearance',  locale: 'Language & Region',
    notifications: 'Notifications', security: 'Privacy & Security',
  };
  return map[tab];
}