// src/modules/admin/tabs/SettingsTab.ts
// Settings tab — scaffold with live assembly data preview.
// Future: Edit assembly name, address, digital_address,
// default_member_password (via Edge Function), is_active toggle.

import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import { getCurrentUser } from '@core/auth'
import { getAssembly, setAssemblyDefaultPassword } from '../repository'
import { injectWidgetCSS, showToast } from '../widgets/adminWidgets'

const SETTINGS_CSS = /* css */`
.set-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-lg);
}
.set-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-default);
  background: rgba(255,255,255,0.015);
}
.set-card-header i { font-size: 18px; color: var(--caci-blue-light); }
.set-card-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.set-card-sub   { font-size: 11px; color: var(--text-secondary); margin: 2px 0 0; }
.set-card-body  { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.set-field {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--space-md); flex-wrap: wrap;
}
.set-field-label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
  min-width: 140px;
}
.set-field-value {
  flex: 1; font-size: 13px; color: var(--text-primary);
  padding: 8px 12px; background: var(--bg-page);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  font-family: var(--font-sans); min-width: 200px;
}
.set-field-placeholder {
  flex: 1; font-size: 13px; color: var(--text-muted); font-style: italic;
}
.set-readonly {
  flex: 1; font-size: 13px; color: var(--text-primary);
  padding: 8px 12px; background: transparent;
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  border-radius: var(--radius-sm); min-width: 200px;
}
.set-pwd-section {
  background: rgba(210,153,34,0.05);
  border: 1px solid rgba(210,153,34,0.15);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
}
`

let _settingsCSSInjected = false

export class SettingsTab implements WorkspaceTab {
    readonly id = 'settings'
    readonly label = 'Settings'
    readonly icon = 'gear-fill'
    readonly permission = 'admin.settings.view'

    private _container: HTMLElement | null = null
    private _destroyed = false

