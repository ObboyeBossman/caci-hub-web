// src/modules/admin/tabs/RolesTab.ts
// Fully functional Roles tab.
// Features: role cards with permission count + member count, create/edit/delete modals,
// permission assignment panel (inline chip-based picker), context menu, realtime events.

import { on, off, emit }       from '@core/events'
import { can }                  from '@core/authorization/authorization-service'
import { getCurrentUser }       from '@core/auth'
import { debounce }             from '@shared/utils/debounce'
import {
  listAssemblyRoles,
  createAssemblyRole,
  updateAssemblyRole,
  deleteAssemblyRole,
  setRolePermissions,
  listAccounts,
  assignRoleToUser,
  type AssemblyRole,
} from '../repository'
import { getAll as getAllPermissions } from '@core/authorization/permission-registry'
import type { WorkspaceTab }          from '../workspace/AdminWorkspaceShell'
import {
  injectWidgetCSS,
  StatsCardGroup,
  Toolbar,
  ContextMenu,
  showToast,
  openModal,
  renderEmptyState,
  avatarColor,
  initials,
} from '../widgets/adminWidgets'

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ROLES_CSS = /* css */`
/* ════════════════════════════════════════════════
   ROLES TAB  — scoped under .rol-*
════════════════════════════════════════════════ */

.rol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}
@media (max-width: 639px) {
  .rol-grid { grid-template-columns: 1fr; gap: var(--space-md); }
}

/* Role card */
.rol-card {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: 18px; position: relative; overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.25s, border-color 0.25s;
  animation: awFadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
}
.rol-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 18px; opacity: 0;
  background: radial-gradient(500px circle at var(--mx,50%) var(--my,50%),
    rgba(0,75,160,0.05), transparent 40%);
  transition: opacity 0.4s; pointer-events: none;
}
.rol-card:hover {
  transform: translateY(-3px);
  border-color: rgba(0,75,160,0.3);
  box-shadow: 0 12px 36px rgba(0,0,0,0.2);
}
.rol-card:hover::before { opacity: 1; }

/* Card accent bar at top */
.rol-card-accent {
  height: 4px;
  background: linear-gradient(90deg, var(--caci-blue), var(--caci-blue-light));
  border-radius: 18px 18px 0 0;
}
.rol-card.system .rol-card-accent {
  background: linear-gradient(90deg, var(--caci-red), #ff6b6b);
}

.rol-card-inner { padding: var(--space-lg); }

.rol-card-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px; margin-bottom: var(--space-md);
}
.rol-card-icon {
  width: 42px; height: 42px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: rgba(0,75,160,0.1);
}
.rol-card.system .rol-card-icon { background: rgba(198,0,38,0.1); }
.rol-card-icon i { font-size: 20px; color: var(--caci-blue-light); }
.rol-card.system .rol-card-icon i { color: var(--caci-red); }

.rol-card-name {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 3px; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rol-card-desc {
  font-size: 12px; color: var(--text-secondary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  min-height: 36px;
}

/* System badge */
.rol-system-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 99px; flex-shrink: 0;
  background: rgba(198,0,38,0.1); border: 1px solid rgba(198,0,38,0.2);
  font-size: 10px; font-weight: 600; color: var(--caci-red);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.rol-system-badge i { font-size: 10px; }

/* Stats row inside card */
.rol-card-stats {
  display: flex; align-items: center; gap: var(--space-md);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  margin-bottom: var(--space-md);
}
.rol-stat-item {
  display: flex; flex-direction: column; align-items: center;
  gap: 2px; flex: 1;
}
.rol-stat-value {
  font-size: 20px; font-weight: 700; color: var(--text-primary); line-height: 1;
}
.rol-stat-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
}
.rol-stat-divider {
  width: 1px; height: 30px; background: var(--border-default); flex-shrink: 0;
}

/* Permission chips preview */
.rol-perm-chips {
  display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: var(--space-md);
  min-height: 24px;
}
.rol-perm-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px;
  background: rgba(0,75,160,0.08); border: 1px solid rgba(0,75,160,0.2);
  font-size: 10px; font-weight: 500; color: var(--caci-blue-light);
  white-space: nowrap;
}
.rol-perm-chip-more {
  background: var(--bg-hover); border-color: var(--border-default);
  color: var(--text-secondary);
}

/* Card footer — action buttons */
.rol-card-footer {
  display: flex; gap: 8px;
}
.rol-card-action-btn {
  flex: 1; height: 34px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  font-family: var(--font-sans); transition: all 0.15s;
}
.rol-btn-perms {
  background: rgba(0,75,160,0.08); border: 1px solid rgba(0,75,160,0.2);
  color: var(--caci-blue-light);
}
.rol-btn-perms:hover { background: rgba(0,75,160,0.15); border-color: rgba(0,75,160,0.4); }
.rol-btn-edit {
  background: var(--bg-hover); border: 1px solid var(--border-default);
  color: var(--text-secondary);
}
.rol-btn-edit:hover { border-color: var(--border-strong); color: var(--text-primary); }

/* Member avatars stack in card */
.rol-av-stack { display: flex; align-items: center; }
.rol-av {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff;
  border: 2px solid var(--bg-page);
  margin-left: -7px; flex-shrink: 0;
}
.rol-av:first-child { margin-left: 0; }
.rol-av-more {
  background: var(--bg-hover); color: var(--text-secondary);
  border-color: var(--border-default); font-size: 9px;
}

/* ── Permission Picker (used inside Edit Permissions modal) ── */
.rol-perm-picker {
  display: flex; flex-direction: column; gap: var(--space-md);
}
.rol-perm-module {
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md); overflow: hidden;
}
.rol-perm-module-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border-default);
  cursor: pointer; user-select: none;
}
.rol-perm-module-header i { font-size: 14px; color: var(--caci-blue-light); }
.rol-perm-module-name {
  font-size: 12px; font-weight: 700; color: var(--text-primary);
  text-transform: uppercase; letter-spacing: 0.06em; flex: 1;
}
.rol-perm-module-count {
  font-size: 11px; color: var(--text-muted);
  background: var(--bg-hover); padding: 2px 8px;
  border-radius: 99px; border: 1px solid var(--border-default);
}
.rol-perm-module-toggle {
  font-size: 12px; font-weight: 600; cursor: pointer;
  color: var(--caci-blue-light); padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0,75,160,0.25);
  background: rgba(0,75,160,0.08); transition: all 0.15s;
  font-family: var(--font-sans);
}
.rol-perm-module-toggle:hover { background: rgba(0,75,160,0.15); }
.rol-perm-module-body {
  padding: 12px 14px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.rol-perm-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-page);
  cursor: pointer; transition: all 0.15s;
}
.rol-perm-item:hover { border-color: var(--border-strong); }
.rol-perm-item.selected {
  border-color: rgba(0,75,160,0.4);
  background: rgba(0,75,160,0.06);
}
.rol-perm-item input[type="checkbox"] { accent-color: var(--caci-blue); margin-top: 2px; flex-shrink: 0; }
.rol-perm-item-label {
  font-size: 12px; font-weight: 500; color: var(--text-primary); margin: 0;
}
.rol-perm-item-key {
  font-size: 10px; color: var(--text-muted); font-family: monospace; margin: 2px 0 0;
}

/* ── Assign Role to User section ── */
.rol-assign-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-page);
  transition: border-color 0.15s;
}
.rol-assign-row:hover { border-color: var(--border-strong); }
`

