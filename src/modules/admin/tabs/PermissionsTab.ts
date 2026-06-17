// src/modules/admin/tabs/PermissionsTab.ts
// Fully functional Permissions tab.
// Shows the role × permission matrix grouped by module.
// Each role column has toggles per permission; changes are saved per-role.

import {
  listAssemblyRoles,
  setRolePermissions,
  listPermissions,
  type AssemblyRole,
  type Permission,
} from '../repository'
import { getAll as getAllRegistered } from '@core/authorization/permission-registry'
import type { WorkspaceTab } from '@shell/WorkspaceShell'
import {
  injectWidgetCSS,
  showToast,
} from '../widgets/adminWidgets'

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const PERMS_CSS = /* css */`
/* ════════════════════════════════════════════════
   PERMISSIONS TAB  — scoped under .pmt-*
════════════════════════════════════════════════ */

.pmt-wrap {
  display: flex; flex-direction: column; gap: var(--space-lg);
}

/* Top toolbar row */
.pmt-toolbar {
  display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap;
}
.pmt-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  height: 40px; flex: 1; min-width: 200px; max-width: 380px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.pmt-search:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.pmt-search i { font-size: 14px; color: var(--text-muted); }
.pmt-search:focus-within i { color: var(--caci-blue-light); }
.pmt-search input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary); width: 100%;
  font-family: var(--font-sans); caret-color: var(--caci-blue);
}
.pmt-search input::placeholder { color: var(--text-muted); }

.pmt-legend {
  display: flex; align-items: center; gap: var(--space-md);
  flex-wrap: wrap;
}
.pmt-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-secondary);
}
.pmt-legend-dot {
  width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
}

/* Matrix container */
.pmt-matrix-outer {
  overflow-x: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  -webkit-overflow-scrolling: touch;
}
.pmt-matrix {
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  font-family: var(--font-sans);
}

/* Header row */
.pmt-th-permission {
  position: sticky; left: 0; z-index: 3;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  padding: 12px 16px; min-width: 220px; max-width: 260px;
  text-align: left; white-space: nowrap;
}
.pmt-th-role {
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  padding: 8px 16px; min-width: 140px; text-align: center;
  vertical-align: bottom; white-space: nowrap;
}
.pmt-th-role:last-child { border-right: none; }
.pmt-role-col-header {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.pmt-role-name {
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 120px;
}
.pmt-role-perm-count {
  font-size: 10px; color: var(--text-muted);
  background: var(--bg-hover); padding: 1px 7px;
  border-radius: 99px; border: 1px solid var(--border-default);
}
.pmt-save-col-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: var(--radius-sm);
  font-size: 11px; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans); transition: all 0.15s; margin-top: 4px;
  background: rgba(0,75,160,0.08); border: 1px solid rgba(0,75,160,0.25);
  color: var(--caci-blue-light);
}
.pmt-save-col-btn:hover { background: rgba(0,75,160,0.15); }
.pmt-save-col-btn.dirty {
  background: var(--caci-blue); border-color: transparent;
  color: #fff; box-shadow: 0 2px 8px rgba(0,75,160,0.3);
}
.pmt-save-col-btn i { font-size: 11px; }

/* Module section rows */
.pmt-mod-header-row td {
  padding: 8px 16px;
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid var(--border-default);
  border-top: 1px solid var(--border-default);
}
.pmt-mod-header-sticky {
  position: sticky; left: 0; z-index: 2;
  background: rgba(255,255,255,0.025);
}
.pmt-mod-name {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-secondary);
}
.pmt-mod-name i { font-size: 13px; color: var(--caci-blue-light); }

/* Permission rows */
.pmt-perm-row { transition: background 0.12s; }
.pmt-perm-row:hover { background: rgba(255,255,255,0.02); }
.pmt-perm-row:last-child td { border-bottom: none; }
.pmt-td-name {
  position: sticky; left: 0; z-index: 2;
  background: var(--bg-card); border-right: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  padding: 10px 16px;
}
.pmt-perm-row:hover .pmt-td-name { background: rgba(0,75,160,0.025); }
.pmt-perm-label { font-size: 12px; font-weight: 500; color: var(--text-primary); }
.pmt-perm-key   { font-size: 10px; color: var(--text-muted); font-family: monospace; margin: 1px 0 0; }
.pmt-td-toggle {
  border-right: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  padding: 8px 16px; text-align: center; vertical-align: middle;
}
.pmt-td-toggle:last-child { border-right: none; }

/* Toggle button */
.pmt-toggle-btn {
  width: 28px; height: 28px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; border: none;
  font-size: 14px;
}
.pmt-toggle-btn.on {
  background: rgba(34,197,94,0.12); color: #22c55e;
  border: 1px solid rgba(34,197,94,0.3);
}
.pmt-toggle-btn.off {
  background: var(--bg-hover); color: var(--text-muted);
  border: 1px solid var(--border-default);
}
.pmt-toggle-btn.on:hover  { background: rgba(34,197,94,0.2); }
.pmt-toggle-btn.off:hover { background: rgba(255,255,255,0.05); color: var(--text-secondary); }

/* Empty col */
.pmt-empty-col {
  padding: 64px 32px; text-align: center;
  color: var(--text-secondary); font-size: 13px;
}

/* Summary bar */
.pmt-summary {
  display: flex; align-items: center; gap: var(--space-lg); flex-wrap: wrap;
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 12px; color: var(--text-secondary);
}
.pmt-summary strong { color: var(--text-primary); }
`