    async render(container: HTMLElement): Promise<void> {
        injectWidgetCSS()
        if (!_settingsCSSInjected) {
            _settingsCSSInjected = true
            const s = document.createElement('style')
            s.id = 'set-tab-css'
            s.textContent = SETTINGS_CSS
            document.head.appendChild(s)
        }

        this._container = container
        this._destroyed = false

        const user = getCurrentUser()
        if (!user?.assemblyId) {
            container.innerHTML = `
        <div class="aw-empty" style="padding:60px 20px;">
          <div class="aw-empty-icon-wrap"><i class="bi bi-building-slash"></i></div>
          <p class="aw-empty-title">No assembly linked</p>
          <p class="aw-empty-desc">Your account is not associated with an assembly.</p>
        </div>`
            return
        }

        // Show skeleton while loading
        container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg);">
        ${[1, 2].map(() => `
          <div style="height:160px;background:var(--bg-card);border-radius:var(--radius-lg);
                      border:1px solid var(--border-default);"></div>`).join('')}
      </div>`

        let assembly: any = null
        try {
            assembly = await getAssembly(user.assemblyId)
        } catch (err) {
            container.innerHTML = `
        <div class="aw-empty" style="padding:60px 20px;">
          <div class="aw-empty-icon-wrap"><i class="bi bi-exclamation-circle"></i></div>
          <p class="aw-empty-title">Failed to load settings</p>
          <p class="aw-empty-desc">Could not fetch assembly data. Please try again.</p>
        </div>`
            return
        }

        if (this._destroyed) return

        container.innerHTML = `
      <!-- Assembly Info card -->
      <div class="set-card">
        <div class="set-card-header">
          <i class="bi bi-building"></i>
          <div>
            <p class="set-card-title">Assembly Information</p>
            <p class="set-card-sub">Basic details for this assembly. Contact support to change the assembly code.</p>
          </div>
        </div>
        <div class="set-card-body">
          ${[
                { label: 'Assembly Name', value: assembly?.name ?? '', id: 'set-name', editable: true },
                { label: 'Assembly Code', value: assembly?.assembly_code ?? '', id: 'set-code', editable: false },
                { label: 'Address', value: assembly?.address ?? '', id: 'set-address', editable: true },
                { label: 'Digital Address', value: assembly?.digital_address ?? '', id: 'set-digital', editable: true },
            ].map(f => `
          <div class="set-field">
            <span class="set-field-label">${f.label}</span>
            ${f.editable
                    ? `<input type="text" class="set-field-value" id="${f.id}" value="${f.value ?? ''}" placeholder="Not set">`
                    : `<span class="set-readonly">${f.value || '<em style="color:var(--text-muted);">Not set</em>'}</span>`}
          </div>`).join('')}
          <div style="display:flex;justify-content:flex-end;padding-top:4px;">
            <button class="aw-tbtn aw-tbtn-primary" id="set-save-info" style="height:36px;">
              <i class="bi bi-check2-circle"></i>
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Security card -->
      <div class="set-card">
        <div class="set-card-header">
          <i class="bi bi-shield-lock-fill"></i>
          <div>
            <p class="set-card-title">Security Settings</p>
            <p class="set-card-sub">Default member password is used when provisioning new accounts without an explicit password.</p>
          </div>
        </div>
        <div class="set-card-body">
          <div class="set-pwd-section">
            <div class="set-field" style="margin-bottom:var(--space-sm);">
              <span class="set-field-label">Default Password</span>
              <span class="set-readonly" style="font-family:monospace;letter-spacing:0.1em;">
                ${assembly?.default_member_password
                ? '•'.repeat(Math.min(assembly.default_member_password.length, 12))
                : '<em style="color:var(--text-muted);">Not configured</em>'}
              </span>
            </div>
            <div class="set-field">
              <span class="set-field-label">New Password</span>
              <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:200px;">
                <div style="position:relative;">
                  <input type="password" class="set-field-value" id="set-pwd"
                         placeholder="Min. 8 chars, uppercase, number, symbol" style="padding-right:44px;">
                  <button id="set-pwd-eye" type="button" style="position:absolute;right:12px;top:50%;
                         transform:translateY(-50%);background:none;border:none;cursor:pointer;
                         color:var(--text-muted);display:flex;align-items:center;">
                    <i class="bi bi-eye-fill" style="font-size:15px;"></i>
                  </button>
                </div>
                <p style="font-size:11px;color:var(--text-muted);margin:0;">
                  Requirements: 8+ characters, 1 uppercase, 1 number, 1 special character.
                </p>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:var(--space-sm);">
              <button class="aw-tbtn" id="set-save-pwd"
                      style="background:rgba(210,153,34,0.1);border-color:rgba(210,153,34,0.3);color:#d29922;height:36px;">
                <i class="bi bi-key-fill"></i>
                <span>Update Default Password</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger zone card -->
      <div class="set-card" style="border-color:rgba(198,0,38,0.2);">
        <div class="set-card-header" style="background:rgba(198,0,38,0.04);">
          <i class="bi bi-exclamation-triangle-fill" style="color:var(--caci-red);"></i>
          <div>
            <p class="set-card-title">Danger Zone</p>
            <p class="set-card-sub">These actions affect all members of this assembly.</p>
          </div>
        </div>
        <div class="set-card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md);">
            <div>
              <p style="font-size:13px;font-weight:500;color:var(--text-primary);margin:0 0 3px;">
                Assembly Active Status
              </p>
              <p style="font-size:12px;color:var(--text-secondary);margin:0;">
                Deactivating this assembly will prevent all members from logging in.
              </p>
            </div>
            <button class="aw-tbtn aw-tbtn-danger" id="set-toggle-active" style="flex-shrink:0;">
              <i class="bi bi-slash-circle"></i>
              <span>${assembly?.is_active !== false ? 'Deactivate Assembly' : 'Reactivate Assembly'}</span>
            </button>
          </div>
        </div>
      </div>`

        // Password eye toggle
        container.querySelector('#set-pwd-eye')?.addEventListener('click', (e) => {
            const inp = container.querySelector<HTMLInputElement>('#set-pwd')!
            const icon = (e.currentTarget as HTMLElement).querySelector('i')!
            inp.type = inp.type === 'password' ? 'text' : 'password'
            icon.className = `bi bi-eye${inp.type === 'password' ? '-fill' : '-slash-fill'}`
        })

        // Save info (toast only — full impl would call updateAssembly Edge Function)
        container.querySelector('#set-save-info')?.addEventListener('click', () => {
            showToast('Assembly settings saved', 'success')
        })

        // Save password
        container.querySelector('#set-save-pwd')?.addEventListener('click', async () => {
            const pwd = container.querySelector<HTMLInputElement>('#set-pwd')?.value ?? ''
            const btn = container.querySelector<HTMLButtonElement>('#set-save-pwd')!

            if (pwd.length < 8) {
                showToast('Password must be at least 8 characters', 'warning')
                return
            }

            btn.disabled = true
            btn.innerHTML = `<span class="aw-spinner"></span> Updating…`

            try {
                await setAssemblyDefaultPassword(pwd)
                container.querySelector<HTMLInputElement>('#set-pwd')!.value = ''
                showToast('Default password updated', 'success')
            } catch (err: any) {
                showToast(err?.message ?? 'Update failed', 'danger')
            } finally {
                btn.disabled = false
                btn.innerHTML = `<i class="bi bi-key-fill"></i> Update Default Password`
            }
        })

        // Danger zone
        container.querySelector('#set-toggle-active')?.addEventListener('click', () => {
            showToast('Assembly status change requires confirmation — feature coming soon', 'info')
        })
    }

    destroy(): void {
        this._destroyed = true
        this._container = null
    }
}