let _rolesCSSInjected = false
function _injectRolesCSS(): void {
  if (_rolesCSSInjected) return
  _rolesCSSInjected = true
  const s = document.createElement('style')
  s.id = 'rol-tab-css'
  s.textContent = ROLES_CSS
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE ICON MAP
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, string> = {
  admin:      'shield-lock-fill',
  members:    'people-fill',
  groups:     'diagram-3-fill',
  finance:    'currency-dollar',
  services:   'calendar-event-fill',
  pastoral:   'heart-fill',
  households: 'house-fill',
  reports:    'bar-chart-fill',
}

function moduleIcon(name: string): string {
  return MODULE_ICONS[name.toLowerCase()] ?? 'grid-fill'
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES TAB
// ─────────────────────────────────────────────────────────────────────────────

export class RolesTab implements WorkspaceTab {
  readonly id         = 'roles'
  readonly label      = 'Roles'
  readonly icon       = 'shield-fill'
  readonly permission = 'admin.roles.view'

  private _container: HTMLElement | null = null
  private _roles:     AssemblyRole[]     = []
  private _accounts:  Awaited<ReturnType<typeof listAccounts>> = []
  private _filtered:  AssemblyRole[]     = []
  private _search     = ''
  private _destroyed  = false
  private _ctxMenu    = new ContextMenu()
  private _toolbar:   Toolbar | null = null

  private _onRoleChanged = () => this._reload()

  async render(container: HTMLElement): Promise<void> {
    _injectRolesCSS()
    injectWidgetCSS()
    this._container = container
    this._destroyed = false

    on('account:roleChanged', this._onRoleChanged)

    // Skeleton
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg);">
        <div class="aw-stats-row">
          ${[1,2,3].map(() => `<div style="height:90px;background:var(--bg-card);
            border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>`).join('')}
        </div>
        <div style="height:52px;background:var(--bg-card);border-radius:var(--radius-lg);
                    border:1px solid var(--border-default);"></div>
        <div class="rol-grid">
          ${[1,2,3,4].map(() => `<div style="height:240px;background:var(--bg-card);
            border-radius:18px;border:1px solid var(--border-default);"></div>`).join('')}
        </div>
      </div>`

    await this._loadData()
    if (this._destroyed) return
    this._buildUI()
  }

  private async _loadData(): Promise<void> {
    try {
      ;[this._roles, this._accounts] = await Promise.all([
        listAssemblyRoles(),
        listAccounts(),
      ])
      this._applyFilters()
    } catch (err) {
      console.error('[RolesTab] load error', err)
    }
  }

  private async _reload(): Promise<void> {
    if (this._destroyed) return
    await this._loadData()
    this._refreshGrid()
    this._refreshStats()
  }

  private _applyFilters(): void {
    const q = this._search.toLowerCase()
    this._filtered = q
      ? this._roles.filter(r =>
          r.name.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q)
        )
      : [...this._roles]
  }

  // ── Member count per role ────────────────────────────────────────────────

  private _memberCountForRole(roleId: string): number {
    return this._accounts.filter((a: any) => a.assemblyRoleId === roleId).length
  }

  private _membersForRole(roleId: string) {
    return this._accounts.filter((a: any) => a.assemblyRoleId === roleId)
  }

  // ── Build UI ─────────────────────────────────────────────────────────────

  private _buildUI(): void {
    if (!this._container || this._destroyed) return
    const user = getCurrentUser()
    const canManage = user && can(user, 'admin.users.manage' as any)

    this._container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'column'
    wrap.style.gap = 'var(--space-lg)'
    this._container.appendChild(wrap)

    // ── Stats ──────────────────────────────────────────────────────────────
    const statsWrap = document.createElement('div')
    statsWrap.id = 'rol-stats'
    wrap.appendChild(statsWrap)
    this._renderStats(statsWrap)

    // ── Toolbar ────────────────────────────────────────────────────────────
    this._toolbar = new Toolbar(wrap, {
      searchPlaceholder: 'Search roles by name or description…',
      actions: canManage ? [
        {
          id: 'create',
          label: 'Create Role',
          icon: 'plus-lg',
          variant: 'primary',
          onClick: () => this._openCreateModal(),
        },
      ] : [],
      onSearch: debounce((q: string) => {
        this._search = q
        this._applyFilters()
        this._refreshGrid()
      }, 220),
    })

    // ── Results meta ───────────────────────────────────────────────────────
    const meta = document.createElement('div')
    meta.className = 'aw-results-meta'
    meta.id = 'rol-meta'
    wrap.appendChild(meta)

    // ── Grid ───────────────────────────────────────────────────────────────
    const grid = document.createElement('div')
    grid.className = 'rol-grid'
    grid.id = 'rol-grid'
    wrap.appendChild(grid)

    this._refreshGrid()
  }

  private _renderStats(container: HTMLElement): void {
    const total   = this._roles.length + 2
    const perms   = this._roles.reduce((n, r) => n + r.permissions.length, 0)
    const withPerms = this._roles.filter(r => r.permissions.length > 0).length + 1

    const assignedCount = this._accounts.filter((a: any) => a.assemblyRoleId || a.role === 'admin' || a.role === 'member').length

    container.innerHTML = ''

    new StatsCardGroup(
      container,
      [
        {
          id: 'all', label: 'Total Roles', icon: 'shield-fill',
          accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.15)',
          getValue: () => total,
          getSub: () => `${withPerms} with permissions`,
        },
        {
          id: 'perms', label: 'Total Permissions', icon: 'key-fill',
          accentColor: '#22c55e', glowColor: 'rgba(34,197,94,0.15)',
          getValue: () => perms,
          getSub: () => perms === 1 ? 'assigned' : 'assigned',
        },
        {
          id: 'users', label: 'Assigned Users', icon: 'person-check-fill',
          accentColor: '#d29922', glowColor: 'rgba(210,153,34,0.15)',
          getValue: () => assignedCount,
        },
      ],
      () => {} // stats are display-only here
    )
  }

  private _refreshStats(): void {
    const statsWrap = this._container?.querySelector<HTMLElement>('#rol-stats')
    if (statsWrap) this._renderStats(statsWrap)
  }

  private _refreshGrid(): void {
    const grid = this._container?.querySelector<HTMLElement>('#rol-grid')
    const meta = this._container?.querySelector<HTMLElement>('#rol-meta')
    if (!grid) return

    const sysCount = this._search ? 0 : 2

    if (meta) {
      const totalCards = this._filtered.length + sysCount
      meta.innerHTML = `<span>Showing <strong>${totalCards}</strong> role${totalCards !== 1 ? 's' : ''}</span>`
    }

    if (!this._filtered.length && this._search) {
      grid.innerHTML = ''
      renderEmptyState(grid, {
        icon:        'shield-slash',
        title:       'No roles match your search',
        description: 'Try a different search term.',
        action: {
          label:   'Clear Search',
          icon:    'x-lg',
          onClick: () => { this._toolbar?.clearSearch(); this._search = ''; this._applyFilters(); this._refreshGrid() },
        },
      })
      return
    }

    const renderSystemCard = (
      id: string, name: string, desc: string, icon: string,
      accounts: any[], permsCountText: string | number, chipsHtml: string
    ) => {
      const count = accounts.length
      const sliced = accounts.slice(0, 3)
      const avatarStack = sliced.length > 0
        ? `<div class="rol-av-stack">
            ${sliced.map(m => `
              <div class="rol-av" style="background:${avatarColor(m.fullName)};" title="${m.fullName}">
                ${initials(m.fullName)}
              </div>`).join('')}
            ${count > 3 ? `<div class="rol-av rol-av-more">+${count - 3}</div>` : ''}
           </div>`
        : `<span style="font-size:11px;color:var(--text-muted);">No users assigned</span>`

      return `
      <div class="rol-card system" data-system-role-id="${id}">
        <div class="rol-card-accent"></div>
        <div class="rol-card-inner">
          <div class="rol-card-header">
            <div class="rol-card-icon">
              <i class="bi bi-${icon}"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <p class="rol-card-name">${name} <span class="rol-system-badge" style="margin-left:6px;"><i class="bi bi-shield-fill-check"></i> SYSTEM</span></p>
              <p class="rol-card-desc">${desc}</p>
            </div>
          </div>

          <div class="rol-card-stats">
            <div class="rol-stat-item">
              <span class="rol-stat-value">${permsCountText}</span>
              <span class="rol-stat-label">Permissions</span>
            </div>
            <div class="rol-stat-divider"></div>
            <div class="rol-stat-item">
              <span class="rol-stat-value">${count}</span>
              <span class="rol-stat-label">Users</span>
            </div>
            <div class="rol-stat-divider"></div>
            <div class="rol-stat-item">
              ${avatarStack}
            </div>
          </div>

          <div class="rol-perm-chips">${chipsHtml}</div>

          <div class="rol-card-footer">
            <button class="rol-card-action-btn rol-btn-perms" disabled style="opacity:0.6;cursor:not-allowed;" title="System roles cannot be modified">
              <i class="bi bi-lock-fill" style="font-size:12px;"></i>
              Locked
            </button>
          </div>
        </div>
      </div>`
    }

    const adminAccounts = this._accounts.filter((a: any) => a.role === 'admin')
    const memberAccounts = this._accounts.filter((a: any) => a.role === 'member' && !a.assemblyRoleId)

    const sysHtml = this._search ? '' : [
      renderSystemCard('admin', 'Administrator', 'Full system access and privileges.', 'shield-lock-fill', adminAccounts, 'All', '<span class="rol-perm-chip">system.*</span>'),
      renderSystemCard('member', 'Member', 'Default access for all registered members.', 'person-fill', memberAccounts, 'Basic', '<span class="rol-perm-chip">auth.login</span><span class="rol-perm-chip">hub.view</span>')
    ].join('')

    grid.innerHTML = sysHtml + this._filtered.map((role, i) => {
      const memberCount  = this._memberCountForRole(role.id)
      const roleMembers  = this._membersForRole(role.id).slice(0, 3)
      const permCount    = role.permissions.length
      const previewPerms = role.permissions.slice(0, 3)
      const extraPerms   = permCount - 3
      const delay        = Math.min(i * 40, 400)

      const avatarStack = roleMembers.length > 0
        ? `<div class="rol-av-stack">
            ${roleMembers.map(m => `
              <div class="rol-av" style="background:${avatarColor(m.fullName)};" title="${m.fullName}">
                ${initials(m.fullName)}
              </div>`).join('')}
            ${memberCount > 3 ? `<div class="rol-av rol-av-more">+${memberCount - 3}</div>` : ''}
           </div>`
        : `<span style="font-size:11px;color:var(--text-muted);">No users assigned</span>`

      const permChips = previewPerms.map(p => {
        const short = p.split('.').slice(-1)[0] ?? p
        return `<span class="rol-perm-chip">${short}</span>`
      }).join('')

      const extraChip = extraPerms > 0
        ? `<span class="rol-perm-chip rol-perm-chip-more">+${extraPerms} more</span>`
        : ''

      return `
      <div class="rol-card" data-role-id="${role.id}" style="animation-delay:${delay}ms;">
        <div class="rol-card-accent"></div>
        <div class="rol-card-inner">
          <div class="rol-card-header">
            <div class="rol-card-icon">
              <i class="bi bi-shield-fill"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <p class="rol-card-name">${role.name}</p>
              <p class="rol-card-desc">${role.description ?? 'No description provided.'}</p>
            </div>
          </div>

          <div class="rol-card-stats">
            <div class="rol-stat-item">
              <span class="rol-stat-value">${permCount}</span>
              <span class="rol-stat-label">Permissions</span>
            </div>
            <div class="rol-stat-divider"></div>
            <div class="rol-stat-item">
              <span class="rol-stat-value">${memberCount}</span>
              <span class="rol-stat-label">Users</span>
            </div>
            <div class="rol-stat-divider"></div>
            <div class="rol-stat-item">
              ${avatarStack}
            </div>
          </div>

          <div class="rol-perm-chips">${permChips}${extraChip}</div>

          <div class="rol-card-footer">
            <button class="rol-card-action-btn rol-btn-perms" data-perms-id="${role.id}">
              <i class="bi bi-key-fill" style="font-size:12px;"></i>
              Permissions
            </button>
            <button class="rol-card-action-btn rol-btn-edit" data-edit-id="${role.id}">
              <i class="bi bi-pencil-fill" style="font-size:11px;"></i>
              Edit
            </button>
            <button class="aw-tbtn" style="height:34px;padding:0 10px;flex-shrink:0;"
                    data-ctx-role-id="${role.id}" title="More options">
              <i class="bi bi-three-dots-vertical" style="font-size:14px;"></i>
            </button>
          </div>
        </div>
      </div>`
    }).join('')

    // Spotlight effect
    grid.querySelectorAll<HTMLElement>('.rol-card').forEach(card => {
      ;(card as any)._move = (e: MouseEvent) => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%')
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
      }
      card.addEventListener('mousemove', (e) => (card as any)._move(e))
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mx', '50%')
        card.style.setProperty('--my', '50%')
      })
    })

    // Bind buttons
    grid.querySelectorAll<HTMLButtonElement>('[data-perms-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const role = this._roles.find(r => r.id === btn.dataset['permsId'])
        if (role) this._openPermissionsModal(role)
      })
    })

    grid.querySelectorAll<HTMLButtonElement>('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const role = this._roles.find(r => r.id === btn.dataset['editId'])
        if (role) this._openEditModal(role)
      })
    })

    grid.querySelectorAll<HTMLButtonElement>('[data-ctx-role-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const role = this._roles.find(r => r.id === btn.dataset['ctxRoleId'])
        if (!role) return
        this._ctxMenu.show(btn.getBoundingClientRect(), [
          {
            id: 'edit', label: 'Edit Role', icon: 'pencil-fill',
            onClick: () => this._openEditModal(role),
          },
          {
            id: 'perms', label: 'Edit Permissions', icon: 'key-fill',
            onClick: () => this._openPermissionsModal(role),
          },
          {
            id: 'assign', label: 'Assign Users', icon: 'person-plus-fill',
            onClick: () => this._openAssignModal(role),
          },
          {
            id: 'delete', label: 'Delete Role', icon: 'trash3-fill',
            variant: 'danger', divider: true,
            onClick: () => this._confirmDelete(role),
          },
        ])
      })
    })
  }

  // ── Create Modal ─────────────────────────────────────────────────────────

  private _openCreateModal(): void {
    const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Role Name *</label>
        <input type="text" class="aw-form-inp" id="rol-new-name"
               placeholder="e.g. Finance Secretary" maxlength="60" autocomplete="off">
        <div class="aw-form-error" id="rol-name-err">Role name is required.</div>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Description</label>
        <textarea class="aw-form-inp aw-form-textarea" id="rol-new-desc"
                  placeholder="What does this role allow?" maxlength="200" rows="3"></textarea>
      </div>
      <div class="acct-info-banner info" style="display:flex;align-items:flex-start;gap:10px;
           padding:12px;border-radius:var(--radius-sm);background:rgba(0,75,160,0.06);
           border:1px solid rgba(0,75,160,0.18);">
        <i class="bi bi-info-circle-fill" style="color:var(--caci-blue-light);font-size:16px;flex-shrink:0;margin-top:1px;"></i>
        <p style="font-size:12px;color:var(--text-secondary);line-height:1.55;margin:0;">
          After creating the role, you can assign permissions and users to it from the role card.
        </p>
      </div>`

    const footer = `
      <button class="aw-tbtn" id="rol-create-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="rol-create-submit">
        <i class="bi bi-plus-circle-fill"></i>
        <span>Create Role</span>
      </button>`

    const close = openModal({
      title: 'Create New Role', subtitle: 'Define a new assembly role',
      icon: 'shield-plus', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    setTimeout(() => overlay.querySelector<HTMLInputElement>('#rol-new-name')?.focus(), 80)

    overlay.querySelector('#rol-create-cancel')?.addEventListener('click', close)
    overlay.querySelector('#rol-create-submit')?.addEventListener('click', async () => {
      const nameInp = overlay.querySelector<HTMLInputElement>('#rol-new-name')!
      const descInp = overlay.querySelector<HTMLTextAreaElement>('#rol-new-desc')!
      const nameErr = overlay.querySelector<HTMLElement>('#rol-name-err')!
      const btn     = overlay.querySelector<HTMLButtonElement>('#rol-create-submit')!
      const name    = nameInp.value.trim()

      if (!name) { nameErr.classList.add('show'); nameInp.focus(); return }
      nameErr.classList.remove('show')

      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Creating…`

      try {
        await createAssemblyRole({ name, description: descInp.value.trim() || undefined })
        close()
        showToast(`Role "${name}" created`, 'success')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-plus-circle-fill"></i> Create Role`
        nameErr.textContent = err?.message ?? 'Failed to create role. Try again.'
        nameErr.classList.add('show')
      }
    })
  }

  // ── Edit Modal ────────────────────────────────────────────────────────────

  private _openEditModal(role: AssemblyRole): void {
    const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Role Name *</label>
        <input type="text" class="aw-form-inp" id="rol-edit-name"
               value="${role.name}" maxlength="60" autocomplete="off">
        <div class="aw-form-error" id="rol-edit-name-err">Role name is required.</div>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Description</label>
        <textarea class="aw-form-inp aw-form-textarea" id="rol-edit-desc"
                  maxlength="200" rows="3">${role.description ?? ''}</textarea>
      </div>`

    const footer = `
      <button class="aw-tbtn" id="rol-edit-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="rol-edit-save">
        <i class="bi bi-check2-circle"></i>
        <span>Save Changes</span>
      </button>`

    const close = openModal({
      title: 'Edit Role', subtitle: role.name,
      icon: 'pencil-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#rol-edit-cancel')?.addEventListener('click', close)

    overlay.querySelector('#rol-edit-save')?.addEventListener('click', async () => {
      const nameInp = overlay.querySelector<HTMLInputElement>('#rol-edit-name')!
      const descInp = overlay.querySelector<HTMLTextAreaElement>('#rol-edit-desc')!
      const nameErr = overlay.querySelector<HTMLElement>('#rol-edit-name-err')!
      const btn     = overlay.querySelector<HTMLButtonElement>('#rol-edit-save')!
      const name    = nameInp.value.trim()

      if (!name) { nameErr.classList.add('show'); return }
      nameErr.classList.remove('show')

      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Saving…`

      try {
        await updateAssemblyRole(role.id, { name, description: descInp.value.trim() || null })
        close()
        showToast('Role updated', 'success')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-check2-circle"></i> Save Changes`
        showToast(err?.message ?? 'Update failed', 'danger')
      }
    })
  }

  // ── Permissions Modal ─────────────────────────────────────────────────────

  private _openPermissionsModal(role: AssemblyRole): void {
    // Get all registered permissions and group by module
    const allPerms  = getAllPermissions()
    const assignable = allPerms.filter(p => p.isAssignable)

    // Group by moduleName
    const byModule = new Map<string, typeof assignable>()
    for (const p of assignable) {
      const mod = p.moduleName ?? 'other'
      if (!byModule.has(mod)) byModule.set(mod, [])
      byModule.get(mod)!.push(p)
    }

    // Track selected state
    const selected = new Set<string>(role.permissions)

    const renderPicker = (): string => {
      let html = '<div class="rol-perm-picker">'
      for (const [modName, perms] of byModule) {
        const selectedInMod = perms.filter(p => selected.has(p.key)).length
        html += `
        <div class="rol-perm-module" data-module="${modName}">
          <div class="rol-perm-module-header">
            <i class="bi bi-${moduleIcon(modName)}"></i>
            <span class="rol-perm-module-name">${modName}</span>
            <span class="rol-perm-module-count">${selectedInMod}/${perms.length}</span>
            <button class="rol-perm-module-toggle" data-toggle-module="${modName}">
              ${selectedInMod === perms.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div class="rol-perm-module-body">
            ${perms.map(p => `
            <div class="rol-perm-item${selected.has(p.key) ? ' selected' : ''}" data-perm-key="${p.key}">
              <input type="checkbox" ${selected.has(p.key) ? 'checked' : ''} data-perm-chk="${p.key}">
              <div>
                <p class="rol-perm-item-label">${p.label}</p>
                <p class="rol-perm-item-key">${p.key}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>`
      }
      html += '</div>'
      return html
    }

    const selectedCount = () => `${selected.size} permission${selected.size !== 1 ? 's' : ''} selected`

    const body = `
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
        <span id="rol-perm-count">${selectedCount()}</span>
      </div>
      <div id="rol-perm-picker-root" style="max-height:420px;overflow-y:auto;
           padding-right:4px;display:flex;flex-direction:column;gap:8px;">
        ${renderPicker()}
      </div>`

    const footer = `
      <button class="aw-tbtn" id="rol-perm-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="rol-perm-save">
        <i class="bi bi-check2-circle"></i>
        <span>Save Permissions</span>
      </button>`

    const close = openModal({
      title: 'Edit Permissions',
      subtitle: role.name,
      icon: 'key-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!

    // Wire up checkbox events (delegated)
    overlay.querySelector('#rol-perm-picker-root')
      ?.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('[data-perm-key]')
        if (!item) return
        const key = item.dataset['permKey']!
        const chk = item.querySelector<HTMLInputElement>(`[data-perm-chk="${key}"]`)!
        if (selected.has(key)) { selected.delete(key); item.classList.remove('selected'); chk.checked = false }
        else                   { selected.add(key);    item.classList.add('selected');    chk.checked = true  }
        const countEl = overlay.querySelector<HTMLElement>('#rol-perm-count')
        if (countEl) countEl.textContent = selectedCount()
        // Refresh module count badge
        const modEl = item.closest<HTMLElement>('[data-module]')
        if (modEl) {
          const modName  = modEl.dataset['module']!
          const modPerms = byModule.get(modName) ?? []
          const sel      = modPerms.filter(p => selected.has(p.key)).length
          const countBadge = modEl.querySelector<HTMLElement>('.rol-perm-module-count')
          if (countBadge) countBadge.textContent = `${sel}/${modPerms.length}`
          const toggleBtn = modEl.querySelector<HTMLButtonElement>('[data-toggle-module]')
          if (toggleBtn) toggleBtn.textContent = sel === modPerms.length ? 'Deselect all' : 'Select all'
        }
      })

    // Select/deselect all for a module
    overlay.querySelector('#rol-perm-picker-root')
      ?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-toggle-module]')
        if (!btn) return
        e.stopPropagation()
        const modName  = btn.dataset['toggleModule']!
        const modPerms = byModule.get(modName) ?? []
        const allSel   = modPerms.every(p => selected.has(p.key))
        modPerms.forEach(p => {
          if (allSel) selected.delete(p.key); else selected.add(p.key)
          const item = overlay.querySelector<HTMLElement>(`[data-perm-key="${p.key}"]`)
          const chk  = overlay.querySelector<HTMLInputElement>(`[data-perm-chk="${p.key}"]`)
          item?.classList.toggle('selected', !allSel)
          if (chk) chk.checked = !allSel
        })
        const countEl = overlay.querySelector<HTMLElement>('#rol-perm-count')
        if (countEl) countEl.textContent = selectedCount()
        const modEl = btn.closest<HTMLElement>('[data-module]')!
        const sel   = modPerms.filter(p => selected.has(p.key)).length
        const countBadge = modEl.querySelector<HTMLElement>('.rol-perm-module-count')
        if (countBadge) countBadge.textContent = `${sel}/${modPerms.length}`
        btn.textContent = sel === modPerms.length ? 'Deselect all' : 'Select all'
      })

    overlay.querySelector('#rol-perm-cancel')?.addEventListener('click', close)

    overlay.querySelector('#rol-perm-save')?.addEventListener('click', async () => {
      const btn = overlay.querySelector<HTMLButtonElement>('#rol-perm-save')!
      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Saving…`
      try {
        await setRolePermissions(role.id, [...selected])
        close()
        showToast(`Permissions updated for "${role.name}"`, 'success')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-check2-circle"></i> Save Permissions`
        showToast(err?.message ?? 'Save failed', 'danger')
      }
    })
  }

  // ── Assign Users Modal ────────────────────────────────────────────────────

  private _openAssignModal(role: AssemblyRole): void {
    const currentUsers   = this._membersForRole(role.id)
    const unassignedUsers = this._accounts.filter((a: any) => !a.assemblyRoleId || a.assemblyRoleId === role.id)

    const body = `
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;">
        Currently assigned: <strong style="color:var(--text-primary);">${currentUsers.length} user${currentUsers.length !== 1 ? 's' : ''}</strong>
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;">
        ${this._accounts.map(a => {
          const isAssigned = (a as any).assemblyRoleId === role.id
          const av         = initials(a.fullName)
          const avColor    = avatarColor(a.fullName)
          return `
          <div class="rol-assign-row">
            <div class="aw-avatar-ring${a.isActive ? '' : ' inactive'}" style="flex-shrink:0;">
              <div class="aw-avatar-inner" style="background:${avColor};color:#fff;width:32px;height:32px;font-size:11px;">${av}</div>
            </div>
            <div style="flex:1;min-width:0;">
              <p style="font-size:13px;font-weight:500;color:var(--text-primary);margin:0;
                         white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.fullName}</p>
              <p style="font-size:10px;color:var(--text-muted);margin:2px 0 0;">${a.email ?? 'No email'}</p>
            </div>
            <div class="aw-toggle" data-assign-user-id="${a.id}" data-role-id="${role.id}">
              <div class="aw-toggle-track${isAssigned ? ' on' : ''}"><div class="aw-toggle-thumb"></div></div>
            </div>
          </div>`
        }).join('')}
      </div>`

    const footer = `<button class="aw-tbtn aw-tbtn-primary" id="rol-assign-done">Done</button>`

    const close = openModal({
      title: 'Assign Users', subtitle: `Role: ${role.name}`,
      icon: 'person-plus-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#rol-assign-done')?.addEventListener('click', close)

    overlay.querySelectorAll<HTMLElement>('[data-assign-user-id]').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const userId  = toggle.dataset['assignUserId']!
        const track   = toggle.querySelector('.aw-toggle-track')!
        const isOn    = track.classList.contains('on')
        track.classList.toggle('on')
        try {
          await assignRoleToUser(userId, isOn ? null : role.id)
          showToast(isOn ? 'User unassigned from role' : 'User assigned to role', 'success')
          await this._reload()
        } catch (err: any) {
          track.classList.toggle('on') // revert
          showToast(err?.message ?? 'Failed to update assignment', 'danger')
        }
      })
    })
  }

  // ── Delete Confirm ────────────────────────────────────────────────────────

  private _confirmDelete(role: AssemblyRole): void {
    const memberCount = this._memberCountForRole(role.id)

    const body = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0;">
        <div style="width:52px;height:52px;border-radius:50%;
                    background:rgba(198,0,38,0.1);border:1px solid rgba(198,0,38,0.25);
                    display:flex;align-items:center;justify-content:center;">
          <i class="bi bi-trash3-fill" style="font-size:22px;color:var(--caci-red);"></i>
        </div>
        <div style="text-align:center;">
          <p style="font-size:15px;font-weight:700;color:var(--text-primary);margin:0 0 6px;">
            Delete "${role.name}"?
          </p>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0;max-width:320px;">
            ${memberCount > 0
              ? `This role is assigned to <strong style="color:var(--text-primary);">${memberCount} user${memberCount !== 1 ? 's' : ''}</strong>.
                 Their <code>assembly_role_id</code> will be cleared. Their access level will fall back to the system default.`
              : `This role has no assigned users. It will be permanently removed along with all its permission assignments.`}
          </p>
        </div>
      </div>`

    const footer = `
      <button class="aw-tbtn" id="rol-del-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-danger" id="rol-del-confirm">
        <i class="bi bi-trash3-fill"></i>
        <span>Delete Role</span>
      </button>`

    const close = openModal({
      title: 'Delete Role', subtitle: role.name,
      icon: 'trash3-fill', iconBg: 'rgba(198,0,38,0.1)', iconColor: 'var(--caci-red)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#rol-del-cancel')?.addEventListener('click', close)

    overlay.querySelector('#rol-del-confirm')?.addEventListener('click', async () => {
      const btn = overlay.querySelector<HTMLButtonElement>('#rol-del-confirm')!
      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Deleting…`
      try {
        await deleteAssemblyRole(role.id)
        close()
        showToast(`Role "${role.name}" deleted`, 'warning')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-trash3-fill"></i> Delete Role`
        showToast(err?.message ?? 'Delete failed', 'danger')
      }
    })
  }

  destroy(): void {
    this._destroyed = true
    off('account:roleChanged', this._onRoleChanged)
    this._toolbar?.destroy()
    this._ctxMenu.close()
    document.getElementById('aw-shared-modal')?.remove()
    this._container = null
  }
}