let _permsCSSInjected = false
function _injectPermsCSS(): void {
  if (_permsCSSInjected) return
  _permsCSSInjected = true
  const s = document.createElement('style')
  s.id = 'pmt-tab-css'
  s.textContent = PERMS_CSS
  document.head.appendChild(s)
}

const MODULE_ICONS: Record<string, string> = {
  admin: 'shield-lock-fill', members: 'people-fill', groups: 'diagram-3-fill',
  finance: 'currency-dollar', services: 'calendar-event-fill',
  pastoral: 'heart-fill', households: 'house-fill', reports: 'bar-chart-fill',
}
function modIcon(name: string): string { return MODULE_ICONS[name.toLowerCase()] ?? 'grid-fill' }

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS TAB
// ─────────────────────────────────────────────────────────────────────────────

export class PermissionsTab implements WorkspaceTab {
  readonly id         = 'permissions'
  readonly label      = 'Permissions'
  readonly icon       = 'key-fill'
  readonly permission = 'admin.permissions.view'

  private _container: HTMLElement | null = null
  private _roles:     AssemblyRole[]     = []
  private _allPerms:  { key: string; label: string; description?: string; moduleName: string; isAssignable: boolean }[] = []
  private _dirty:     Map<string, Set<string>> = new Map() // roleId → Set<permKey> pending save
  private _search     = ''
  private _destroyed  = false

  async render(container: HTMLElement): Promise<void> {
    _injectPermsCSS()
    injectWidgetCSS()
    this._container = container
    this._destroyed = false

    // Skeleton
    container.innerHTML = `
      <div style="height:52px;background:var(--bg-card);border-radius:var(--radius-lg);
                  border:1px solid var(--border-default);margin-bottom:var(--space-lg);"></div>
      <div style="height:480px;background:var(--bg-card);border-radius:var(--radius-lg);
                  border:1px solid var(--border-default);"></div>`

    await this._loadData()
    if (this._destroyed) return
    this._buildUI()
  }

  private async _loadData(): Promise<void> {
    try {
      this._roles = await listAssemblyRoles()
      // Use registered permissions (from permission-registry) as the source of truth.
      // Fall back to DB fetch if registry is empty (edge case: cold start before modules init).
      const registered = getAllRegistered().filter(p => p.isAssignable)
      if (registered.length > 0) {
        this._allPerms = registered.map(p => ({
          key: p.key, label: p.label, description: p.description,
          moduleName: p.moduleName, isAssignable: true,
        }))
      } else {
        // Fallback: fetch from DB
        const dbPerms = await listPermissions()
        this._allPerms = dbPerms.map(p => ({
          key: p.id, label: p.id, moduleName: p.id.split('.')[0] ?? 'other', isAssignable: true,
        }))
      }
      // Initialize dirty map
      this._dirty.clear()
      this._roles.forEach(r => {
        this._dirty.set(r.id, new Set(r.permissions))
      })
    } catch (err) {
      console.error('[PermissionsTab] load error', err)
    }
  }

