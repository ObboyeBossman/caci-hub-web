// src/modules/settings/pages/SettingsOverlay.ts
// Handles the full-screen settings overlay.
// Ported from Prototype/settings-module.html

import { getCurrentUser } from '@core/auth';
import { showToast } from '../../../shell/Shell';

export class SettingsOverlay {
  private static _instance: SettingsOverlay | null = null;
  private _el: HTMLElement | null = null;
  private _activeTab: string = 'profile';

  static open(): void {
    if (this._instance) return;
    this._instance = new SettingsOverlay();
    this._instance.render();
  }

  static close(): void {
    if (!this._instance) return;
    this._instance.destroy();
    this._instance = null;
  }

  private render(): void {
    const user = getCurrentUser();
    const displayName = user?.fullName ?? 'User';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    this._el = document.createElement('div');
    this._el.className = 'settings-overlay';
    this._el.id = 'settings-overlay';
    
    this._el.innerHTML = `
      <div class="settings-modal" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="settings-head">
          <span class="settings-head-title">Settings</span>
          <div class="settings-head-actions">
            <button class="settings-icon-btn" id="settings-close-btn" title="Close"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>

        <!-- Layout -->
        <div class="settings-body-split">
          <!-- Sidebar -->
          <nav class="settings-sidebar scrollbar-hide">
             <div class="settings-search-box">
               <i class="bi bi-search"></i>
               <input type="text" placeholder="Search settings" id="settings-nav-search"/>
             </div>
             <div class="settings-nav-sep">Account</div>
             <button class="settings-nav-btn active" data-tab="profile"><i class="bi bi-person-circle"></i>Profile</button>
             <button class="settings-nav-btn" data-tab="appearance"><i class="bi bi-palette"></i>Appearance</button>
             <button class="settings-nav-btn" data-tab="language"><i class="bi bi-globe"></i>Language & Region</button>
             <div class="settings-nav-sep">Preferences</div>
             <button class="settings-nav-btn" data-tab="notifications"><i class="bi bi-bell"></i>Notifications</button>
             <button class="settings-nav-btn" data-tab="security"><i class="bi bi-shield-lock"></i>Privacy & Security</button>
          </nav>

          <!-- Content Area -->
          <div class="settings-content scrollbar-hide">
            
            <!-- PROFILE PANEL -->
            <section class="settings-panel active" id="settings-panel-profile">
              <p class="settings-sec">Profile photo</p>
              <div class="settings-row">
                <span class="settings-lbl">Avatar<small>JPEG, PNG or WEBP · max 5 MB.</small></span>
                <div class="settings-field-r">
                   <div class="settings-avatar">
                     <span>${initials}</span>
                   </div>
                   <button class="btn btn-sm btn-outline-secondary">Upload</button>
                </div>
              </div>

              <p class="settings-sec">Personal information</p>
              <div class="settings-row">
                <span class="settings-lbl">Display name</span>
                <input type="text" class="form-control form-control-sm" value="${displayName}" style="max-width:300px"/>
              </div>
              <div class="settings-row">
                <span class="settings-lbl">Email address</span>
                <input type="email" class="form-control form-control-sm" value="${user?.email ?? ''}" style="max-width:300px"/>
              </div>

              <div class="settings-save-bar">
                <button class="btn btn-primary btn-sm">Save changes</button>
              </div>
            </section>

            <!-- APPEARANCE PANEL -->
            <section class="settings-panel" id="settings-panel-appearance">
              <p class="settings-sec">Theme</p>
              <div class="settings-row">
                <span class="settings-lbl">Colour scheme</span>
                <div class="settings-seg">
                  <button class="settings-seg-btn" data-theme="light">Light</button>
                  <button class="settings-seg-btn active" data-theme="system">System</button>
                  <button class="settings-seg-btn" data-theme="dark">Dark</button>
                </div>
              </div>
            </section>

            <!-- OTHER PANELS STUBBED FOR NOW -->
            <section class="settings-panel" id="settings-panel-language">
              <p class="settings-sec">Language & Region</p>
              <div class="alert alert-info py-2">Language settings coming soon.</div>
            </section>
            
            <section class="settings-panel" id="settings-panel-notifications">
              <p class="settings-sec">Notifications</p>
              <div class="alert alert-info py-2">Notification preferences coming soon.</div>
            </section>

            <section class="settings-panel" id="settings-panel-security">
              <p class="settings-sec">Privacy & Security</p>
              <div class="alert alert-info py-2">Security settings coming soon.</div>
            </section>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);
    this._bindEvents();
  }

  private _bindEvents(): void {
    if (!this._el) return;

    // Close button
    this._el.querySelector('#settings-close-btn')?.addEventListener('click', () => SettingsOverlay.close());

    // Backdrop click
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) SettingsOverlay.close();
    });

    // Escape key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        SettingsOverlay.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Tab switching
    this._el.querySelectorAll('.settings-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab!;
        this._switchTab(tab);
      });
    });
  }

  private _switchTab(tabId: string): void {
    if (!this._el) return;
    
    // Update nav
    this._el.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
    this._el.querySelector(`.settings-nav-btn[data-tab="${tabId}"]`)?.classList.add('active');

    // Update panels
    this._el.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    this._el.querySelector(`#settings-panel-${tabId}`)?.classList.add('active');
    
    this._activeTab = tabId;
  }

  private destroy(): void {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }
}
