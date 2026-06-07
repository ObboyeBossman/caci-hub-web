// src/modules/admin/tabs/HouseholdsTab.ts
// Fully functional Households tab.
// Shows households table, member count, primary contact, address.
// Create / Edit / Delete modals, member assignment panel, responsive table/card swap.

import { supabase }           from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { debounce }            from '@shared/utils/debounce'
import type { WorkspaceTab }   from '../workspace/AdminWorkspaceShell'
import {
  injectWidgetCSS,
  StatsCardGroup,
  Toolbar,
  ContextMenu,
  BulkActionBar,
  showToast,
  openModal,
  renderEmptyState,
  avatarColor,
  initials,
} from '../widgets/adminWidgets'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface HouseholdRow {
  id:               string
  familyName:       string
  address:          string | null
  primaryContactId: string | null
  primaryContact:   string | null
  memberCount:      number
  members:          { id: string; fullName: string }[]
  createdAt:        string
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY  (inline — households don't have a shared repo layer yet)
// ─────────────────────────────────────────────────────────────────────────────

async function listHouseholds(): Promise<HouseholdRow[]> {
  const aid = getActiveAssemblyId()
  let query = supabase
    .from('households')
    .select(`
      id, family_name, address, primary_contact_id, created_at,
      members!household_id(id, first_name, last_name)
    `)
    .order('family_name', { ascending: true })

  if (aid) query = query.eq('assembly_id', aid)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((h: any) => {
    const members: { id: string; fullName: string }[] =
      (h.members ?? []).map((m: any) => ({
        id:       m.id,
        fullName: `${m.first_name} ${m.last_name}`.trim(),
      }))

    const primaryContact = members.find(m => m.id === h.primary_contact_id)

    return {
      id:               h.id,
      familyName:       h.family_name,
      address:          h.address,
      primaryContactId: h.primary_contact_id,
      primaryContact:   primaryContact?.fullName ?? null,
      memberCount:      members.length,
      members,
      createdAt:        h.created_at,
    }
  })
}

async function createHousehold(payload: {
  familyName: string; address?: string
}): Promise<string> {
  const aid = getActiveAssemblyId()
  if (!aid) throw new Error('No active assembly')
  const { data, error } = await supabase
    .from('households')
    .insert({ assembly_id: aid, family_name: payload.familyName, address: payload.address ?? null } as any)
    .select('id').single()
  if (error) throw new Error(error.message)
  return (data as any).id
}

async function updateHousehold(id: string, payload: {
  familyName?: string; address?: string | null; primaryContactId?: string | null
}): Promise<void> {
  const update: any = {}
  if (payload.familyName      !== undefined) update.family_name         = payload.familyName
  if (payload.address         !== undefined) update.address              = payload.address
  if (payload.primaryContactId !== undefined) update.primary_contact_id = payload.primaryContactId
  const { error } = await supabase.from('households').update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

async function deleteHousehold(id: string): Promise<void> {
  // Unlink members first — set household_id → null for all members in this household
  await supabase.from('members').update({ household_id: null } as any).eq('household_id', id)
  const { error } = await supabase.from('households').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

async function listMembersWithoutHousehold(): Promise<{ id: string; fullName: string }[]> {
  const aid = getActiveAssemblyId()
  let query = supabase
    .from('members')
    .select('id, first_name, last_name')
    .is('household_id', null)
    .eq('is_active', true)
  if (aid) query = query.eq('assembly_id', aid)
  const { data } = await query.order('first_name', { ascending: true })
  return (data ?? []).map((m: any) => ({
    id: m.id,
    fullName: `${m.first_name} ${m.last_name}`.trim(),
  }))
}

async function assignMembersToHousehold(householdId: string, memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return
  const { error } = await supabase
    .from('members')
    .update({ household_id: householdId } as any)
    .in('id', memberIds)
  if (error) throw new Error(error.message)
}

async function removeMemberFromHousehold(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('members')
    .update({ household_id: null } as any)
    .eq('id', memberId)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const HOUSEHOLDS_CSS = /* css */`
/* ════════════════════════════════════════════════
   HOUSEHOLDS TAB  — scoped under .hh-*
════════════════════════════════════════════════ */

/* Table layout */
.hh-row-grid {
  grid-template-columns: 36px 1fr 160px 130px 120px 110px;
}
@media (max-width: 1000px) {
  .hh-row-grid { grid-template-columns: 36px 1fr 160px 130px 110px; }
  .hh-col-address { display: none !important; }
}
@media (max-width: 720px) {
  .hh-row-grid { grid-template-columns: 36px 1fr 130px 110px; }
  .hh-col-address,
  .hh-col-primary { display: none !important; }
}

.hh-family-icon {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(0,75,160,0.12), rgba(0,75,160,0.06));
  border: 1px solid rgba(0,75,160,0.2);
}
.hh-family-icon i { font-size: 18px; color: var(--caci-blue-light); }

.hh-member-av-stack { display: flex; align-items: center; }
.hh-av {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 700; color: #fff;
  border: 2px solid var(--bg-page);
  margin-left: -6px; flex-shrink: 0;
}
.hh-av:first-child { margin-left: 0; }
.hh-av-more {
  background: var(--bg-hover); color: var(--text-secondary);
  border-color: var(--border-default); font-size: 8px;
}

/* Mobile card */
.hh-mob-address {
  font-size: 11px; color: var(--text-muted);
  display: flex; align-items: center; gap: 4px;
}
.hh-mob-address i { font-size: 12px; }

/* Members panel inside manage modal */
.hh-member-list {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto; padding: 2px;
}
.hh-member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-page); transition: border-color 0.15s;
}
.hh-member-item:hover { border-color: var(--border-strong); }
.hh-member-name { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; }
.hh-member-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px;
  border-radius: 99px; background: rgba(0,75,160,0.08);
  border: 1px solid rgba(0,75,160,0.2); color: var(--caci-blue-light);
}
`

let _hhCSSInjected = false
function _injectHHCSS(): void {
  if (_hhCSSInjected) return
  _hhCSSInjected = true
  const s = document.createElement('style')
  s.id = 'hh-tab-css'
  s.textContent = HOUSEHOLDS_CSS
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// HOUSEHOLDS TAB
// ─────────────────────────────────────────────────────────────────────────────

export class HouseholdsTab implements WorkspaceTab {
  readonly id         = 'households'
  readonly label      = 'Households'
  readonly icon       = 'house-fill'
  readonly permission = 'admin.households.view'

  private _container: HTMLElement | null = null
  private _households: HouseholdRow[]    = []
  private _filtered:   HouseholdRow[]    = []
  private _search      = ''
  private _sortField   = 'name'
  private _sortAsc     = true
  private _statFilter: string | null     = null
  private _selectedIds = new Set<string>()
  private _destroyed   = false
  private _ctxMenu     = new ContextMenu()
  private _toolbar:    Toolbar | null = null
  private _bulkBar:    BulkActionBar | null = null
  private _statsGroup: StatsCardGroup | null = null

  async render(container: HTMLElement): Promise<void> {
    _injectHHCSS()
    injectWidgetCSS()
    this._container = container
    this._destroyed = false

    // Skeleton
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg);">
        <div class="aw-stats-row">
          ${[1,2,3].map(() => `<div style="height:90px;background:var(--bg-card);
            border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>`).join('')}
        </div>
        <div style="height:52px;background:var(--bg-card);border-radius:var(--radius-lg);
                    border:1px solid var(--border-default);"></div>
        <div style="height:400px;background:var(--bg-card);border-radius:var(--radius-lg);
                    border:1px solid var(--border-default);"></div>
      </div>`

    await this._loadData()
    if (this._destroyed) return
    this._buildUI()
  }

  private async _loadData(): Promise<void> {
    try {
      this._households = await listHouseholds()
      this._applyFilters()
    } catch (err) {
      console.error('[HouseholdsTab] load error', err)
    }
  }

  private async _reload(): Promise<void> {
    if (this._destroyed) return
    await this._loadData()
    this._statsGroup?.update()
    this._renderContent()
  }

  private _applyFilters(): void {
    const q = this._search.toLowerCase()
    this._filtered = this._households.filter(h => {
      const matchSearch = !q
        || h.familyName.toLowerCase().includes(q)
        || (h.address ?? '').toLowerCase().includes(q)
        || (h.primaryContact ?? '').toLowerCase().includes(q)
      const matchStat = !this._statFilter || this._statFilter === 'all'
        || (this._statFilter === 'large'  && h.memberCount >= 4)
        || (this._statFilter === 'single' && h.memberCount === 1)
        || (this._statFilter === 'empty'  && h.memberCount === 0)
      return matchSearch && matchStat
    })

    // Sort
    this._filtered.sort((a, b) => {
      let cmp = 0
      if (this._sortField === 'name')    cmp = a.familyName.localeCompare(b.familyName)
      if (this._sortField === 'members') cmp = a.memberCount - b.memberCount
      if (this._sortField === 'date')    cmp = a.createdAt.localeCompare(b.createdAt)
      return this._sortAsc ? cmp : -cmp
    })
  }

  private _buildUI(): void {
    if (!this._container || this._destroyed) return
    this._container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-lg);'
    this._container.appendChild(wrap)

    // Stats
    this._statsGroup = new StatsCardGroup(
      wrap,
      [
        {
          id: 'all', label: 'Total Households', icon: 'house-fill',
          accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.15)',
          getValue: () => this._households.length,
          getSub:   () => `${this._households.reduce((n, h) => n + h.memberCount, 0)} total members`,
        },
        {
          id: 'large', label: 'Large Families', icon: 'people-fill',
          accentColor: '#22c55e', glowColor: 'rgba(34,197,94,0.15)',
          getValue: () => this._households.filter(h => h.memberCount >= 4).length,
          getSub:   () => '4+ members',
        },
        {
          id: 'single', label: 'Single Members', icon: 'person-fill',
          accentColor: '#d29922', glowColor: 'rgba(210,153,34,0.15)',
          getValue: () => this._households.filter(h => h.memberCount === 1).length,
        },
        {
          id: 'empty', label: 'Empty', icon: 'house-slash-fill',
          accentColor: 'var(--caci-red)', glowColor: 'rgba(198,0,38,0.12)',
          getValue: () => this._households.filter(h => h.memberCount === 0).length,
        },
      ],
      (id: string | null) => {
        this._statFilter = id
        this._selectedIds.clear()
        this._applyFilters()
        this._renderContent()
        this._updateFilterBanner()
      }
    )

    // Bulk bar
    this._bulkBar = new BulkActionBar(
      wrap,
      [
        {
          id: 'delete', label: 'Delete Selected', icon: 'trash3-fill', variant: 'danger',
          onClick: (ids: Set<string>) => this._bulkDelete(ids),
        },
      ],
      () => this._clearSelection()
    )

    // Filter banner
    const bannerEl = document.createElement('div')
    bannerEl.className = 'aw-filter-banner'
    bannerEl.id = 'hh-filter-banner'
    wrap.appendChild(bannerEl)

    // Toolbar
    this._toolbar = new Toolbar(wrap, {
      searchPlaceholder: 'Search by family name, address, or contact…',
      actions: [
        {
          id: 'create', label: 'Create Household', icon: 'plus-lg', variant: 'primary',
          onClick: () => this._openCreateModal(),
        },
      ],
      onSearch: debounce((q: string) => {
        this._search = q
        this._applyFilters()
        this._renderContent()
      }, 220),
    })

    // Meta
    const meta = document.createElement('div')
    meta.className = 'aw-results-meta'
    meta.id = 'hh-meta'
    wrap.appendChild(meta)

    // Table + mobile
    const tableWrap = document.createElement('div')
    tableWrap.id = 'hh-table-wrap'
    wrap.appendChild(tableWrap)

    this._renderContent()
  }

  private _renderContent(): void {
    const tableWrap = this._container?.querySelector<HTMLElement>('#hh-table-wrap')
    const meta      = this._container?.querySelector<HTMLElement>('#hh-meta')
    if (!tableWrap) return

    const { filtered: list, selectedIds } = this

    if (meta) {
      meta.innerHTML = `
        <span>Showing <strong>${list.length}</strong> household${list.length !== 1 ? 's' : ''}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:var(--text-muted);">Sort</span>
          <select class="aw-sort-inline" id="hh-sort">
            <option value="name_az">Name A–Z</option>
            <option value="name_za">Name Z–A</option>
            <option value="most">Most Members</option>
            <option value="fewest">Fewest Members</option>
            <option value="newest">Newest</option>
          </select>
        </div>`

      meta.querySelector<HTMLSelectElement>('#hh-sort')
        ?.addEventListener('change', e => {
          const v = (e.target as HTMLSelectElement).value
          const sortMap: Record<string, [string, boolean]> = {
            name_az: ['name', true], name_za: ['name', false],
            most: ['members', false], fewest: ['members', true],
            newest: ['date', false],
          }
          const [field, asc] = sortMap[v] ?? ['name', true]
          this._sortField = field
          this._sortAsc   = asc
          this._applyFilters()
          this._renderContent()
        })
    }

    if (!list.length) {
      tableWrap.innerHTML = '<div class="aw-table-wrap"></div>'
      renderEmptyState(tableWrap.querySelector('.aw-table-wrap')!, {
        icon:        'house-slash',
        title:       this._search || this._statFilter ? 'No households found' : 'No households yet',
        description: 'Create a household to group members into family units.',
        action:      { label: 'Create Household', icon: 'plus-lg', onClick: () => this._openCreateModal() },
      })
      return
    }

    const colSortIcon = (field: string) => {
      if (this._sortField !== field) return '<i class="bi bi-arrow-down-up"></i>'
      return `<i class="bi bi-arrow-${this._sortAsc ? 'up' : 'down'}"></i>`
    }

    const header = `
      <div class="aw-table-header aw-table-row hh-row-grid" style="min-height:40px;cursor:default;">
        <div class="aw-col-cell">
          <input type="checkbox" class="aw-chk" id="hh-select-all"
            ${selectedIds.size === list.length && list.length > 0 ? 'checked' : ''}>
        </div>
        <div class="aw-col-hd${this._sortField === 'name' ? ' sorted' : ''}" data-sort="name">
          Household ${colSortIcon('name')}
        </div>
        <div class="aw-col-hd hh-col-primary">Primary Contact</div>
        <div class="aw-col-hd hh-col-address">Address</div>
        <div class="aw-col-hd${this._sortField === 'members' ? ' sorted' : ''}" data-sort="members">
          Members ${colSortIcon('members')}
        </div>
        <div class="aw-col-hd" style="justify-content:flex-end;">Actions</div>
      </div>`

    const rows = list.map((h, i) => {
      const sel   = selectedIds.has(h.id)
      const delay = Math.min(i * 35, 350)
      const previewMembers = h.members.slice(0, 4)
      const extra = h.memberCount - 4

      const avatarStack = previewMembers.length > 0
        ? `<div class="hh-member-av-stack">
            ${previewMembers.map(m => `
              <div class="hh-av" style="background:${avatarColor(m.fullName)};" title="${m.fullName}">
                ${initials(m.fullName)}
              </div>`).join('')}
            ${extra > 0 ? `<div class="hh-av hh-av-more">+${extra}</div>` : ''}
           </div>`
        : `<span style="font-size:11px;color:var(--text-muted);">No members</span>`

      return `
      <div class="aw-table-row hh-row-grid${sel ? ' selected' : ''}"
           style="animation:awFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) ${delay}ms both;"
           data-hh-id="${h.id}">
        <div class="aw-col-cell">
          <input type="checkbox" class="aw-chk hh-row-chk" data-id="${h.id}" ${sel ? 'checked' : ''}>
        </div>
        <div class="aw-col-cell" style="gap:12px;">
          <div class="hh-family-icon"><i class="bi bi-house-fill"></i></div>
          <div style="min-width:0;">
            <p style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.familyName}</p>
            <p style="font-size:10px;color:var(--text-muted);margin:2px 0 0;">
              Created ${new Date(h.createdAt).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}
            </p>
          </div>
        </div>
        <div class="aw-col-cell hh-col-primary">
          ${h.primaryContact
            ? `<div style="display:flex;align-items:center;gap:7px;">
                <div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;
                            background:${avatarColor(h.primaryContact)};
                            display:flex;align-items:center;justify-content:center;
                            font-size:8px;font-weight:700;color:#fff;">
                  ${initials(h.primaryContact)}
                </div>
                <span style="font-size:12px;color:var(--text-primary);white-space:nowrap;
                             overflow:hidden;text-overflow:ellipsis;">${h.primaryContact}</span>
               </div>`
            : `<span style="font-size:12px;color:var(--text-muted);">—</span>`}
        </div>
        <div class="aw-col-cell hh-col-address">
          <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap;
                       overflow:hidden;text-overflow:ellipsis;">${h.address ?? '—'}</span>
        </div>
        <div class="aw-col-cell" style="gap:10px;">
          ${avatarStack}
          <span style="font-size:12px;font-weight:600;color:var(--text-primary);">
            ${h.memberCount}
          </span>
        </div>
        <div class="aw-col-cell" style="justify-content:flex-end;gap:2px;">
          <button class="acct-row-action" title="Manage members" data-manage-id="${h.id}">
            <i class="bi bi-people-fill" style="font-size:15px;"></i>
          </button>
          <button class="acct-row-action" title="Edit" data-edit-hh-id="${h.id}">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="acct-row-action" title="More options" data-ctx-hh-id="${h.id}">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>
      </div>`
    }).join('')

    // Mobile rows
    const mobRows = list.map((h, i) => {
      const delay = Math.min(i * 35, 350)
      const previewMembers = h.members.slice(0, 3)
      return `
      <div class="aw-mob-row" style="animation-delay:${delay}ms;" data-hh-id="${h.id}">
        <div class="hh-family-icon" style="flex-shrink:0;"><i class="bi bi-house-fill"></i></div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0 0 3px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.familyName}</p>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="aw-badge aw-badge-active" style="font-size:10px;">
              <span class="aw-badge-dot"></span>
              ${h.memberCount} member${h.memberCount !== 1 ? 's' : ''}
            </span>
            ${h.primaryContact ? `
            <span style="font-size:11px;color:var(--text-secondary);">
              <i class="bi bi-person-fill" style="font-size:10px;"></i> ${h.primaryContact}
            </span>` : ''}
          </div>
          ${h.address ? `
          <div class="hh-mob-address" style="margin-top:4px;">
            <i class="bi bi-geo-alt-fill"></i>
            ${h.address}
          </div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="acct-row-action" title="Manage" data-manage-id="${h.id}">
            <i class="bi bi-people-fill" style="font-size:16px;"></i>
          </button>
          <button class="acct-row-action" title="More" data-ctx-hh-id="${h.id}">
            <i class="bi bi-three-dots-vertical" style="font-size:16px;"></i>
          </button>
        </div>
      </div>`
    }).join('')

    tableWrap.innerHTML = `
      <div class="aw-table-wrap">
        ${header}
        <div class="aw-table-body">${rows}</div>
      </div>
      <div class="aw-mobile-rows">${mobRows}</div>`

    this._bindTableEvents(tableWrap)
  }

  private get filtered() { return this._filtered }
  private get selectedIds() { return this._selectedIds }

  private _bindTableEvents(tableWrap: HTMLElement): void {
    // Select all
    tableWrap.querySelector<HTMLInputElement>('#hh-select-all')
      ?.addEventListener('change', e => {
        const checked = (e.target as HTMLInputElement).checked
        this._selectedIds = checked
          ? new Set(this._filtered.map(h => h.id))
          : new Set()
        this._bulkBar?.update(this._selectedIds)
        this._renderContent()
      })

    // Per-row checkbox
    tableWrap.querySelectorAll<HTMLInputElement>('.hh-row-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset['id']!
        if (chk.checked) this._selectedIds.add(id)
        else             this._selectedIds.delete(id)
        tableWrap.querySelector(`[data-hh-id="${id}"]`)?.classList.toggle('selected', chk.checked)
        this._bulkBar?.update(this._selectedIds)
        const allChk = tableWrap.querySelector<HTMLInputElement>('#hh-select-all')
        if (allChk) allChk.checked = this._selectedIds.size === this._filtered.length
      })
    })

    // Column sort headers
    tableWrap.querySelectorAll<HTMLElement>('.aw-col-hd[data-sort]').forEach(hd => {
      hd.addEventListener('click', () => {
        const f = hd.dataset['sort']!
        this._sortAsc = this._sortField === f ? !this._sortAsc : true
        this._sortField = f
        this._applyFilters()
        this._renderContent()
      })
    })

    // Manage members
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-manage-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const h = this._households.find(x => x.id === btn.dataset['manageId'])
        if (h) this._openManageModal(h)
      })
    })

    // Edit
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-edit-hh-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const h = this._households.find(x => x.id === btn.dataset['editHhId'])
        if (h) this._openEditModal(h)
      })
    })

    // Context menu
    tableWrap.querySelectorAll<HTMLButtonElement>('[data-ctx-hh-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const h = this._households.find(x => x.id === btn.dataset['ctxHhId'])
        if (!h) return
        this._ctxMenu.show(btn.getBoundingClientRect(), [
          { id: 'edit',   label: 'Edit Household', icon: 'pencil-fill',   onClick: () => this._openEditModal(h) },
          { id: 'manage', label: 'Manage Members', icon: 'people-fill',   onClick: () => this._openManageModal(h) },
          { id: 'delete', label: 'Delete Household', icon: 'trash3-fill', variant: 'danger', divider: true,
            onClick: () => this._confirmDelete(h) },
        ])
      })
    })

    // Row click → open manage modal
    tableWrap.querySelectorAll<HTMLElement>('[data-hh-id]').forEach(row => {
      row.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('button, input')) return
        const h = this._households.find(x => x.id === row.dataset['hhId'])
        if (h) this._openManageModal(h)
      })
    })
  }

  private _updateFilterBanner(): void {
    const el = this._container?.querySelector<HTMLElement>('#hh-filter-banner')
    if (!el) return
    if (this._statFilter && this._statFilter !== 'all') {
      const labels: Record<string, string> = {
        large: 'Large Families', single: 'Single Members', empty: 'Empty',
      }
      el.classList.add('show')
      el.innerHTML = `
        <i class="bi bi-funnel-fill" style="color:var(--caci-blue-light);"></i>
        <span class="aw-filter-pill">${labels[this._statFilter] ?? this._statFilter}</span>
        <span style="font-size:12px;color:var(--text-secondary);">
          ${this._filtered.length} result${this._filtered.length !== 1 ? 's' : ''}
        </span>
        <button class="aw-filter-clear" id="hh-clear-stat">
          <i class="bi bi-x"></i> Clear
        </button>`
      el.querySelector('#hh-clear-stat')?.addEventListener('click', () => {
        this._statsGroup?.clearFilter()
        this._statFilter = null
        this._applyFilters()
        this._renderContent()
        el.classList.remove('show')
      })
    } else {
      el.classList.remove('show')
    }
  }

  // ── Create Modal ─────────────────────────────────────────────────────────

  private _openCreateModal(): void {
    const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Family Name *</label>
        <input type="text" class="aw-form-inp" id="hh-new-name"
               placeholder="e.g. The Mensah Family" maxlength="80" autocomplete="off">
        <div class="aw-form-error" id="hh-name-err">Family name is required.</div>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Address</label>
        <input type="text" class="aw-form-inp" id="hh-new-addr"
               placeholder="Residential address" maxlength="200">
      </div>`

    const footer = `
      <button class="aw-tbtn" id="hh-create-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="hh-create-submit">
        <i class="bi bi-house-add-fill"></i>
        <span>Create Household</span>
      </button>`

    const close = openModal({
      title: 'Create Household', subtitle: 'Define a new family unit',
      icon: 'house-add-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    setTimeout(() => overlay.querySelector<HTMLInputElement>('#hh-new-name')?.focus(), 80)

    overlay.querySelector('#hh-create-cancel')?.addEventListener('click', close)
    overlay.querySelector('#hh-create-submit')?.addEventListener('click', async () => {
      const nameInp = overlay.querySelector<HTMLInputElement>('#hh-new-name')!
      const addrInp = overlay.querySelector<HTMLInputElement>('#hh-new-addr')!
      const nameErr = overlay.querySelector<HTMLElement>('#hh-name-err')!
      const btn     = overlay.querySelector<HTMLButtonElement>('#hh-create-submit')!
      const name    = nameInp.value.trim()

      if (!name) { nameErr.classList.add('show'); nameInp.focus(); return }
      nameErr.classList.remove('show')

      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Creating…`

      try {
        await createHousehold({ familyName: name, address: addrInp.value.trim() || undefined })
        close()
        showToast(`Household "${name}" created`, 'success')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-house-add-fill"></i> Create Household`
        nameErr.textContent = err?.message ?? 'Failed to create. Try again.'
        nameErr.classList.add('show')
      }
    })
  }

  // ── Edit Modal ────────────────────────────────────────────────────────────

  private _openEditModal(h: HouseholdRow): void {
    const primaryOptions = h.members.map(m =>
      `<option value="${m.id}"${m.id === h.primaryContactId ? ' selected' : ''}>${m.fullName}</option>`
    ).join('')

    const body = `
      <div class="aw-form-group">
        <label class="aw-form-label">Family Name *</label>
        <input type="text" class="aw-form-inp" id="hh-edit-name" value="${h.familyName}" maxlength="80">
        <div class="aw-form-error" id="hh-edit-err">Family name is required.</div>
      </div>
      <div class="aw-form-group">
        <label class="aw-form-label">Address</label>
        <input type="text" class="aw-form-inp" id="hh-edit-addr" value="${h.address ?? ''}" maxlength="200">
      </div>
      ${h.members.length > 0 ? `
      <div class="aw-form-group">
        <label class="aw-form-label">Primary Contact</label>
        <select class="aw-form-select" id="hh-edit-contact">
          <option value="">None</option>
          ${primaryOptions}
        </select>
      </div>` : ''}`

    const footer = `
      <button class="aw-tbtn" id="hh-edit-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-primary" id="hh-edit-save">
        <i class="bi bi-check2-circle"></i>
        <span>Save Changes</span>
      </button>`

    const close = openModal({
      title: 'Edit Household', subtitle: h.familyName,
      icon: 'pencil-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#hh-edit-cancel')?.addEventListener('click', close)

    overlay.querySelector('#hh-edit-save')?.addEventListener('click', async () => {
      const nameInp    = overlay.querySelector<HTMLInputElement>('#hh-edit-name')!
      const addrInp    = overlay.querySelector<HTMLInputElement>('#hh-edit-addr')!
      const contactSel = overlay.querySelector<HTMLSelectElement>('#hh-edit-contact')
      const nameErr    = overlay.querySelector<HTMLElement>('#hh-edit-err')!
      const btn        = overlay.querySelector<HTMLButtonElement>('#hh-edit-save')!
      const name       = nameInp.value.trim()

      if (!name) { nameErr.classList.add('show'); return }
      nameErr.classList.remove('show')

      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Saving…`

      try {
        await updateHousehold(h.id, {
          familyName:       name,
          address:          addrInp.value.trim() || null,
          primaryContactId: contactSel?.value || null,
        })
        close()
        showToast('Household updated', 'success')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-check2-circle"></i> Save Changes`
        showToast(err?.message ?? 'Update failed', 'danger')
      }
    })
  }

  // ── Manage Members Modal ──────────────────────────────────────────────────

  private async _openManageModal(h: HouseholdRow): Promise<void> {
    // Load unassigned members to add
    let available: { id: string; fullName: string }[] = []
    try { available = await listMembersWithoutHousehold() } catch { /* ignore */ }

    const currentMembersHTML = h.members.length > 0
      ? h.members.map(m => `
        <div class="hh-member-item">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;
                      background:${avatarColor(m.fullName)};
                      display:flex;align-items:center;justify-content:center;
                      font-size:9px;font-weight:700;color:#fff;">
            ${initials(m.fullName)}
          </div>
          <span class="hh-member-name">${m.fullName}</span>
          ${m.id === h.primaryContactId
            ? `<span class="hh-member-badge">Primary</span>`
            : ''}
          <button class="acct-row-action" title="Remove from household"
                  data-remove-member-id="${m.id}" style="margin-left:auto;flex-shrink:0;">
            <i class="bi bi-dash-circle" style="font-size:14px;color:var(--caci-red);"></i>
          </button>
        </div>`).join('')
      : `<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">
           No members in this household yet.
         </p>`

    const addSection = available.length > 0
      ? `
        <div class="aw-form-group" style="margin-top:12px;">
          <label class="aw-form-label">Add Members</label>
          <select class="aw-form-select" id="hh-add-member-sel" multiple
                  style="height:120px;padding:6px;">
            ${available.map(m => `<option value="${m.id}">${m.fullName}</option>`).join('')}
          </select>
          <p style="font-size:11px;color:var(--text-muted);margin:4px 0 0;">
            Hold Ctrl / Cmd to select multiple members.
          </p>
        </div>`
      : `<p style="font-size:12px;color:var(--text-muted);margin-top:12px;">
           All active members are already assigned to a household.
         </p>`

    const body = `
      <div>
        <p style="font-size:12px;font-weight:600;color:var(--text-secondary);
                  text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          Current Members (${h.memberCount})
        </p>
        <div class="hh-member-list">${currentMembersHTML}</div>
      </div>
      ${addSection}`

    const footer = `
      ${available.length > 0
        ? `<button class="aw-tbtn aw-tbtn-primary" id="hh-add-members-btn">
             <i class="bi bi-person-plus-fill"></i>
             <span>Add Selected</span>
           </button>`
        : ''}
      <button class="aw-tbtn" id="hh-manage-done">Done</button>`

    const close = openModal({
      title: `Manage Members`, subtitle: h.familyName,
      icon: 'people-fill', iconBg: 'rgba(0,75,160,0.12)', iconColor: 'var(--caci-blue-light)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#hh-manage-done')?.addEventListener('click', close)

    // Remove member
    overlay.querySelectorAll<HTMLButtonElement>('[data-remove-member-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        try {
          await removeMemberFromHousehold(btn.dataset['removeMemberId']!)
          showToast('Member removed from household', 'warning')
          close()
          await this._reload()
        } catch (err: any) {
          btn.disabled = false
          showToast(err?.message ?? 'Remove failed', 'danger')
        }
      })
    })

    // Add members
    overlay.querySelector('#hh-add-members-btn')?.addEventListener('click', async () => {
      const sel  = overlay.querySelector<HTMLSelectElement>('#hh-add-member-sel')!
      const ids  = [...sel.selectedOptions].map(o => o.value)
      if (!ids.length) { showToast('Select at least one member to add', 'info'); return }
      const btn  = overlay.querySelector<HTMLButtonElement>('#hh-add-members-btn')!
      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Adding…`
      try {
        await assignMembersToHousehold(h.id, ids)
        showToast(`${ids.length} member${ids.length !== 1 ? 's' : ''} added to household`, 'success')
        close()
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-person-plus-fill"></i> Add Selected`
        showToast(err?.message ?? 'Failed to add members', 'danger')
      }
    })
  }

  // ── Delete Confirm ────────────────────────────────────────────────────────

  private _confirmDelete(h: HouseholdRow): void {
    const body = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0;">
        <div style="width:52px;height:52px;border-radius:50%;
                    background:rgba(198,0,38,0.1);border:1px solid rgba(198,0,38,0.25);
                    display:flex;align-items:center;justify-content:center;">
          <i class="bi bi-trash3-fill" style="font-size:22px;color:var(--caci-red);"></i>
        </div>
        <div style="text-align:center;max-width:320px;">
          <p style="font-size:15px;font-weight:700;color:var(--text-primary);margin:0 0 6px;">
            Delete "${h.familyName}"?
          </p>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0;">
            ${h.memberCount > 0
              ? `${h.memberCount} member${h.memberCount !== 1 ? 's' : ''} will be unlinked from this household. Their member records will not be affected.`
              : `This household will be permanently deleted.`}
          </p>
        </div>
      </div>`

    const footer = `
      <button class="aw-tbtn" id="hh-del-cancel">Cancel</button>
      <button class="aw-tbtn aw-tbtn-danger" id="hh-del-confirm">
        <i class="bi bi-trash3-fill"></i>
        <span>Delete Household</span>
      </button>`

    const close = openModal({
      title: 'Delete Household', subtitle: h.familyName,
      icon: 'trash3-fill', iconBg: 'rgba(198,0,38,0.1)', iconColor: 'var(--caci-red)',
      body, footer,
    })

    const overlay = document.getElementById('aw-shared-modal')!
    overlay.querySelector('#hh-del-cancel')?.addEventListener('click', close)

    overlay.querySelector('#hh-del-confirm')?.addEventListener('click', async () => {
      const btn = overlay.querySelector<HTMLButtonElement>('#hh-del-confirm')!
      btn.disabled = true
      btn.innerHTML = `<span class="aw-spinner"></span> Deleting…`
      try {
        await deleteHousehold(h.id)
        close()
        showToast(`"${h.familyName}" deleted`, 'warning')
        await this._reload()
      } catch (err: any) {
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-trash3-fill"></i> Delete Household`
        showToast(err?.message ?? 'Delete failed', 'danger')
      }
    })
  }

  private async _bulkDelete(ids: Set<string>): Promise<void> {
    const n = ids.size
    let success = 0
    for (const id of ids) {
      try { await deleteHousehold(id); success++ } catch { /* continue */ }
    }
    showToast(`Deleted ${success} of ${n} household${n !== 1 ? 's' : ''}`, 'warning')
    this._clearSelection()
    await this._reload()
  }

  private _clearSelection(): void {
    this._selectedIds.clear()
    this._bulkBar?.update(this._selectedIds)
    this._renderContent()
  }

  destroy(): void {
    this._destroyed = true
    this._toolbar?.destroy()
    this._ctxMenu.close()
    document.getElementById('aw-shared-modal')?.remove()
    this._container = null
  }
}