  private _buildUI(): void {
    if (!this._container || this._destroyed) return
    this._container.innerHTML = ''

    const wrap = document.createElement('div')
    wrap.className = 'pmt-wrap'
    this._container.appendChild(wrap)

    // Toolbar
    const toolbarEl = document.createElement('div')
    toolbarEl.className = 'pmt-toolbar'
    toolbarEl.innerHTML = `
      <div class="pmt-search">
        <i class="bi bi-search"></i>
        <input type="text" placeholder="Filter permissions by name or key…" id="pmt-search-inp">
      </div>
      <div class="pmt-legend">
        <div class="pmt-legend-item">
          <div class="pmt-legend-dot" style="background:rgba(34,197,94,0.5);border:1px solid rgba(34,197,94,0.4);"></div>
          Granted
        </div>
        <div class="pmt-legend-item">
          <div class="pmt-legend-dot" style="background:var(--bg-hover);border:1px solid var(--border-default);"></div>
          Not granted
        </div>
        <div class="pmt-legend-item">
          <i class="bi bi-info-circle" style="font-size:12px;color:var(--text-muted);"></i>
          Click any cell to toggle. Save per-role using the column button.
        </div>
      </div>`
    wrap.appendChild(toolbarEl)

    toolbarEl.querySelector<HTMLInputElement>('#pmt-search-inp')
      ?.addEventListener('input', (e) => {
        this._search = (e.target as HTMLInputElement).value.toLowerCase()
        this._refreshMatrix()
      })

    // Summary
    const summaryEl = document.createElement('div')
    summaryEl.className = 'pmt-summary'
    summaryEl.id = 'pmt-summary'
    wrap.appendChild(summaryEl)
    this._updateSummary(summaryEl)

    // Matrix container
    const matrixOuter = document.createElement('div')
    matrixOuter.className = 'pmt-matrix-outer'
    matrixOuter.id = 'pmt-matrix-outer'
    wrap.appendChild(matrixOuter)

    this._refreshMatrix()
  }

  private _updateSummary(el: HTMLElement): void {
    const totalPerms = this._allPerms.filter(p => p.isAssignable).length
    const totalRoles = this._roles.length
    const totalAssigned = [...this._dirty.values()].reduce((n, s) => n + s.size, 0)
    el.innerHTML = `
      <span><strong>${totalRoles}</strong> role${totalRoles !== 1 ? 's' : ''}</span>
      <span>·</span>
      <span><strong>${totalPerms}</strong> permissions available</span>
      <span>·</span>
      <span><strong>${totalAssigned}</strong> total assignments</span>`
  }

  private _refreshMatrix(): void {
    const outer = this._container?.querySelector<HTMLElement>('#pmt-matrix-outer')
    if (!outer) return

    const filtered = this._search
      ? this._allPerms.filter(p =>
          p.key.includes(this._search) ||
          p.label.toLowerCase().includes(this._search)
        )
      : this._allPerms

    if (!this._roles.length) {
      outer.innerHTML = `
        <div class="pmt-empty-col">
          <i class="bi bi-shield-slash" style="font-size:2rem;color:var(--border-strong);
             display:block;margin-bottom:12px;"></i>
          No roles found. Create roles in the Roles tab first.
        </div>`
      return
    }

    if (!filtered.length) {
      outer.innerHTML = `
        <div class="pmt-empty-col">
          <i class="bi bi-search" style="font-size:2rem;color:var(--border-strong);
             display:block;margin-bottom:12px;"></i>
          No permissions match your search.
        </div>`
      return
    }

    // Group permissions by module
    const byModule = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const mod = p.moduleName ?? 'other'
      if (!byModule.has(mod)) byModule.set(mod, [])
      byModule.get(mod)!.push(p)
    }

    // Build table HTML
    let thead = `
      <thead>
        <tr>
          <th class="pmt-th-permission">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;
                         letter-spacing:0.06em;color:var(--text-muted);">Permission</span>
          </th>
          ${this._roles.map(r => {
            const dirty  = this._dirty.get(r.id) ?? new Set<string>()
            const isDirty = dirty.size !== r.permissions.length ||
              [...dirty].some(k => !r.permissions.includes(k))
            return `
            <th class="pmt-th-role" data-th-role="${r.id}">
              <div class="pmt-role-col-header">
                <i class="bi bi-shield-fill" style="font-size:14px;color:var(--caci-blue-light);"></i>
                <span class="pmt-role-name" title="${r.name}">${r.name}</span>
                <span class="pmt-role-perm-count" id="pmt-count-${r.id}">${dirty.size} perms</span>
                <button class="pmt-save-col-btn${isDirty ? ' dirty' : ''}" data-save-role="${r.id}">
                  <i class="bi bi-${isDirty ? 'cloud-arrow-up-fill' : 'check2'}"></i>
                  ${isDirty ? 'Save' : 'Saved'}
                </button>
              </div>
            </th>`
          }).join('')}
        </tr>
      </thead>`

