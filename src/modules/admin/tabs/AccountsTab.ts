// src/modules/admin/tabs/AccountsTab.ts
// Fully functional Accounts tab — the primary Admin module view.
// Implements: stat cards, table/mobile swap, search/filter, bulk actions,
// context menu, sort, and the full Provision / Edit / Reset / Unlink modal set.

import { getCurrentUser } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { on, off, emit } from '@core/events'
import { debounce } from '@shared/utils/debounce'
import {
    listAccounts,
    setUserActive,
    updateUserRole,
    provisionUser,
    deleteMemberAuth,
    resetMemberPassword,
    listUnprovisionedMembers,
    listAssemblyRoles,
} from '../repository'
import type { UserProfileSummary } from '../utils/userProfileCache'
import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import {
    injectWidgetCSS,
    StatsCardGroup,
    Toolbar,
    BulkActionBar,
    ContextMenu,
    showToast,
    renderEmptyState,
    openModal,
    avatarColor,
    initials,
    avatarRingClass,
} from '../widgets/adminWidgets'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (augmented for display)
// ─────────────────────────────────────────────────────────────────────────────

interface AccountRow extends UserProfileSummary {
    displayRole: string
    statusLabel: string
}

type AccountStatus = 'active' | 'inactive' | 'pending' | 'locked'

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ACCT_CSS = /* css */`
/* ════════════════════════════════════════════════════
   ACCOUNTS TAB  — scoped under .acct-*
════════════════════════════════════════════════════ */

/* Table column grid — 7 cols on full desktop */
.acct-row-grid {
  grid-template-columns: 36px 1fr 170px 140px 120px 120px 110px;
}
@media (max-width: 1100px) {
  .acct-row-grid { grid-template-columns: 36px 1fr 170px 140px 120px 110px; }
  .acct-col-linked { display: none !important; }
}
@media (max-width: 860px) {
  .acct-row-grid { grid-template-columns: 36px 1fr 140px 130px 110px; }
  .acct-col-linked,
  .acct-col-provisioned { display: none !important; }
}
@media (max-width: 720px) {
  .acct-row-grid { grid-template-columns: 36px 1fr 130px 110px; }
  .acct-col-linked,
  .acct-col-provisioned,
  .acct-col-role { display: none !important; }
}

/* Link / unlinked chip */
.acct-link-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px;
}
.acct-link-chip.linked   { color: #56d364; }
.acct-link-chip.unlinked { color: var(--text-muted); }
.acct-link-chip i { font-size: 13px; }

/* Row action buttons */
.acct-row-action {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; padding: 6px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.acct-row-action i { font-size: 17px; }
.acct-row-action:hover { background: var(--bg-hover); color: var(--text-secondary); }
.acct-row-action.toggle-on  i { color: #22c55e; }
.acct-row-action.toggle-off i { color: var(--text-muted); }

/* Provision modal: path selector */
.acct-path-option {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  background: transparent;
}
.acct-path-option:hover { border-color: var(--border-strong); }
.acct-path-option.selected {
  border-color: var(--caci-blue);
  background: rgba(0,75,160,0.06);
}
.acct-path-option-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px;
}
.acct-path-option-icon i { font-size: 16px; }
.acct-path-option-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.acct-path-option-desc  { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.45; }

/* Modal info/warning banners */
.acct-info-banner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px; border-radius: var(--radius-sm);
}
.acct-info-banner i { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.acct-info-banner p { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin: 0; }
.acct-info-banner.info {
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.18);
}
.acct-info-banner.info i { color: var(--caci-blue-light); }
.acct-info-banner.warning {
  background: rgba(210,153,34,0.07); border: 1px solid rgba(210,153,34,0.2);
}
.acct-info-banner.warning i { color: #d29922; }
.acct-info-banner.danger {
  background: rgba(198,0,38,0.07); border: 1px solid rgba(198,0,38,0.2);
}
.acct-info-banner.danger i { color: var(--caci-red); }

/* Reset modal radio group */
.acct-radio-group {
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); overflow: hidden;
}
.acct-radio-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; cursor: pointer;
  border-bottom: 1px solid var(--border-default);
  transition: background 0.12s;
}
.acct-radio-item:last-child { border-bottom: none; }
.acct-radio-item:hover { background: var(--bg-hover); }
.acct-radio-item input[type="radio"] { accent-color: var(--caci-blue); margin-top: 3px; flex-shrink: 0; }
.acct-radio-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.acct-radio-desc  { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

/* Confirm unlink ID field */
.acct-confirm-id {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px; letter-spacing: 0.02em;
}

/* Mobile card extras */
.acct-mob-meta {
  display: flex; align-items: center; gap: 4px;
  font-size: 10.5px; color: var(--text-muted);
}
.acct-mob-meta i { font-size: 12px; }
`