    let tbody = '<tbody>'
    for (const [modName, perms] of byModule) {
      // Module header row
      tbody += `
        <tr class="pmt-mod-header-row">
          <td class="pmt-td-name pmt-mod-header-sticky pmt-td-name">
            <div class="pmt-mod-name">
              <i class="bi bi-${modIcon(modName)}"></i>
              ${modName}
            </div>
          </td>
          ${this._roles.map(() => `<td></td>`).join('')}
        </tr>`

      // Permission rows
      for (const p of perms) {
        tbody += `
          <tr class="pmt-perm-row" data-perm-key="${p.key}">
            <td class="pmt-td-name">
              <p class="pmt-perm-label">${p.label}</p>
              <p class="pmt-perm-key">${p.key}</p>
            </td>
            ${this._roles.map(r => {
              const granted = this._dirty.get(r.id)?.has(p.key) ?? false
              return `
              <td class="pmt-td-toggle" data-cell-role="${r.id}" data-cell-perm="${p.key}">
                <button class="pmt-toggle-btn${granted ? ' on' : ' off'}" title="${granted ? 'Revoke' : 'Grant'}">
                  <i class="bi bi-${granted ? 'check-circle-fill' : 'dash-circle'}"></i>
                </button>
              </td>`
            }).join('')}
          </tr>`
      }
    }
    tbody += '</tbody>'

    outer.innerHTML = `<table class="pmt-matrix">${thead}${tbody}</table>`

    // Wire toggle clicks
    outer.querySelectorAll<HTMLElement>('[data-cell-role]').forEach(cell => {
      cell.addEventListener('click', () => {
        const roleId  = cell.dataset['cellRole']!
        const permKey = cell.dataset['cellPerm']!
        const set     = this._dirty.get(roleId)!
        const wasOn   = set.has(permKey)

        if (wasOn) set.delete(permKey); else set.add(permKey)

        // Update button
        const btn = cell.querySelector<HTMLButtonElement>('.pmt-toggle-btn')!
        btn.className = `pmt-toggle-btn ${wasOn ? 'off' : 'on'}`
        btn.innerHTML = `<i class="bi bi-${wasOn ? 'dash-circle' : 'check-circle-fill'}"></i>`
        btn.title = wasOn ? 'Grant' : 'Revoke'

        // Update count badge
        const countEl = outer.querySelector<HTMLElement>(`#pmt-count-${roleId}`)
        if (countEl) countEl.textContent = `${set.size} perms`

        // Mark save button as dirty
        const saveBtn = outer.querySelector<HTMLButtonElement>(`[data-save-role="${roleId}"]`)
        if (saveBtn) {
          saveBtn.classList.add('dirty')
          saveBtn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill"></i> Save`
        }

        // Update summary
        const summaryEl = this._container?.querySelector<HTMLElement>('#pmt-summary')
        if (summaryEl) this._updateSummary(summaryEl)
      })
    })

    // Wire save-column buttons
    outer.querySelectorAll<HTMLButtonElement>('[data-save-role]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const roleId = btn.dataset['saveRole']!
        const perms  = [...(this._dirty.get(roleId) ?? [])]
        const orig   = btn.innerHTML

        btn.disabled = true
        btn.innerHTML = `<span class="aw-spinner" style="width:10px;height:10px;"></span> Saving…`
        btn.classList.remove('dirty')

        try {
          await setRolePermissions(roleId, perms)
          // Update in-memory role permissions so dirty detection stays accurate
          const role = this._roles.find(r => r.id === roleId)
          if (role) role.permissions = perms
          btn.innerHTML = `<i class="bi bi-check2"></i> Saved`
          showToast(`Permissions saved for role`, 'success')
        } catch (err: any) {
          btn.disabled = false
          btn.classList.add('dirty')
          btn.innerHTML = orig
          showToast(err?.message ?? 'Save failed', 'danger')
        } finally {
          btn.disabled = false
        }
      })
    })
  }

  destroy(): void {
    this._destroyed = true
    this._container = null
  }
}