let _acctCSSInjected = false
function _injectAcctCSS(): void {
    if (_acctCSSInjected) return
    _acctCSSInjected = true
    const s = document.createElement('style')
    s.id = 'acct-tab-css'
    s.textContent = ACCT_CSS
    document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, string> = {
    'admin': 'shield-fill',
    'member': 'person-fill',
    'Administrator': 'shield-fill',
    'Secretary': 'pencil-square',
    'Finance Officer': 'currency-dollar',
    'Pastor': 'book',
}

function getRoleIcon(role: string): string {
    return ROLE_ICON[role] ?? 'person-fill'
}

function getDisplayRole(role: string): string {
    const map: Record<string, string> = { admin: 'Administrator', member: 'Member' }
    return map[role] ?? role
}

function getAccountStatus(profile: UserProfileSummary): AccountStatus {
    if (!profile.isActive) return 'inactive'
    return 'active'
}

function statusBadgeHTML(status: AccountStatus): string {
    const cfg: Record<AccountStatus, { cls: string; label: string }> = {
        active: { cls: 'aw-badge-active', label: 'Active' },
        inactive: { cls: 'aw-badge-inactive', label: 'Inactive' },
        pending: { cls: 'aw-badge-pending', label: 'Pending' },
        locked: { cls: 'aw-badge-locked', label: 'Locked' },
    }
    const { cls, label } = cfg[status] ?? cfg.inactive
    return `<span class="aw-badge ${cls}"><span class="aw-badge-dot"></span>${label}</span>`
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return dateStr }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB STATE
// ─────────────────────────────────────────────────────────────────────────────

interface TabState {
    accounts: UserProfileSummary[]
    filtered: UserProfileSummary[]
    search: string
    statusFilter: string
    roleFilter: string
    sortField: string
    sortAsc: boolean
    statFilter: string | null
    selectedIds: Set<string>
    loading: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS TAB
// ─────────────────────────────────────────────────────────────────────────────

export class AccountsTab implements WorkspaceTab {
    readonly id = 'accounts'
    readonly label = 'Accounts'
    readonly icon = 'people-fill'
    readonly permission = 'admin.accounts.view'

    private _container: HTMLElement | null = null
    private _state: TabState = {
        accounts: [], filtered: [], search: '', statusFilter: 'all',
        roleFilter: 'all', sortField: 'name', sortAsc: true,
        statFilter: null, selectedIds: new Set(), loading: true,
    }
    private _statsGroup: StatsCardGroup | null = null
    private _toolbar: Toolbar | null = null
    private _bulkBar: BulkActionBar | null = null
    private _ctxMenu = new ContextMenu()
    private _destroyed = false

    // Realtime listeners
    private _onProvisioned = () => this._reload()
    private _onRoleChanged = () => this._reload()
    private _onSuspended = () => this._reload()
    private _onReactivated = () => this._reload()

    async render(container: HTMLElement): Promise<void> {
        _injectAcctCSS()
        injectWidgetCSS()
        this._container = container
        this._destroyed = false

        on('account:provisioned', this._onProvisioned)
        on('account:roleChanged', this._onRoleChanged)
        on('account:suspended', this._onSuspended)
        on('account:reactivated', this._onReactivated)

        // Skeleton
        container.innerHTML = `
      <div style="padding:var(--space-lg) 0;">
        <div class="aw-stats-row" style="margin-bottom:var(--space-xl);">
          ${[1, 2, 3, 4].map(() => `<div style="height:90px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>`).join('')}
        </div>
        <div style="height:52px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-default);margin-bottom:var(--space-md);"></div>
        <div style="height:400px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>
      </div>`

        await this._loadAccounts()
        if (this._destroyed) return
        this._buildUI()
    }

    private async _loadAccounts(): Promise<void> {
        try {
            this._state.accounts = await listAccounts()
            this._state.loading = false
        } catch (err) {
            console.error('[AccountsTab] load error', err)
            this._state.loading = false
        }
        this._applyFilters()
    }

    private async _reload(): Promise<void> {
        if (this._destroyed) return
        try {
            this._state.accounts = await listAccounts()
            this._applyFilters()
            this._statsGroup?.update()
            this._renderContent()
        } catch (err) {
            console.error('[AccountsTab] reload error', err)
        }
    }

    private _buildUI(): void {
        if (!this._container || this._destroyed) return

        const user = getCurrentUser()
        const canManage = user && can(user, 'admin.users.manage' as any)

        this._container.innerHTML = ''

        const wrap = document.createElement('div')
        this._container.appendChild(wrap)

        // ── Stats ──────────────────────────────────────────────────────────────
        this._statsGroup = new StatsCardGroup(
            wrap,
            [
                {
                    id: 'all',
                    label: 'Total Accounts',
                    icon: 'people-fill',
                    accentColor: 'var(--caci-blue-light)',
                    glowColor: 'rgba(0,75,160,0.15)',
                    getValue: () => this._state.accounts.length,
                    getSub: () => `${this._state.accounts.filter(a => a.isActive).length} active`,
                },
                {
                    id: 'active',
                    label: 'Active',
                    icon: 'check-circle-fill',
                    accentColor: '#22c55e',
                    glowColor: 'rgba(34,197,94,0.15)',
                    getValue: () => this._state.accounts.filter(a => a.isActive).length,
                },
                {
                    id: 'inactive',
                    label: 'Inactive',
                    icon: 'slash-circle',
                    accentColor: 'var(--text-muted)',
                    glowColor: 'rgba(139,148,158,0.12)',
                    getValue: () => this._state.accounts.filter(a => !a.isActive).length,
                },
                {
                    id: 'admin',
                    label: 'Administrators',
                    icon: 'shield-fill',
                    accentColor: 'var(--caci-red)',
                    glowColor: 'rgba(198,0,38,0.12)',
                    getValue: () => this._state.accounts.filter(a => a.role === 'admin').length,
                },
            ],
            (filterId) => {
                this._state.statFilter = filterId
                this._applyFilters()
                this._renderContent()
                this._updateFilterBanner()
            }
        )

        // ── Bulk bar ───────────────────────────────────────────────────────────
        this._bulkBar = new BulkActionBar(
            wrap,
            [
                {
                    id: 'activate',
                    label: 'Activate',
                    icon: 'check-circle',
                    variant: 'default',
                    onClick: (ids) => this._bulkActivate(ids, true),
                },
                {
                    id: 'deactivate',
                    label: 'Deactivate',
                    icon: 'slash-circle',
                    variant: 'danger',
                    onClick: (ids) => this._bulkActivate(ids, false),
                },
                {
                    id: 'reset',
                    label: 'Reset Passwords',
                    icon: 'key-fill',
                    variant: 'default',
                    onClick: (ids) => this._bulkReset(ids),
                },
            ],
            () => this._clearSelection()
        )

        // ── Filter banner ──────────────────────────────────────────────────────
        const bannerEl = document.createElement('div')
        bannerEl.className = 'aw-filter-banner'
        bannerEl.id = 'acct-filter-banner'
        wrap.appendChild(bannerEl)

        // ── Toolbar ────────────────────────────────────────────────────────────
        const assemblyRoles: { value: string; label: string }[] = [
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Administrator' },
            { value: 'member', label: 'Member' },
        ]

        this._toolbar = new Toolbar(wrap, {
            searchPlaceholder: 'Search by name, email, member ID…',
            filters: [
                {
                    id: 'status',
                    icon: 'funnel',
                    options: [
                        { value: 'all', label: 'All Status' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                    ],
                    onChange: (v) => {
                        this._state.statusFilter = v
                        this._applyFilters()
                        this._renderContent()
                    },
                },
                {
                    id: 'role',
                    icon: 'shield',
                    options: assemblyRoles,
                    onChange: (v) => {
                        this._state.roleFilter = v
                        this._applyFilters()
                        this._renderContent()
                    },
                },
            ],
            actions: canManage ? [
                {
                    id: 'export',
                    label: 'Export',
                    icon: 'download',
                    variant: 'default',
                    onClick: () => showToast('Exporting accounts…', 'info'),
                },
                {
                    id: 'provision',
                    label: 'Provision Account',
                    icon: 'person-plus-fill',
                    variant: 'primary',
                    onClick: () => this._openProvisionModal(),
                },
            ] : [],
            onSearch: debounce((q: string) => {
                this._state.search = q
                this._applyFilters()
                this._renderContent()
            }, 220),
        })

        // ── Results meta ───────────────────────────────────────────────────────
        const metaRow = document.createElement('div')
        metaRow.className = 'aw-results-meta'
        metaRow.id = 'acct-meta'
        wrap.appendChild(metaRow)

        // ── Table + mobile ─────────────────────────────────────────────────────
        const tableWrap = document.createElement('div')
        tableWrap.id = 'acct-table-wrap'
        wrap.appendChild(tableWrap)

        this._renderContent()
    }

    // ── Filtering & sorting ──────────────────────────────────────────────────

    private _applyFilters(): void {
        const { accounts, search, statusFilter, roleFilter, statFilter } = this._state
        const q = search.toLowerCase()

        this._state.filtered = accounts.filter(a => {
            const matchSearch = !q
                || a.fullName.toLowerCase().includes(q)
                || (a.email ?? '').toLowerCase().includes(q)
                || (a.memberId ?? '').toLowerCase().includes(q)
                || a.role.toLowerCase().includes(q)

            const status = getAccountStatus(a)
            const matchStatus = statusFilter === 'all' || status === statusFilter
            const matchRole = roleFilter === 'all' || a.role === roleFilter
            const matchStat = !statFilter || statFilter === 'all'
                || (statFilter === 'active' && a.isActive)
                || (statFilter === 'inactive' && !a.isActive)
                || (statFilter === 'admin' && a.role === 'admin')

            return matchSearch && matchStatus && matchRole && matchStat
        })

        this._applySort()
    }

    private _applySort(): void {
        const { filtered, sortField, sortAsc } = this._state
        filtered.sort((a, b) => {
            let cmp = 0
            if (sortField === 'name') cmp = a.fullName.localeCompare(b.fullName)
            if (sortField === 'role') cmp = a.role.localeCompare(b.role)
            if (sortField === 'status') cmp = (a.isActive ? 0 : 1) - (b.isActive ? 0 : 1)
            return sortAsc ? cmp : -cmp
        })
    }

    private _sortBy(field: string): void {
        if (this._state.sortField === field) {
            this._state.sortAsc = !this._state.sortAsc
        } else {
            this._state.sortField = field
            this._state.sortAsc = true
        }
        this._applyFilters()
        this._renderContent()
    }

    // ── Render: main content ─────────────────────────────────────────────────

    private _renderContent(): void {
        const tableWrap = this._container?.querySelector<HTMLElement>('#acct-table-wrap')
        const metaEl = this._container?.querySelector<HTMLElement>('#acct-meta')
        if (!tableWrap || !metaEl) return

        const { filtered, selectedIds, sortField, sortAsc } = this._state
        const user = getCurrentUser()
        const canManage = user && can(user, 'admin.users.manage' as any)

        // Meta row
        metaEl.innerHTML = `
      <span>Showing <strong>${filtered.length}</strong> account${filtered.length !== 1 ? 's' : ''}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:var(--text-muted);">Sort</span>
        <select class="aw-sort-inline" id="acct-sort">
          <option value="name_az"${sortField === 'name' && sortAsc ? ' selected' : ''}>Name A–Z</option>
          <option value="name_za"${sortField === 'name' && !sortAsc ? ' selected' : ''}>Name Z–A</option>
          <option value="status"${sortField === 'status' ? ' selected' : ''}>Status</option>
          <option value="role"${sortField === 'role' ? ' selected' : ''}>Role</option>
        </select>
      </div>`

        metaEl.querySelector<HTMLSelectElement>('#acct-sort')?.addEventListener('change', e => {
            const v = (e.target as HTMLSelectElement).value
            if (v === 'name_az') { this._state.sortField = 'name'; this._state.sortAsc = true }
            else if (v === 'name_za') { this._state.sortField = 'name'; this._state.sortAsc = false }
            else { this._state.sortField = v; this._state.sortAsc = true }
            this._applyFilters()
            this._renderContent()
        })

        if (!filtered.length) {
            tableWrap.innerHTML = `
        <div class="aw-table-wrap">
          <div class="aw-empty" style="padding:64px 20px;">
            <div class="aw-empty-icon-wrap"><i class="bi bi-search"></i></div>
            <p class="aw-empty-title">No accounts found</p>
            <p class="aw-empty-desc">Try adjusting your search or filters${canManage ? ', or provision a new account' : ''}.</p>
          </div>
        </div>`
            return
        }

        const colSortIcon = (field: string) => {
            if (this._state.sortField !== field) return '<i class="bi bi-arrow-down-up"></i>'
            return `<i class="bi bi-arrow-${this._state.sortAsc ? 'up' : 'down'}"></i>`
        }

        // Desktop header
        const headerHTML = `
      <div class="aw-table-header aw-table-row acct-row-grid" style="min-height:40px;cursor:default;">
        <div class="aw-col-cell">
          <input type="checkbox" class="aw-chk" id="acct-select-all"
            ${selectedIds.size === filtered.length && filtered.length > 0 ? 'checked' : ''}>
        </div>
        <div class="aw-col-hd${sortField === 'name' ? ' sorted' : ''}" data-sort="name">
          Member ${colSortIcon('name')}
        </div>
        <div class="aw-col-hd acct-col-role${sortField === 'role' ? ' sorted' : ''}" data-sort="role">
          Role ${colSortIcon('role')}
        </div>
        <div class="aw-col-hd${sortField === 'status' ? ' sorted' : ''}" data-sort="status">
          Status ${colSortIcon('status')}
        </div>
        <div class="aw-col-hd acct-col-linked">Linked</div>
        <div class="aw-col-hd acct-col-provisioned">Account</div>
        <div class="aw-col-hd" style="justify-content:flex-end;">Actions</div>
      </div>`

        // Desktop rows
        const rowsHTML = filtered.map((a, i) => {
            const status = getAccountStatus(a)
            const av = initials(a.fullName)
            const avColor = avatarColor(a.fullName)
            const ringCls = avatarRingClass(status)
            const sel = selectedIds.has(a.id)
            const delay = Math.min(i * 35, 350)
            const roleDisplay = getDisplayRole(a.role)

            return `
      <div class="aw-table-row acct-row-grid${sel ? ' selected' : ''}"
           style="animation:awFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) ${delay}ms both;"
           data-account-id="${a.id}">
        <div class="aw-col-cell">
          <input type="checkbox" class="aw-chk acct-row-chk" data-id="${a.id}" ${sel ? 'checked' : ''}>
        </div>
        <div class="aw-col-cell" style="gap:12px;">
          <div class="${ringCls}">
            <div class="aw-avatar-inner" style="background:${avColor};color:#fff;">${av}</div>
          </div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:13px;font-weight:600;color:var(--text-primary);
                           overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.fullName}</span>
            </div>
            <span style="font-size:10px;color:var(--text-muted);font-family:monospace;">
              ${a.email ?? (a.memberId ?? '—')}
            </span>
          </div>
        </div>
        <div class="aw-col-cell acct-col-role">
          <span class="aw-role-pill">
            <i class="bi bi-${getRoleIcon(a.role)}"></i>
            ${roleDisplay}
          </span>
        </div>
        <div class="aw-col-cell">${statusBadgeHTML(status)}</div>
        <div class="aw-col-cell acct-col-linked">
          ${a.memberId
                    ? `<span class="acct-link-chip linked"><i class="bi bi-link-45deg"></i>Linked</span>`
                    : `<span class="acct-link-chip unlinked"><i class="bi bi-link-slash"></i>Unlinked</span>`}
        </div>
        <div class="aw-col-cell acct-col-provisioned" style="flex-direction:column;align-items:flex-start;gap:1px;">
          <span style="font-size:12px;color:var(--text-secondary);">${a.role === 'admin' ? 'Administrator' : 'Member'}</span>
          <span style="font-size:10px;color:var(--text-muted);">ID: ${a.id.slice(0, 8)}…</span>
        </div>
        <div class="aw-col-cell" style="justify-content:flex-end;gap:2px;">
          <button class="acct-row-action ${a.isActive ? 'toggle-on' : 'toggle-off'}"
                  title="${a.isActive ? 'Deactivate' : 'Activate'}" data-toggle-id="${a.id}">
            <i class="bi bi-toggle-${a.isActive ? 'on' : 'off'}" style="font-size:20px;"></i>
          </button>
          <button class="acct-row-action" title="Reset password" data-reset-id="${a.id}">
            <i class="bi bi-key-fill"></i>
          </button>
          <button class="acct-row-action" title="More options" data-ctx-id="${a.id}">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>
      </div>`
        }).join('')

        // Mobile rows
        const mobRowsHTML = filtered.map((a, i) => {
            const status = getAccountStatus(a)
            const av = initials(a.fullName)
            const avColor = avatarColor(a.fullName)
            const ringCls = avatarRingClass(status)
            const delay = Math.min(i * 35, 350)
            const roleDisplay = getDisplayRole(a.role)

            return `
      <div class="aw-mob-row"
           style="animation-delay:${delay}ms;"
           data-account-id="${a.id}">
        <div class="${ringCls}" style="flex-shrink:0;">
          <div class="aw-avatar-inner" style="background:${avColor};color:#fff;">${av}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary);
                         white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.fullName}</span>
            ${statusBadgeHTML(status)}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="aw-role-pill" style="font-size:10px;padding:2px 8px;">
              <i class="bi bi-${getRoleIcon(a.role)}" style="font-size:10px;"></i>
              ${roleDisplay}
            </span>
          </div>
          <div style="margin-top:4px;">
            <span class="acct-mob-meta">
              <i class="bi bi-envelope"></i>
              ${a.email ?? 'No email linked'}
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
          <button class="acct-row-action ${a.isActive ? 'toggle-on' : 'toggle-off'}"
                  title="${a.isActive ? 'Deactivate' : 'Activate'}" data-toggle-id="${a.id}">
            <i class="bi bi-toggle-${a.isActive ? 'on' : 'off'}" style="font-size:22px;"></i>
          </button>
          <button class="acct-row-action" title="More options" data-ctx-id="${a.id}">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>
      </div>`
        }).join('')

        tableWrap.innerHTML = `
      <div class="aw-table-wrap">
        ${headerHTML}
        <div class="aw-table-body" id="acct-table-body">${rowsHTML}</div>
      </div>
      <div class="aw-mobile-rows" id="acct-mob-rows">${mobRowsHTML}</div>`

        this._bindTableEvents(tableWrap, filtered, canManage ?? false)
    }

    private _bindTableEvents(
        tableWrap: HTMLElement,
        filtered: UserProfileSummary[],
        canManage: boolean
    ): void {
        // Select all
        tableWrap.querySelector<HTMLInputElement>('#acct-select-all')
            ?.addEventListener('change', e => {
                const checked = (e.target as HTMLInputElement).checked
                this._state.selectedIds = checked ? new Set(filtered.map(a => a.id)) : new Set()
                this._bulkBar?.update(this._state.selectedIds)
                this._renderContent()
            })

        // Per-row checkboxes
        tableWrap.querySelectorAll<HTMLInputElement>('.acct-row-chk').forEach(chk => {
            chk.addEventListener('change', () => {
                const id = chk.dataset['id']!
                if (chk.checked) this._state.selectedIds.add(id)
                else this._state.selectedIds.delete(id)
                const row = tableWrap.querySelector(`[data-account-id="${id}"]`)
                row?.classList.toggle('selected', chk.checked)
                this._bulkBar?.update(this._state.selectedIds)
                // Update select-all state
                const allChk = tableWrap.querySelector<HTMLInputElement>('#acct-select-all')
                if (allChk) allChk.checked = this._state.selectedIds.size === filtered.length
            })
        })

        // Column header sort
        tableWrap.querySelectorAll<HTMLElement>('.aw-col-hd[data-sort]').forEach(hd => {
            hd.addEventListener('click', () => this._sortBy(hd.dataset['sort']!))
        })

        // Toggle buttons
        tableWrap.querySelectorAll<HTMLButtonElement>('[data-toggle-id]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation()
                const a = this._state.accounts.find(x => x.id === btn.dataset['toggleId'])
                if (a) this._quickToggle(a)
            })
        })

        // Reset buttons
        if (canManage) {
            tableWrap.querySelectorAll<HTMLButtonElement>('[data-reset-id]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation()
                    const a = this._state.accounts.find(x => x.id === btn.dataset['resetId'])
                    if (a) this._openResetModal(a)
                })
            })
        }

        // Context menu buttons
        tableWrap.querySelectorAll<HTMLButtonElement>('[data-ctx-id]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation()
                const a = this._state.accounts.find(x => x.id === btn.dataset['ctxId'])
                if (!a) return
                const rect = btn.getBoundingClientRect()
                this._openContextMenu(rect, a, canManage)
            })
        })

        // Row click → profile (future navigation)
        tableWrap.querySelectorAll<HTMLElement>('[data-account-id]').forEach(row => {
            row.addEventListener('click', e => {
                // Only navigate if not clicking a button/input
                if ((e.target as HTMLElement).closest('button, input')) return
                const id = row.dataset['accountId']
                if (id) {
                    // Future: navigate(`/admin/users/${id}`)
                    showToast(`View profile for ${this._state.accounts.find(a => a.id === id)?.fullName}`, 'info')
                }
            })
        })
    }

    // ── Filter banner ────────────────────────────────────────────────────────

    private _updateFilterBanner(): void {
        const el = this._container?.querySelector<HTMLElement>('#acct-filter-banner')
        if (!el) return
        const { statFilter, filtered } = this._state

        if (statFilter && statFilter !== 'all') {
            const labels: Record<string, string> = {
                active: 'Active', inactive: 'Inactive', admin: 'Administrators', all: 'All',
            }
            el.classList.add('show')
            el.innerHTML = `
        <i class="bi bi-funnel-fill" style="color:var(--caci-blue-light);"></i>
        <span class="aw-filter-pill">${labels[statFilter] ?? statFilter}</span>
        <span style="font-size:12px;color:var(--text-secondary);">
          ${filtered.length} result${filtered.length !== 1 ? 's' : ''}
        </span>
        <button class="aw-filter-clear" id="acct-clear-stat">
          <i class="bi bi-x"></i> Clear filter
        </button>`
            el.querySelector('#acct-clear-stat')?.addEventListener('click', () => {
                this._statsGroup?.clearFilter()
                this._state.statFilter = null
                this._applyFilters()
                this._renderContent()
                this._updateFilterBanner()
            })
        } else {
            el.classList.remove('show')
        }
    }

    // ── Quick toggle ─────────────────────────────────────────────────────────

    private async _quickToggle(account: UserProfileSummary): Promise<void> {
        const next = !account.isActive
        try {
            await setUserActive(account.id, next)
            showToast(`${account.fullName} ${next ? 'activated' : 'deactivated'}`, next ? 'success' : 'warning')
        } catch (err: any) {
            showToast(err?.message ?? 'Update failed', 'danger')
        }
    }

    // ── Bulk actions ─────────────────────────────────────────────────────────

    private async _bulkActivate(ids: Set<string>, active: boolean): Promise<void> {
        const n = ids.size
        let success = 0
        for (const id of ids) {
            try { await setUserActive(id, active); success++ } catch { /* continue */ }
        }
        showToast(`${active ? 'Activated' : 'Deactivated'} ${success} of ${n} account${n > 1 ? 's' : ''}`,
            active ? 'success' : 'warning')
        this._clearSelection()
        await this._reload()
    }

    private async _bulkReset(ids: Set<string>): Promise<void> {
        const n = ids.size
        let success = 0
        let failed = 0
        for (const id of ids) {
            try {
                // Find the member by account ID (user ID)
                const account = this._state.accounts.find(a => a.id === id || a.memberId === id)
                if (!account?.memberId) {
                    failed++
                    continue
                }
                await resetMemberPassword(account.memberId)
                success++
            } catch (error) {
                console.error(`Failed to reset password for account ${id}:`, error)
                failed++
            }
        }
        const message = failed > 0
            ? `Password reset for ${success} of ${n} account${n > 1 ? 's' : ''} (${failed} failed)`
            : `Password reset for ${success} of ${n} account${n > 1 ? 's' : ''}`
        showToast(message, failed > 0 ? 'warning' : 'success')
        this._clearSelection()
        await this._reload()
    }

    private _clearSelection(): void {
        this._state.selectedIds.clear()
        this._bulkBar?.update(this._state.selectedIds)
        this._renderContent()
    }

    // ── Context menu ─────────────────────────────────────────────────────────

    private _openContextMenu(
        rect: DOMRect,
        account: UserProfileSummary,
        canManage: boolean
    ): void {
        const items = [
            {
                id: 'view', label: 'View Profile', icon: 'eye-fill', variant: 'default' as const,
                onClick: () => showToast(`Opening profile for ${account.fullName}`, 'info'),
            },
            ...(canManage ? [
                {
                    id: 'edit', label: 'Edit Account', icon: 'pencil-fill', variant: 'default' as const,
                    divider: false,
                    onClick: () => this._openEditModal(account),
                },
                {
                    id: 'reset', label: 'Reset Password', icon: 'key-fill', variant: 'default' as const,
                    onClick: () => this._openResetModal(account),
                },
                {
                    id: 'toggle',
                    label: account.isActive ? 'Deactivate Account' : 'Activate Account',
                    icon: account.isActive ? 'slash-circle' : 'check-circle',
                    variant: (account.isActive ? 'danger' : 'success') as 'danger' | 'success',
                    divider: true,
                    onClick: () => this._quickToggle(account),
                },
                {
                    id: 'delete', label: 'Delete Account', icon: 'trash3-fill', variant: 'danger' as const,
                    onClick: () => this._openDeleteModal(account),
                },
            ] : []),
        ]

        this._ctxMenu.show(rect, items)
    }

    // ── Provision Modal ───────────────────────────────────────────────────────

    private async _openProvisionModal(): Promise<void> {
        // Load unprovisioned members async
        let members: { id: string; fullName: string; email: string | null }[] = []
        let assemblyRoles: { id: string; name: string }[] = []

        try {
            ;[members, assemblyRoles] = await Promise.all([
                listUnprovisionedMembers(),
                listAssemblyRoles().then(r => r.map(x => ({ id: x.id, name: x.name }))),
            ])
        } catch (err) {
            showToast('Failed to load member list', 'danger')
            return
        }

        let selectedPath: 'invite' | 'default_password' | 'custom_password' = 'default_password'

        const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Select Member</label>
        <select class="aw-form-select" id="prov-member">
          <option value="">Choose a member…</option>
          ${members.map(m => `<option value="${m.id}">${m.fullName}${m.email ? ' — ' + m.email : ''}</option>`).join('')}
        </select>
        <div class="aw-form-error" id="prov-member-err">Please select a member.</div>
      </div>

      <div class="aw-form-group">
        <label class="aw-form-label">System Role</label>
        <select class="aw-form-select" id="prov-role">
          <option value="member">Member</option>
          <option value="admin">Administrator</option>
          ${assemblyRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </div>

      <div class="aw-form-group">
        <label class="aw-form-label">Provisioning Method</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div class="acct-path-option selected" data-path="default_password">
            <div class="acct-path-option-icon" style="background:rgba(0,75,160,0.1);">
              <i class="bi bi-shield-fill-check" style="color:var(--caci-blue-light);"></i>
            </div>
            <div>
              <div class="acct-path-option-title">Assembly Default Password</div>
              <div class="acct-path-option-desc">Use the assembly's configured default password. Member logs in and changes on first use.</div>
            </div>
          </div>
          <div class="acct-path-option" data-path="invite">
            <div class="acct-path-option-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-envelope-at-fill" style="color:#22c55e;"></i>
            </div>
            <div>
              <div class="acct-path-option-title">Email Invite</div>
              <div class="acct-path-option-desc">Send a one-time magic link to the member's registered email address.</div>
            </div>
          </div>
          <div class="acct-path-option" data-path="custom_password">
            <div class="acct-path-option-icon" style="background:rgba(210,153,34,0.1);">
              <i class="bi bi-key-fill" style="color:#d29922;"></i>
            </div>
            <div>
              <div class="acct-path-option-title">Set Custom Password</div>
              <div class="acct-path-option-desc">Manually assign a temporary password — member must change it on login.</div>
            </div>
          </div>
        </div>
      </div>

      <div id="prov-custom-pwd-wrap" style="display:none;" class="aw-form-group">
        <label class="aw-form-label">Temporary Password</label>
        <div style="position:relative;">
          <input type="password" class="aw-form-inp" id="prov-pwd" placeholder="Min. 8 characters" style="padding-right:44px;">
          <button id="prov-pwd-toggle" type="button" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);display:flex;align-items:center;">
            <i class="bi bi-eye-fill" style="font-size:16px;"></i>
          </button>
        </div>
        <div class="aw-form-error" id="prov-pwd-err">Password must be at least 8 characters.</div>
      </div>

      <div class="acct-info-banner info">
        <i class="bi bi-info-circle-fill"></i>
        <p id="prov-info-text">The member will receive a login account using the assembly's default password. They will be prompted to change it on first login.</p>
      </div>`

        const footer = `
      <button class="aw-tbtn" id="prov-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="prov-submit">
        <i class="bi bi-person-plus-fill"></i>
        <span>Provision Account</span>
      </button>`

        const close = openModal({
            title: 'Provision Account',
            subtitle: 'Link a member to a login account',
            icon: 'person-plus-fill',
            iconBg: 'rgba(0,75,160,0.12)',
            iconColor: 'var(--caci-blue-light)',
            body,
            footer,
        })

        const overlay = document.getElementById('aw-shared-modal')!

        // Path selector
        overlay.querySelectorAll<HTMLElement>('.acct-path-option').forEach(opt => {
            opt.addEventListener('click', () => {
                overlay.querySelectorAll('.acct-path-option').forEach(o => o.classList.remove('selected'))
                opt.classList.add('selected')
                selectedPath = opt.dataset['path'] as typeof selectedPath

                const customWrap = overlay.querySelector<HTMLElement>('#prov-custom-pwd-wrap')!
                const infoText = overlay.querySelector<HTMLElement>('#prov-info-text')!

                customWrap.style.display = selectedPath === 'custom_password' ? '' : 'none'
                infoText.textContent = {
                    default_password: 'The member will receive a login account using the assembly\'s default password.',
          invite: 'A magic link will be emailed to the member. Link expires in 24 hours.',
                    custom_password: 'Set a temporary password — the member must change it on their first login.',
                }[selectedPath]
            })
        })

        // Password visibility toggle
        overlay.querySelector('#prov-pwd-toggle')?.addEventListener('click', () => {
            const inp = overlay.querySelector<HTMLInputElement>('#prov-pwd')!
            const icon = overlay.querySelector<HTMLElement>('#prov-pwd-toggle i')!
            inp.type = inp.type === 'password' ? 'text' : 'password'
            icon.className = `bi bi-eye${inp.type === 'password' ? '-fill' : '-slash-fill'}`
        })

        overlay.querySelector('#prov-cancel')?.addEventListener('click', close)

        overlay.querySelector('#prov-submit')?.addEventListener('click', async () => {
            const memberId = overlay.querySelector<HTMLSelectElement>('#prov-member')?.value ?? ''
            const role = overlay.querySelector<HTMLSelectElement>('#prov-role')?.value ?? 'member'
            const password = overlay.querySelector<HTMLInputElement>('#prov-pwd')?.value ?? ''
            const memberErr = overlay.querySelector<HTMLElement>('#prov-member-err')!
            const pwdErr = overlay.querySelector<HTMLElement>('#prov-pwd-err')!
            const submitBtn = overlay.querySelector<HTMLButtonElement>('#prov-submit')!

            // Validation
            let valid = true
            if (!memberId) { memberErr.classList.add('show'); valid = false } else memberErr.classList.remove('show')
            if (selectedPath === 'custom_password' && password.length < 8) {
                pwdErr.classList.add('show'); valid = false
            } else { pwdErr.classList.remove('show') }
            if (!valid) return

            submitBtn.disabled = true
            submitBtn.innerHTML = `<span class="aw-spinner"></span> Provisioning…`

            try {
                const payload: any = { memberId, role, path: selectedPath }
                if (selectedPath === 'custom_password') payload.password = password
                await provisionUser(payload)
                close()
                showToast(`Account provisioned successfully`, 'success')
                await this._reload()
            } catch (err: any) {
                submitBtn.disabled = false
                submitBtn.innerHTML = `<i class="bi bi-person-plus-fill"></i> Provision Account`
                memberErr.textContent = err?.message ?? 'Provisioning failed. Please try again.'
                memberErr.classList.add('show')
            }
        })
    }

    // ── Edit Modal ────────────────────────────────────────────────────────────

    private _openEditModal(account: UserProfileSummary): void {
        const status = getAccountStatus(account)
        const roleDisplay = getDisplayRole(account.role)

        const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Full Name</label>
        <input type="text" class="aw-form-inp" id="edit-name" value="${account.fullName}">
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">System Role</label>
        <select class="aw-form-select" id="edit-role">
          <option value="member"${account.role === 'member' ? ' selected' : ''}>Member</option>
          <option value="admin"${account.role === 'admin' ? ' selected' : ''}>Administrator</option>
        </select>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Account Status</label>
        <select class="aw-form-select" id="edit-status">
          <option value="active"${status === 'active' ? ' selected' : ''}>Active</option>
          <option value="inactive"${status === 'inactive' ? ' selected' : ''}>Inactive</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:12px;border-radius:var(--radius-sm);
                  background:var(--bg-page);border:1px solid var(--border-default);">
        <div>
          <p style="font-size:13px;font-weight:500;color:var(--text-primary);margin:0;">Force password change</p>
          <p style="font-size:11px;color:var(--text-secondary);margin:3px 0 0;">User must reset their password on next login</p>
        </div>
        <div class="aw-toggle" id="edit-must-change-toggle">
          <div class="aw-toggle-track"><div class="aw-toggle-thumb"></div></div>
        </div>
      </div>`

        const footer = `
      <button class="aw-tbtn" id="edit-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="edit-save">
        <i class="bi bi-check2-circle"></i>
        <span>Save Changes</span>
      </button>`

        const av = initials(account.fullName)
        const avColor = avatarColor(account.fullName)

        const close = openModal({
            title: 'Edit Account',
            subtitle: account.fullName,
            icon: 'pencil-fill',
            iconBg: 'rgba(0,75,160,0.12)',
            iconColor: 'var(--caci-blue-light)',
            body,
            footer,
        })

        const overlay = document.getElementById('aw-shared-modal')!

        overlay.querySelector('#edit-must-change-toggle')?.addEventListener('click', (e) => {
            ;(e.currentTarget as HTMLElement).querySelector('.aw-toggle-track')?.classList.toggle('on')
        })

        overlay.querySelector('#edit-cancel')?.addEventListener('click', close)

        overlay.querySelector('#edit-save')?.addEventListener('click', async () => {
            const role = overlay.querySelector<HTMLSelectElement>('#edit-role')?.value ?? 'member'
            const newStatus = overlay.querySelector<HTMLSelectElement>('#edit-status')?.value === 'active'
            const saveBtn = overlay.querySelector<HTMLButtonElement>('#edit-save')!

            saveBtn.disabled = true
            saveBtn.innerHTML = `<span class="aw-spinner"></span> Saving…`

            try {
                await Promise.all([
                    updateUserRole(account.id, role as any),
                    account.isActive !== newStatus ? setUserActive(account.id, newStatus) : Promise.resolve(),
                ])
                close()
                showToast('Account updated', 'success')
                await this._reload()
            } catch (err: any) {
                saveBtn.disabled = false
                saveBtn.innerHTML = `<i class="bi bi-check2-circle"></i> Save Changes`
                showToast(err?.message ?? 'Update failed', 'danger')
            }
        })
    }

    // ── Reset Password Modal ──────────────────────────────────────────────────

    private _openResetModal(account: UserProfileSummary): void {
        const av = initials(account.fullName)
        const avColor = avatarColor(account.fullName)
        const ringCls = avatarRingClass(getAccountStatus(account))

        const body = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0 16px;">
        <div class="${ringCls}" style="padding:3px;">
          <div class="aw-avatar-inner" style="background:${avColor};color:#fff;width:56px;height:56px;font-size:18px;">${av}</div>
        </div>
        <div style="text-align:center;">
          <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0;">${account.fullName}</p>
          ${account.email ? `<p style="font-size:11px;color:var(--text-muted);margin:3px 0 0;">${account.email}</p>` : ''}
        </div>
      </div>

      <div class="acct-radio-group">
        <label class="acct-radio-item">
          <input type="radio" name="reset-type" value="default" checked>
          <div>
            <div class="acct-radio-title">Use assembly default password</div>
            <div class="acct-radio-desc">Member will be required to change it on next login</div>
          </div>
        </label>
        <label class="acct-radio-item">
          <input type="radio" name="reset-type" value="custom" id="reset-custom-radio">
          <div>
            <div class="acct-radio-title">Set custom temporary password</div>
            <div class="acct-radio-desc">Specify a temporary password manually</div>
          </div>
        </label>
      </div>

      <div id="reset-custom-wrap" style="display:none;" class="aw-form-group">
        <label class="aw-form-label">New Temporary Password</label>
        <input type="password" class="aw-form-inp" id="reset-pwd" placeholder="Min. 8 characters">
        <div class="aw-form-error" id="reset-pwd-err">Password must be at least 8 characters.</div>
      </div>

      <div class="acct-info-banner warning">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <p>The user will be signed out of all active sessions immediately after the password is reset.</p>
      </div>`

        const footer = `
      <button class="aw-tbtn" id="reset-cancel">Cancel</button>
      <button class="aw-tbtn" id="reset-submit" style="
        background:rgba(210,153,34,0.1);border-color:rgba(210,153,34,0.3);color:#d29922;">
        <i class="bi bi-key-fill"></i>
        <span>Reset Password</span>
      </button>`

        const close = openModal({
            title: 'Reset Password',
            subtitle: account.fullName,
            icon: 'key-fill',
            iconBg: 'rgba(210,153,34,0.1)',
            iconColor: '#d29922',
            body,
            footer,
        })

        const overlay = document.getElementById('aw-shared-modal')!

        overlay.querySelector('#reset-custom-radio')?.addEventListener('change', (e) => {
            const wrap = overlay.querySelector<HTMLElement>('#reset-custom-wrap')!
            wrap.style.display = (e.target as HTMLInputElement).checked ? '' : 'none'
        })

        // Also hide wrap when switching back to default
        overlay.querySelectorAll<HTMLInputElement>('input[name="reset-type"]').forEach(r => {
            r.addEventListener('change', () => {
                const wrap = overlay.querySelector<HTMLElement>('#reset-custom-wrap')!
                wrap.style.display = r.value === 'custom' && r.checked ? '' : 'none'
            })
        })

        overlay.querySelector('#reset-cancel')?.addEventListener('click', close)

        overlay.querySelector('#reset-submit')?.addEventListener('click', async () => {
            const isCustom = overlay.querySelector<HTMLInputElement>('#reset-custom-radio')?.checked
            const password = overlay.querySelector<HTMLInputElement>('#reset-pwd')?.value ?? ''
            const pwdErr = overlay.querySelector<HTMLElement>('#reset-pwd-err')!
            const submitBtn = overlay.querySelector<HTMLButtonElement>('#reset-submit')!

            if (isCustom && password.length < 8) {
                pwdErr.classList.add('show')
                return
            }
            pwdErr.classList.remove('show')

            submitBtn.disabled = true
            submitBtn.innerHTML = `<span class="aw-spinner"></span> Resetting…`

            try {
                await resetMemberPassword(account.memberId ?? account.id, isCustom ? password : undefined)
                close()
                showToast('Password reset — user will be prompted on next login', 'success')
            } catch (err: any) {
                submitBtn.disabled = false
                submitBtn.innerHTML = `<i class="bi bi-key-fill"></i> Reset Password`
                showToast(err?.message ?? 'Reset failed', 'danger')
            }
        })
    }

    // ── Delete Account Modal ──────────────────────────────────────────────────

    private _openDeleteModal(account: UserProfileSummary): void {
        const body = `
      <div class="acct-info-banner danger" style="margin-bottom:16px;">
        <i class="bi bi-exclamation-triangle-fill" style="font-size:20px;"></i>
        <div>
          <p style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0 0 4px;">
            This action is permanent and cannot be undone
          </p>
          <p style="margin:0;">
            Deleting this account will permanently remove
            <strong style="color:var(--text-primary);">${account.fullName}</strong>'s
            login credentials, system profile, and all session data.
            The member record will be preserved but will no longer have a linked account.
          </p>
        </div>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Type the account holder's full name to confirm</label>
        <input type="text" class="aw-form-inp" id="delete-confirm"
               placeholder="${account.fullName}" autocomplete="off">
        <div class="aw-form-error" id="delete-err">Name does not match. Please type it exactly.</div>
      </div>`

        const footer = `
      <button class="aw-tbtn" id="delete-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-danger" id="delete-submit">
        <i class="bi bi-trash3-fill"></i>
        <span>Delete Account</span>
      </button>`

        const close = openModal({
            title: 'Delete Account',
            subtitle: account.fullName,
            icon: 'trash3-fill',
            iconBg: 'rgba(198,0,38,0.12)',
            iconColor: 'var(--caci-red)',
            body,
            footer,
        })

        const overlay = document.getElementById('aw-shared-modal')!

        overlay.querySelector('#delete-cancel')?.addEventListener('click', close)

        overlay.querySelector('#delete-submit')?.addEventListener('click', async () => {
            const confirmVal = overlay.querySelector<HTMLInputElement>('#delete-confirm')?.value.trim() ?? ''
            const errEl = overlay.querySelector<HTMLElement>('#delete-err')!
            const submitBtn = overlay.querySelector<HTMLButtonElement>('#delete-submit')!

            if (confirmVal !== account.fullName) {
                errEl.classList.add('show')
                return
            }
            errEl.classList.remove('show')

            submitBtn.disabled = true
            submitBtn.innerHTML = `<span class="aw-spinner"></span> Deleting…`

            try {
                await deleteMemberAuth(account.memberId ?? account.id)
                // Optimistically remove from local state so the row disappears instantly
                this._state.accounts = this._state.accounts.filter(a => a.id !== account.id)
                this._applyFilters()
                this._statsGroup?.update()
                this._renderContent()
                close()
                showToast(`${account.fullName}'s account has been permanently deleted`, 'success')
                // Background sync to confirm server state
                this._reload()
            } catch (err: any) {
                submitBtn.disabled = false
                submitBtn.innerHTML = `<i class="bi bi-trash3-fill"></i> Delete Account`
                showToast(err?.message ?? 'Delete failed', 'danger')
            }
        })
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    destroy(): void {
        this._destroyed = true
        off('account:provisioned', this._onProvisioned)
        off('account:roleChanged', this._onRoleChanged)
        off('account:suspended', this._onSuspended)
        off('account:reactivated', this._onReactivated)
        this._toolbar?.destroy()
        this._ctxMenu.close()
        document.getElementById('aw-shared-modal')?.remove()
        this._container = null
    }
}