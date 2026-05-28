// src/modules/membership/pages/MemberList.ts
// The primary member directory page.
// Presentation layer only — all data flows through repository.ts + memberService.ts.
//
// Renders:
//   - Sub-nav tabs (Members, Attendance, Groups, Pastoral Care, Reports)
//   - Left sidebar: quick access nav + filters + quick stats
//   - Stats row (4 cards)
//   - Toolbar: search, sort, grid/list toggle, export, add member
//   - Bulk action bar
//   - Grid view (cards) | List view (table)
//   - Empty state
//   - Pagination
//   - Right-side detail panel (slides in)
//   - Add / Edit member modal (right drawer)
//
// Sub-pages (Attendance, Groups, Pastoral Care, Reports) are rendered inline
// inside the same page container via tab switching — they do NOT have
// their own route. This matches the reference HTML's single-page design.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import type { MemberView, MemberFilter } from '../../../types/member.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getCurrentUser } from '@core/auth'
import { hasPermission } from '@core/permissions'
import {
  listMembers,
  getMemberCounts,
  deactivateMember,
  updateMember,
} from '../repository'
import { registerMember, exportMembersCsv, downloadCsv } from '../services/memberService'
import { CreateMemberSchema, UpdateMemberSchema } from '../schemas/member.schema'
import { avatarColor, initials, statusBadge, fmtDate, injectMembershipCSS } from '../utils/member-helpers'

// ── Page constants ────────────────────────────────────────────────────────────
const PAGE_SIZE = 12

/** Tabs that are under development — block switching to them */
const COMING_SOON_TABS = new Set(['attendance', 'groups', 'pastoral', 'reports'])

// ── State ─────────────────────────────────────────────────────────────────────

interface State {
  members: MemberView[]
  filtered: MemberView[]
  loading: boolean
  view: 'grid' | 'list'
  search: string
  sortMode: string
  activeTab: string
  sidebarFilter: string
  selectedIds: Set<string>
  page: number
  // filter state
  statusFilters: Set<string>
  genderFilters: Set<string>
  // attendance
  attSessions: AttSession[]
  currentAttId: string | null
  memberAtt: Record<string, 'present' | 'absent' | 'excused'>
  // groups
  groups: Group[]
  // pastoral
  pcFlags: PcFlag[]
  pcFirstTimers: PcFirstTimer[]
  pcLifeEvents: PcLifeEvent[]
  // detail panel
  detailMember: MemberView | null
  // modal
  editingId: string | null
}

interface AttSession {
  id: string; name: string; type: string; date: string; time: string
  present: number; absent: number; excused: number
}

interface Group {
  id: string; name: string; type: string; leader: string
  members: number; day: string; desc: string
}

interface PcFlag {
  id: string; member: string; type: string; reason: string
  date: string; assignTo: string; priority: string; resolved: boolean
}

interface PcFirstTimer {
  name: string; date: string; phone: string; followedUp: boolean
}

interface PcLifeEvent {
  name: string; event: string; date: string; type: string
}

// ── Page module ───────────────────────────────────────────────────────────────

const MemberList: PageModule = {
  render,
  destroy,
}
export default MemberList

let _container: HTMLElement | null = null
let _state: State | null = null
let _searchDebounce: ReturnType<typeof setTimeout> | null = null

async function render(container: HTMLElement): Promise<void> {
  _container = container
  renderSkeleton(container, 'table')

  // Inject CSS
  _injectCSS()

  // Build initial state (reads current hash to determine tab)
  _state = _buildInitialState()

  // Build full shell HTML
  container.innerHTML = _buildHTML()
  container.querySelector('.mm-root')!.classList.add('mm-root') // ensure token root

  // Load real data
  try {
    await _loadMembers()
    _populateHouseholdsDropdown()
  } catch (err) {
    renderError(container, err, { retry: () => render(container) })
    return
  }

  _bindAll()
  _setTab(_state.activeTab)
  _renderMembers()
  await _renderStats()
}

function destroy(): void {
  if (_searchDebounce) clearTimeout(_searchDebounce)
  _container = null
  _state = null
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function _loadMembers(): Promise<void> {
  if (!_state) return
  _state.loading = true

  const filter: MemberFilter = {
    statuses: _state.statusFilters.size
      ? [..._state.statusFilters] as MemberView['membership_status'][]
      : undefined,
    gender: _state.genderFilters.size === 1
      ? [..._state.genderFilters][0] as 'male' | 'female'
      : undefined,
    searchQuery: _state.search || undefined,
    includeDeleted: false,
  }

  _state.members = await listMembers(filter, { limit: 500, sortBy: 'last_name', ascending: true })
  _state.filtered = _state.members
  _state.loading = false
}

async function _populateHouseholdsDropdown(): Promise<void> {
  // lazy import to avoid top-level circular deps
  const { getHouseholdDropdownItems } = await import('../repository')
  const items = await getHouseholdDropdownItems()
  const sel = _container?.querySelector<HTMLSelectElement>('#mm-fHousehold')
  if (!sel) return
  sel.innerHTML = '<option value="">None</option>'
  items.forEach(h => {
    const o = document.createElement('option')
    o.value = h.id
    o.textContent = h.family_name
    sel.appendChild(o)
  })
}

// ── Filtering / sorting ───────────────────────────────────────────────────────

function _applyFilters(): void {
  if (!_state) return
  const q = _state.search.toLowerCase()

  _state.filtered = _state.members.filter(m => {
    // sidebar quick filter
    if (_state!.sidebarFilter === 'active' && m.membership_status !== 'active') return false
    if (_state!.sidebarFilter === 'visitor' && m.membership_status !== 'visitor') return false
    if (_state!.sidebarFilter === 'recent') {
      const joined = m.join_date ?? m.created_at
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
      if (new Date(joined) < cutoff) return false
    }
    // status checkbox filters
    if (_state!.statusFilters.size > 0 && !_state!.statusFilters.has(m.membership_status))
      return false
    // gender checkbox filters
    if (_state!.genderFilters.size > 0 && !_state!.genderFilters.has(m.gender))
      return false
    // search
    if (q) {
      const full = `${formatName(m.first_name, m.last_name, m.title)}`.toLowerCase()
      const num = (m.membership_number ?? '').toLowerCase()
      const ph = (m.primary_phone ?? '').toLowerCase()
      const occ = (m.occupation ?? '').toLowerCase()
      if (!full.includes(q) && !num.includes(q) && !ph.includes(q) && !occ.includes(q))
        return false
    }
    return true
  })

  // sort
  _state.filtered.sort((a, b) => {
    switch (_state!.sortMode) {
      case 'name-asc': return `${formatName(a.first_name, a.last_name, a.title)}`.localeCompare(`${formatName(b.first_name, b.last_name, b.title)}`)
      case 'name-desc': return `${formatName(b.first_name, b.last_name, b.title)}`.localeCompare(`${formatName(a.first_name, a.last_name, a.title)}`)
      case 'joined-asc': return (a.join_date ?? a.created_at).localeCompare(b.join_date ?? b.created_at)
      case 'joined-desc': return (b.join_date ?? b.created_at).localeCompare(a.join_date ?? a.created_at)
      case 'status': return a.membership_status.localeCompare(b.membership_status)
      default: return 0
    }
  })
}

// ── Render helpers ────────────────────────────────────────────────────────────

function _renderMembers(): void {
  if (!_state || !_container) return
  _applyFilters()

  const { filtered, page, view, selectedIds } = _state
  const start = (page - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

  // Results count
  const vc = _container.querySelector('#mm-visibleCount')
  if (vc) vc.textContent = String(filtered.length)

  // Grid view
  const gridEl = _container.querySelector<HTMLElement>('#mm-gridView')
  if (gridEl) {
    gridEl.innerHTML = pageItems.map(m => _gridCard(m, selectedIds.has(m.id))).join('')
    gridEl.style.display = view === 'grid' ? 'grid' : 'none'
  }

  // List view
  const tbody = _container.querySelector<HTMLElement>('#mm-tableBody')
  if (tbody) tbody.innerHTML = pageItems.map(m => _tableRow(m, selectedIds.has(m.id))).join('')

  const listWrap = _container.querySelector<HTMLElement>('#mm-listView')
  if (listWrap) listWrap.style.display = view === 'list' ? 'block' : 'none'

  // Empty state
  const empty = _container.querySelector<HTMLElement>('#mm-emptyState')
  if (empty) {
    const show = filtered.length === 0
    empty.classList.toggle('show', show)
    if (gridEl && show) gridEl.style.display = 'none'
  }

  // Pagination
  _renderPagination()

  // Re-bind row-level events
  _bindRowEvents()
}

async function _renderStats(): Promise<void> {
  if (!_state || !_container) return

  // 1. Fetch server-side accurate totals for main tab nav
  const counts = await getMemberCounts()

  // 2. Local filtering for small sidebar quick stats (stays based on loaded subset)
  const m = _state.members

  const update = (id: string, val: string) => {
    const el = _container!.querySelector(`#${id}`)
    if (el) el.textContent = val
  }

  const updateBar = (id: string, val: number, total: number) => {
    const el = _container!.querySelector<HTMLElement>(`#${id}`)
    if (el) {
      const pct = total > 0 ? Math.round((val / total) * 100) : 0
      el.style.width = `${pct}%`
    }
  }

  // Accurate Tab Badges
  update('mm-subnav-count', String(counts.total)) // Top sub-nav tab
  update('mm-nav-count-all', String(counts.total)) // Sidebar
  update('mm-nav-count-active', String(counts.active))
  update('mm-nav-count-visitor', String(counts.visitor))
  update('mm-nav-count-new', String(counts.new))

  // Main Stat Cards
  update('mm-stat-total', String(counts.total))
  update('mm-stat-active', String(counts.active))
  update('mm-stat-visitors', String(counts.visitor))
  update('mm-stat-new', String(counts.new))
  update('mm-stat-total-pct', `${counts.active} active (${counts.total ? Math.round(counts.active / counts.total * 100) : 0}%)`)
  
  updateBar('mm-stat-total-bar', counts.active, counts.total)
  updateBar('mm-stat-active-bar', counts.active, counts.total)
  updateBar('mm-stat-visitors-bar', counts.visitor, counts.total)
  updateBar('mm-stat-new-bar', counts.new, counts.total)

  // Sidebar quick stats (typically reflects the "Current Assembly" active view)
  const inc = m.filter(x => x.membership_status === 'inactive').length
  const pro = m.filter(x => x.membership_status === 'prospect').length
  
  update('mm-qs-active', String(counts.active))
  update('mm-qs-visitor', String(counts.visitor))
  update('mm-qs-inactive', String(inc))
  update('mm-qs-prospect', String(pro))

  updateBar('mm-qs-active-bar', counts.active, counts.total)
  updateBar('mm-qs-visitor-bar', counts.visitor, counts.total)
  updateBar('mm-qs-inactive-bar', inc, counts.total)
  updateBar('mm-qs-prospect-bar', pro, counts.total)
}

function _renderPagination(): void {
  if (!_state || !_container) return
  const { filtered, page } = _state
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, filtered.length)

  const info = _container.querySelector('#mm-paginationInfo')
  if (info) info.textContent = `Showing ${start}–${end} of ${filtered.length} results`

  const pageInfo = _container.querySelector('#mm-pageInfo')
  if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages || 1}`

  const btns = _container.querySelector('#mm-pageBtns')
  if (!btns) return

  const pages: number[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push(-1) // ellipsis
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push(-1)
    pages.push(totalPages)
  }

  btns.innerHTML = `
    <button class="mm-page-btn ${page === 1 ? 'disabled' : ''}" id="mm-prevPage">← Prev</button>
    ${pages.map(p => p === -1
    ? `<span style="padding:0 2px;color:var(--mm-text-muted);font-size:13px;align-self:center;">…</span>`
    : `<button class="mm-page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
  ).join('')}
    <button class="mm-page-btn ${page >= totalPages ? 'disabled' : ''}" id="mm-nextPage">Next →</button>
  `

  btns.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state!.page = parseInt(btn.dataset['page']!)
      _renderMembers()
    })
  })
  btns.querySelector('#mm-prevPage')?.addEventListener('click', () => {
    if (_state!.page > 1) { _state!.page--; _renderMembers() }
  })
  btns.querySelector('#mm-nextPage')?.addEventListener('click', () => {
    const total = Math.ceil(_state!.filtered.length / PAGE_SIZE)
    if (_state!.page < total) { _state!.page++; _renderMembers() }
  })
}

// ── Card / row templates ──────────────────────────────────────────────────────

function _gridCard(m: MemberView, selected: boolean): string {
  const s = statusBadge(m.membership_status)
  const bg = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
  const ini = initials(m.first_name, m.last_name)
  const gCls = m.gender === 'female' ? 'purple' : ''
  return `
<div class="mm-member-card ${selected ? 'selected' : ''}" data-member-id="${m.id}">
  <div class="mm-card-check"></div>
  <div class="mm-card-avatar" style="background:${bg}">${ini}</div>
  <div class="mm-card-name">${formatName(m.first_name, m.last_name, m.title)}</div>
  <div class="mm-card-id">${m.membership_number ?? '—'}</div>
  <div class="mm-card-role">${m.occupation ?? 'Member'}</div>
  <div class="mm-card-footer">
    <div class="mm-card-tags">
      <span class="mm-badge ${s.cls}">${s.label}</span>
      <span class="mm-badge ${gCls}">${m.gender === 'female' ? 'F' : 'M'}</span>
    </div>
    <button class="mm-btn-outline" style="padding:3px 10px;font-size:11px;" data-view-id="${m.id}">View</button>
  </div>
</div>`
}

function _tableRow(m: MemberView, selected: boolean): string {
  const s = statusBadge(m.membership_status)
  const bg = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
  const ini = initials(m.first_name, m.last_name)
  return `
<tr data-row-id="${m.id}">
  <td class="mm-col-check">
    <div class="mm-table-cb ${selected ? 'checked' : ''}" data-row-check="${m.id}"></div>
  </td>
  <td>
    <div class="mm-table-name-cell">
      <div class="mm-table-avatar" style="background:${bg}">${ini}</div>
      <div>
        <div class="mm-table-name">${formatName(m.first_name, m.last_name, m.title)}</div>
        <div class="mm-table-email">${m.email ?? '—'}</div>
      </div>
    </div>
  </td>
  <td style="font-size:12px;font-family:monospace;color:var(--mm-text-muted);">${m.membership_number ?? '—'}</td>
  <td><span class="mm-badge ${s.cls}">${s.label}</span></td>
  <td style="font-size:12px;">${m.occupation ?? '—'}</td>
  <td style="font-size:12px;">${fmtDate(m.join_date)}</td>
  <td class="mm-col-actions">
    <div class="mm-table-actions">
      <button class="mm-btn-icon" data-view-id="${m.id}" title="View profile">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="mm-btn-icon" data-edit-id="${m.id}" title="Edit">
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="mm-btn-icon" data-deactivate-id="${m.id}" title="Deactivate">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </button>
    </div>
  </td>
</tr>`
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function _openDetail(m: MemberView): void {
  if (!_state || !_container) return
  _state.detailMember = m
  const panel = _container.querySelector('#mm-detailPanel')!
  const overlay = _container.querySelector('#mm-detailOverlay')!
  const body = _container.querySelector<HTMLElement>('#mm-detailBody')!
  const bg = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
  const ini = initials(m.first_name, m.last_name)
  const s = statusBadge(m.membership_status)
  
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

  body.innerHTML = `
<div class="mm-detail-tabs">
  <button class="mm-detail-tab active" data-dp-tab="profile">Profile</button>
  <button class="mm-detail-tab" data-dp-tab="attendance">Attendance</button>
  <button class="mm-detail-tab" data-dp-tab="notes">Notes</button>
</div>

<div class="mm-detail-tab-panel active" id="mm-dp-profile">
  <div class="mm-detail-avatar-wrap">
    <div class="mm-detail-avatar" style="background:${bg}">${ini}</div>
    <div class="mm-detail-name">${m.title ? m.title + ' ' : ''}${formatName(m.first_name, m.last_name, m.title)}</div>
    <div class="mm-detail-id">${m.membership_number ?? 'No number yet'}</div>
    <div class="mm-detail-badges">
      <span class="mm-badge ${s.cls}">${s.label}</span>
      <span class="mm-badge ${m.gender === 'female' ? 'purple' : ''}">${m.gender}</span>
      ${m.marital_status ? `<span class="mm-badge">${m.marital_status}</span>` : ''}
      ${m.auth_user_id ? `<span class="mm-badge" style="background:#e0f2fe;color:#0369a1;border-color:#b9e6fe;"><i class="bi bi-shield-check"></i> Login active</span>` : ''}
    </div>
  </div>

  <div class="mm-detail-section">
    <div class="mm-detail-section-title">Contact</div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Primary Phone</span><span class="mm-detail-field-val">${m.primary_phone ?? '—'}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Secondary Phone</span><span class="mm-detail-field-val">${m.secondary_phone ?? '—'}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Email</span><span class="mm-detail-field-val" style="font-size:12px;word-break:break-all;">${m.email ?? '—'}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Address</span><span class="mm-detail-field-val" style="font-size:12px;">${m.physical_address ?? '—'}</span></div>
  </div>

  <div class="mm-detail-section">
    <div class="mm-detail-section-title">Church Info</div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Status</span><span class="mm-detail-field-val"><span class="mm-badge ${s.cls}">${s.label}</span></span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Joined</span><span class="mm-detail-field-val">${fmtDate(m.join_date)}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Membership #</span><span class="mm-detail-field-val" style="font-family:monospace;font-size:12px;">${m.membership_number ?? '—'}</span></div>
  </div>

  <div class="mm-detail-section">
    <div class="mm-detail-section-title">Personal</div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Date of Birth</span><span class="mm-detail-field-val">${fmtDate(m.date_of_birth)}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Marital Status</span><span class="mm-detail-field-val">${m.marital_status ?? '—'}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Occupation</span><span class="mm-detail-field-val">${m.occupation ?? '—'}</span></div>
  </div>

  ${m.emergency_contact_name ? `
  <div class="mm-detail-section">
    <div class="mm-detail-section-title">Emergency Contact</div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Name</span><span class="mm-detail-field-val">${m.emergency_contact_name}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Phone</span><span class="mm-detail-field-val">${m.emergency_contact_phone ?? '—'}</span></div>
    <div class="mm-detail-field"><span class="mm-detail-field-label">Relationship</span><span class="mm-detail-field-val">${m.emergency_contact_relationship ?? '—'}</span></div>
  </div>` : ''}

  ${m.pastoral_notes ? `
  <div class="mm-detail-section">
    <div class="mm-detail-section-title">Pastoral Notes</div>
    <div style="font-size:13px;color:var(--mm-text-primary);line-height:1.6;">${m.pastoral_notes}</div>
  </div>` : ''}

  <div class="mm-detail-actions">
    <button class="mm-btn-primary" data-edit-id="${m.id}">Edit Profile</button>
    <button class="mm-btn-outline" id="mm-detail-sms">Send SMS</button>
    <button class="mm-btn-danger" id="mm-detail-deactivate">Deactivate</button>
  </div>
</div>

<div class="mm-detail-tab-panel" id="mm-dp-attendance">
  <div style="font-size:13px;color:var(--mm-text-secondary);padding:20px 0;text-align:center;">
    Attendance history will be shown here once the attendance module is linked.
  </div>
</div>

<div class="mm-detail-tab-panel" id="mm-dp-notes">
  ${m.pastoral_notes
      ? `<div class="mm-note-item"><div class="mm-note-text">${m.pastoral_notes}</div><div class="mm-note-meta">Pastoral notes</div></div>`
      : `<div class="mm-note-item"><div class="mm-note-text" style="color:var(--mm-text-secondary)">No notes for this member yet.</div></div>`}
  <div style="margin-top:12px;">
    <label class="mm-form-label">Add a note</label>
    <textarea class="mm-form-textarea" id="mm-newNoteText" placeholder="Add an internal admin note…" style="margin-top:5px;"></textarea>
    <button class="mm-btn-primary" style="margin-top:8px;" id="mm-saveNote">Save Note</button>
  </div>
</div>


`

  panel.classList.add('open')
  overlay.classList.add('open')
  document.body.style.overflow = 'hidden'

  // Tab switching
  body.querySelectorAll<HTMLButtonElement>('[data-dp-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.mm-detail-tab').forEach(t => t.classList.remove('active'))
      body.querySelectorAll('.mm-detail-tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      body.querySelector(`#mm-dp-${btn.dataset['dpTab']}`)?.classList.add('active')
    })
  })

  // Edit from detail
  body.querySelector<HTMLButtonElement>(`[data-edit-id="${m.id}"]`)?.addEventListener('click', () => {
    _closeDetail()
    _openMemberModal(m.id)
  })

  // SMS
  body.querySelector('#mm-detail-sms')?.addEventListener('click', () => {
    if (m.primary_phone) {
      Toast.info(`SMS compose for ${formatName(m.first_name, m.last_name, m.title)} — ${m.primary_phone}`)
    } else {
      Toast.warning('No phone number on record for this member.')
    }
  })

  // Deactivate
  body.querySelector('#mm-detail-deactivate')?.addEventListener('click', async () => {
    if (!confirm(`Deactivate ${formatName(m.first_name, m.last_name, m.title)}? They will be marked inactive.`)) return
    try {
      await deactivateMember(m.id)
      Toast.success(`${formatName(m.first_name, m.last_name, m.title)} has been deactivated.`)
      _closeDetail()
      await _loadMembers()
      _renderMembers()
      await _renderStats()
    } catch (err) {
      Toast.fromError(err)
    }
  })

  // Save note (updates pastoral_notes via updateMember)
  body.querySelector('#mm-saveNote')?.addEventListener('click', async () => {
    const ta = body.querySelector<HTMLTextAreaElement>('#mm-newNoteText')
    const txt = ta?.value.trim()
    if (!txt) { Toast.warning('Note is empty.'); return }
    try {
      const existing = m.pastoral_notes ?? ''
      const combined = existing ? `${existing}\n\n${txt}` : txt
      await updateMember(m.id, { pastoral_notes: combined })
      Toast.success('Note saved.')
      if (ta) ta.value = ''
      // Refresh detail body
      const updated = _state!.members.find(x => x.id === m.id)
      if (updated) {
        (updated as any).pastoral_notes = combined
        _openDetail({ ...m, pastoral_notes: combined })
      }
    } catch (err) {
      Toast.fromError(err)
    }
  })
}

function _closeDetail(): void {
  if (!_container) return
  _container.querySelector('#mm-detailPanel')?.classList.remove('open')
  _container.querySelector('#mm-detailOverlay')?.classList.remove('open')
  document.body.style.overflow = ''
  if (_state) _state.detailMember = null
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function _openMemberModal(editId: string | null = null): void {
  if (editId) {
    navigate(`/members/${editId}/edit`)
  } else {
    navigate('/members/add')
  }
}

// ── Bulk actions ──────────────────────────────────────────────────────────────

function _updateBulkBar(): void {
  if (!_state || !_container) return
  const bar = _container.querySelector('#mm-bulkBar')
  const cnt = _container.querySelector('#mm-bulkCount')
  bar?.classList.toggle('show', _state.selectedIds.size > 0)
  if (cnt) cnt.textContent = String(_state.selectedIds.size)
}

function _clearSelection(): void {
  if (!_state) return
  _state.selectedIds.clear()
  _container?.querySelectorAll('.mm-member-card.selected').forEach(c => c.classList.remove('selected'))
  _container?.querySelectorAll('.mm-table-cb.checked').forEach(c => c.classList.remove('checked'))
  _updateBulkBar()
}

async function _bulkChangeStatus(): Promise<void> {
  if (!_state || _state.selectedIds.size === 0) return
  const newStatus = prompt('New status (active / inactive / visitor / prospect):')?.toLowerCase()
  if (!newStatus) return
  const valid = ['active', 'inactive', 'visitor', 'prospect', 'transfer', 'deceased']
  if (!valid.includes(newStatus)) { Toast.error('Invalid status.'); return }
  let done = 0
  for (const id of _state.selectedIds) {
    try {
      await updateMember(id, { membership_status: newStatus as MemberView['membership_status'] })
      done++
    } catch { /* continue */ }
  }
  Toast.success(`Status updated for ${done} member(s).`)
  _clearSelection()
  await _loadMembers()
  _renderMembers()
  await _renderStats()
}

async function _bulkExport(): Promise<void> {
  if (!_state || _state.selectedIds.size === 0) return
  Toast.info(`Exporting ${_state.selectedIds.size} members to CSV…`)
  const selected = _state.filtered.filter(m => _state!.selectedIds.has(m.id))
  const headers = ['Membership #', 'First Name', 'Last Name', 'Status', 'Gender', 'Phone', 'Email', 'Occupation', 'Joined']
  const rows = selected.map(m => [
    m.membership_number ?? '', m.first_name, m.last_name,
    m.membership_status, m.gender, m.primary_phone ?? '', m.email ?? '',
    m.occupation ?? '', fmtDate(m.join_date),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'caci_members_selected.csv'
  a.click()
  URL.revokeObjectURL(a.href)
  _clearSelection()
}

async function _bulkRemove(): Promise<void> {
  if (!_state || _state.selectedIds.size === 0) return
  if (!confirm(`Deactivate ${_state.selectedIds.size} member(s)? They will be marked inactive.`)) return
  let done = 0
  for (const id of _state.selectedIds) {
    try { await deactivateMember(id); done++ } catch { /* continue */ }
  }
  Toast.success(`${done} member(s) deactivated.`)
  _clearSelection()
  await _loadMembers()
  _renderMembers()
  await _renderStats()
}

// ── Attendance sub-page ───────────────────────────────────────────────────────

function _renderAttSessions(): void {
  if (!_state || !_container) return
  const grid = _container.querySelector('#mm-attSessionsGrid')
  if (!grid) return
  grid.innerHTML = _state.attSessions.map(s => `
<div class="mm-att-session-card" data-att-session="${s.id}">
  <div class="mm-att-session-date">${s.date} · ${s.type}</div>
  <div class="mm-att-session-name">${s.name}</div>
  <div class="mm-att-session-stats">
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-green)">${s.present}</div>
      <div class="mm-att-session-stat-lbl">Present</div>
    </div>
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-red)">${s.absent}</div>
      <div class="mm-att-session-stat-lbl">Absent</div>
    </div>
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-gold)">${s.excused}</div>
      <div class="mm-att-session-stat-lbl">Excused</div>
    </div>
  </div>
</div>`).join('')

  grid.querySelectorAll<HTMLElement>('[data-att-session]').forEach(card => {
    card.addEventListener('click', () => _openAttTable(card.dataset['attSession']!))
  })
}

function _openAttTable(sessionId: string): void {
  if (!_state || !_container) return
  const s = _state.attSessions.find(x => x.id === sessionId)
  if (!s) return
  _state.currentAttId = sessionId

  const label = _container.querySelector('#mm-attSessionLabel')
  const meta = _container.querySelector('#mm-attSessionMeta')
  if (label) label.textContent = `${s.name} — ${s.date}`
  if (meta) meta.textContent = `${s.type} · ${s.time} · ${s.present + s.absent + s.excused} active members`

  const sessGrid = _container.querySelector<HTMLElement>('#mm-attSessionsGrid')
  const tableWrap = _container.querySelector<HTMLElement>('#mm-attTableWrap')
  if (sessGrid) sessGrid.style.display = 'none'
  if (tableWrap) tableWrap.style.display = 'block'

  // Pre-fill attendance state
  _state.memberAtt = {}
  _state.members
    .filter(m => m.membership_status !== 'inactive')
    .forEach(m => { _state!.memberAtt[m.id] = 'present' })

  _renderAttTable()
}

function _renderAttTable(): void {
  if (!_state || !_container) return
  const tbody = _container.querySelector('#mm-attTableBody')
  if (!tbody) return
  const relevant = _state.members.filter(m => m.membership_status !== 'inactive')
  tbody.innerHTML = relevant.map(m => {
    const status = _state!.memberAtt[m.id] ?? 'present'
    const s = statusBadge(m.membership_status)
    const bg = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
    const ini = initials(m.first_name, m.last_name)
    return `
<tr>
  <td>
    <div class="mm-table-name-cell">
      <div class="mm-table-avatar" style="background:${bg}">${ini}</div>
      <div>
        <div class="mm-table-name">${formatName(m.first_name, m.last_name, m.title)}</div>
        <div class="mm-table-email">${m.primary_phone ?? '—'}</div>
      </div>
    </div>
  </td>
  <td style="font-size:12px;">${m.occupation ?? '—'}</td>
  <td><span class="mm-badge ${s.cls}">${s.label}</span></td>
  <td>
    <div class="mm-att-toggle-wrap">
      <button class="mm-att-toggle ${status === 'present' ? 'present' : ''}" data-att-member="${m.id}" data-att-status="present">Present</button>
      <button class="mm-att-toggle ${status === 'absent' ? 'absent' : ''}" data-att-member="${m.id}" data-att-status="absent">Absent</button>
      <button class="mm-att-toggle ${status === 'excused' ? 'excused' : ''}" data-att-member="${m.id}" data-att-status="excused">Excused</button>
    </div>
  </td>
</tr>`
  }).join('')

  // Bind toggle buttons
  tbody.querySelectorAll<HTMLButtonElement>('[data-att-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const memberId = btn.dataset['attMember']!
      const newStatus = btn.dataset['attStatus'] as 'present' | 'absent' | 'excused'
      _state!.memberAtt[memberId] = newStatus
      // Update buttons in the same row
      const row = btn.closest('tr')!
      row.querySelectorAll<HTMLButtonElement>('.mm-att-toggle').forEach(b => {
        b.className = 'mm-att-toggle'
        if (b.dataset['attStatus'] === newStatus) b.classList.add(newStatus)
      })
    })
  })
}

function _saveAttendance(): void {
  if (!_state) return
  const att = _state.memberAtt
  const present = Object.values(att).filter(v => v === 'present').length
  const absent = Object.values(att).filter(v => v === 'absent').length
  const excused = Object.values(att).filter(v => v === 'excused').length
  const s = _state.attSessions.find(x => x.id === _state!.currentAttId)
  if (s) { s.present = present; s.absent = absent; s.excused = excused }
  _closeAttTable()
  _renderAttSessions()
  Toast.success('Attendance saved successfully.')
}

function _closeAttTable(): void {
  if (!_container) return
  const sessGrid = _container.querySelector<HTMLElement>('#mm-attSessionsGrid')
  const tableWrap = _container.querySelector<HTMLElement>('#mm-attTableWrap')
  if (sessGrid) sessGrid.style.display = ''
  if (tableWrap) tableWrap.style.display = 'none'
}

// ── Attendance session modal ──────────────────────────────────────────────────

function _openAttSessionModal(): void {
  if (!_container) return
  const dateEl = _container.querySelector<HTMLInputElement>('#mm-attSessionDate')
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]
  _container.querySelector('#mm-attSessionModal')?.classList.add('open')
  _container.querySelector('#mm-attSessionModalOverlay')?.classList.add('open')
  document.body.style.overflow = 'hidden'
}

function _closeAttSessionModal(): void {
  if (!_container) return
  _container.querySelector('#mm-attSessionModal')?.classList.remove('open')
  _container.querySelector('#mm-attSessionModalOverlay')?.classList.remove('open')
  document.body.style.overflow = ''
}

function _saveAttSession(): void {
  if (!_state || !_container) return
  const name = (_container.querySelector<HTMLInputElement>('#mm-attSessionName')?.value ?? '').trim()
  const date = _container.querySelector<HTMLInputElement>('#mm-attSessionDate')?.value ?? ''
  if (!name || !date) { Toast.warning('Session name and date are required.'); return }
  _state.attSessions.unshift({
    id: 's' + Date.now(),
    name,
    type: _container.querySelector<HTMLSelectElement>('#mm-attSessionType')?.value ?? 'Sunday Service',
    date: fmtDate(date),
    time: _container.querySelector<HTMLInputElement>('#mm-attSessionTime')?.value ?? '09:00',
    present: 0, absent: 0, excused: 0,
  })
  _closeAttSessionModal()
  _renderAttSessions()
  Toast.success('Session created.')
}

// ── Groups sub-page ───────────────────────────────────────────────────────────

function _renderGroups(): void {
  if (!_state || !_container) return
  const grid = _container.querySelector('#mm-groupsGrid')
  if (!grid) return
  grid.innerHTML = _state.groups.map(g => `
<div class="mm-group-card">
  <div class="mm-group-icon">
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  </div>
  <div class="mm-group-name">${g.name}</div>
  <div class="mm-group-type"><span class="mm-badge">${g.type}</span></div>
  <div style="font-size:12px;color:var(--mm-text-secondary);margin:6px 0;">${g.desc}</div>
  <div class="mm-group-meta">
    <span>${g.members} members</span>
    ${g.day ? `<span>${g.day}s</span>` : ''}
    <span>Leader: ${g.leader}</span>
  </div>
  <div class="mm-group-actions">
    <button class="mm-btn-outline" style="flex:1;justify-content:center;font-size:12px;"
      data-view-group="${g.id}">View Members</button>
    <button class="mm-btn-icon" data-edit-group="${g.id}" title="Edit group">
      <svg viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  </div>
</div>`).join('')

  grid.querySelectorAll<HTMLElement>('[data-edit-group]').forEach(btn => {
    btn.addEventListener('click', () => _openGroupModal(btn.dataset['editGroup']!))
  })
  grid.querySelectorAll<HTMLElement>('[data-view-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const groupId = btn.dataset['viewGroup']!
      const g = _state?.groups.find(x => x.id === groupId)
      Toast.info(`${g?.name ?? 'Group'} — member list view coming soon.`)
    })
  })
}

function _openGroupModal(id: string | null): void {
  if (!_state || !_container) return
  const g = id ? _state.groups.find(x => x.id === id) : null
  const titleEl = _container.querySelector('#mm-groupModalTitle')
  if (titleEl) titleEl.textContent = g ? `Edit: ${g.name}` : 'New Group'

  if (g) {
    const set = (sel: string, val: string) => {
      const el = _container!.querySelector<HTMLInputElement | HTMLSelectElement>(sel)
      if (el) el.value = val
    }
    set('#mm-gName', g.name)
    set('#mm-gType', g.type)
    set('#mm-gDesc', g.desc)
    set('#mm-gLeader', g.leader)
    set('#mm-gDay', g.day)
  } else {
    const clear = (sel: string) => {
      const el = _container!.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)
      if (el) el.value = ''
    }
    clear('#mm-gName'); clear('#mm-gDesc')
    const typeEl = _container.querySelector<HTMLSelectElement>('#mm-gType')
    const leaderEl = _container.querySelector<HTMLSelectElement>('#mm-gLeader')
    const dayEl = _container.querySelector<HTMLSelectElement>('#mm-gDay')
    if (typeEl) typeEl.selectedIndex = 0
    if (leaderEl) leaderEl.selectedIndex = 0
    if (dayEl) dayEl.selectedIndex = 0
  }

  _container.querySelector('#mm-groupModal')?.classList.add('open')
  _container.querySelector('#mm-groupModalOverlay')?.classList.add('open')
  document.body.style.overflow = 'hidden'
}

function _closeGroupModal(): void {
  if (!_container) return
  _container.querySelector('#mm-groupModal')?.classList.remove('open')
  _container.querySelector('#mm-groupModalOverlay')?.classList.remove('open')
  document.body.style.overflow = ''
}

function _saveGroup(): void {
  if (!_state || !_container) return
  const name = (_container.querySelector<HTMLInputElement>('#mm-gName')?.value ?? '').trim()
  if (!name) { Toast.warning('Group name is required.'); return }
  _state.groups.push({
    id: 'g' + Date.now(),
    name,
    type: _container.querySelector<HTMLSelectElement>('#mm-gType')?.value ?? 'Department',
    leader: _container.querySelector<HTMLSelectElement>('#mm-gLeader')?.value || 'Unassigned',
    members: 0,
    day: _container.querySelector<HTMLSelectElement>('#mm-gDay')?.value ?? '',
    desc: (_container.querySelector<HTMLTextAreaElement>('#mm-gDesc')?.value ?? '').trim(),
  })
  _closeGroupModal()
  _renderGroups()
  Toast.success('Group created.')
}

// ── Pastoral care sub-page ────────────────────────────────────────────────────

function _renderPastoral(): void {
  if (!_state || !_container) return

  const flagTypeColors: Record<string, string> = {
    followup: 'followup', absent: 'absent', 'life-event': 'life-event', 'first-timer': 'first-timer',
  }
  const priorityBadge = (p: string) => p === 'high' || p === 'urgent'
    ? `<span class="mm-badge red" style="font-size:10px;">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`
    : ''

  const flagsEl = _container.querySelector('#mm-pcFlagsContainer')
  if (flagsEl) {
    const open = _state.pcFlags.filter(f => !f.resolved)
    flagsEl.innerHTML = open.length ? open.map(f => `
<div class="mm-flag-item">
  <div class="mm-flag-dot ${flagTypeColors[f.type] ?? 'followup'}"></div>
  <div class="mm-flag-content">
    <div class="mm-flag-name">${f.member} ${priorityBadge(f.priority)}</div>
    <div class="mm-flag-reason">${f.reason}</div>
    <div class="mm-flag-date">${f.date} · Assigned to ${f.assignTo}</div>
  </div>
  <div class="mm-flag-actions">
    <button class="mm-pc-action-btn" data-resolve-flag="${f.id}">Resolve</button>
  </div>
</div>`).join('')
      : '<div style="font-size:13px;color:var(--mm-text-secondary);padding:12px 0;">All clear — no open flags.</div>'

    flagsEl.querySelectorAll<HTMLButtonElement>('[data-resolve-flag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const flag = _state!.pcFlags.find(x => x.id === btn.dataset['resolveFlag'])
        if (flag) { flag.resolved = true; _renderPastoral(); Toast.success('Flag resolved.') }
      })
    })
  }

  const ftEl = _container.querySelector('#mm-pcFirstTimers')
  if (ftEl) {
    ftEl.innerHTML = _state.pcFirstTimers.map(ft => `
<div class="mm-flag-item">
  <div class="mm-flag-dot first-timer"></div>
  <div class="mm-flag-content">
    <div class="mm-flag-name">${ft.name}</div>
    <div class="mm-flag-reason">${ft.phone}</div>
    <div class="mm-flag-date">${ft.date}</div>
  </div>
  <div class="mm-flag-actions">
    ${ft.followedUp
        ? '<span class="mm-badge green" style="font-size:10px;">Followed up</span>'
        : `<button class="mm-pc-action-btn" data-followup="${ft.name}">Mark done</button>`}
  </div>
</div>`).join('')
    ftEl.querySelectorAll<HTMLButtonElement>('[data-followup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ft = _state!.pcFirstTimers.find(x => x.name === btn.dataset['followup'])
        if (ft) { ft.followedUp = true; _renderPastoral(); Toast.success('Marked as followed up.') }
      })
    })
  }

  const leEl = _container.querySelector('#mm-pcLifeEvents')
  if (leEl) {
    leEl.innerHTML = _state.pcLifeEvents.map(le => `
<div class="mm-flag-item">
  <div class="mm-flag-dot life-event"></div>
  <div class="mm-flag-content">
    <div class="mm-flag-name">${le.name}</div>
    <div class="mm-flag-reason">${le.event}</div>
    <div class="mm-flag-date">${le.date}</div>
  </div>
  <div class="mm-flag-actions">
    <button class="mm-pc-action-btn" data-contact-le="${le.name}">Contact</button>
  </div>
</div>`).join('')
    leEl.querySelectorAll<HTMLButtonElement>('[data-contact-le]').forEach(btn => {
      btn.addEventListener('click', () => {
        Toast.info(`Sending pastoral message to ${btn.dataset['contactLe']}…`)
      })
    })
  }
}

function _openFlagModal(): void {
  if (!_container) return
  // Populate member select
  const sel = _container.querySelector<HTMLSelectElement>('#mm-flagMember')
  if (sel && _state) {
    sel.innerHTML = '<option value="">Select member…</option>'
    _state.members.forEach(m => {
      const o = document.createElement('option')
      o.value = m.id
      o.textContent = `${formatName(m.first_name, m.last_name, m.title)}`
      sel.appendChild(o)
    })
  }
  _container.querySelector('#mm-flagModal')?.classList.add('open')
  _container.querySelector('#mm-flagModalOverlay')?.classList.add('open')
  document.body.style.overflow = 'hidden'
}

function _closeFlagModal(): void {
  if (!_container) return
  _container.querySelector('#mm-flagModal')?.classList.remove('open')
  _container.querySelector('#mm-flagModalOverlay')?.classList.remove('open')
  document.body.style.overflow = ''
}

function _saveFlag(): void {
  if (!_state || !_container) return
  const memberId = _container.querySelector<HTMLSelectElement>('#mm-flagMember')?.value ?? ''
  const notes = (_container.querySelector<HTMLTextAreaElement>('#mm-flagNotes')?.value ?? '').trim()
  if (!memberId) { Toast.warning('Please select a member.'); return }
  const member = _state.members.find(m => m.id === memberId)
  _state.pcFlags.unshift({
    id: 'f' + Date.now(),
    member: member ? `${formatName(member.first_name, member.last_name, member.title)}` : memberId,
    type: _container.querySelector<HTMLSelectElement>('#mm-flagType')?.value ?? 'followup',
    reason: notes || 'Follow-up required',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    assignTo: _container.querySelector<HTMLSelectElement>('#mm-flagAssign')?.value ?? 'Unassigned',
    priority: _container.querySelector<HTMLSelectElement>('#mm-flagPriority')?.value ?? 'normal',
    resolved: false,
  })
  _closeFlagModal()
  _renderPastoral()
  Toast.success('Flag added.')
}

// ── Reports sub-page ──────────────────────────────────────────────────────────

function _renderReports(): void {
  if (!_container || !_state) return

  const renderBarChart = (id: string, data: { label: string; value: number; color: string }[]) => {
    const el = _container!.querySelector(`#${id}`)
    if (!el) return
    const max = Math.max(...data.map(d => d.value), 1)
    el.innerHTML = data.map(d => `
<div class="mm-chart-bar-row">
  <div class="mm-chart-bar-label">${d.label}</div>
  <div class="mm-chart-bar-track"><div class="mm-chart-bar-fill" style="width:${Math.round(d.value / max * 100)}%;background:${d.color}"></div></div>
  <div class="mm-chart-bar-val">${d.value}</div>
</div>`).join('')
  }

  // Use real member data for gender / status charts
  const m = _state.members
  const male = m.filter(x => x.gender === 'male').length
  const female = m.filter(x => x.gender === 'female').length
  const active = m.filter(x => x.membership_status === 'active').length
  const inactive = m.filter(x => x.membership_status === 'inactive').length
  const visitor = m.filter(x => x.membership_status === 'visitor').length
  const prospect = m.filter(x => x.membership_status === 'prospect').length

  renderBarChart('mm-growthChart', [
    { label: 'Jan', value: 298, color: 'var(--mm-blue)' },
    { label: 'Feb', value: 311, color: 'var(--mm-blue)' },
    { label: 'Mar', value: 327, color: 'var(--mm-blue)' },
    { label: 'Apr', value: 341, color: 'var(--mm-blue)' },
    { label: 'May', value: m.length || 347, color: 'var(--mm-blue)' },
  ])
  renderBarChart('mm-genderChart', [
    { label: 'Male', value: male || 184, color: '#004BA0' },
    { label: 'Female', value: female || 163, color: '#C60026' },
  ])
  renderBarChart('mm-statusChart', [
    { label: 'Active', value: active || 312, color: 'var(--mm-green)' },
    { label: 'Visitor', value: visitor || 23, color: '#0969da' },
    { label: 'Inactive', value: inactive || 8, color: 'var(--mm-text-muted)' },
    { label: 'Prospect', value: prospect || 4, color: 'var(--mm-gold)' },
  ])

  const gtable = _container.querySelector('#mm-growthTable')
  if (gtable) gtable.innerHTML = `
<thead><tr><th>Month</th><th>Total</th><th>New</th><th>Change</th></tr></thead>
<tbody>
  <tr><td>January</td><td>298</td><td>9</td><td class="mm-trend-up">+9</td></tr>
  <tr><td>February</td><td>311</td><td>15</td><td class="mm-trend-up">+13</td></tr>
  <tr><td>March</td><td>327</td><td>16</td><td class="mm-trend-up">+16</td></tr>
  <tr><td>April</td><td>341</td><td>14</td><td class="mm-trend-up">+14</td></tr>
  <tr><td>May (to date)</td><td>${m.length || 347}</td><td>6</td><td class="mm-trend-up">+6</td></tr>
</tbody>`
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _setTab(tabName: string): void {
  if (!_state || !_container) return

  // Block coming-soon tabs — redirect to members-list + notify
  if (COMING_SOON_TABS.has(tabName)) {
    _showComingSoonTab(tabName)
    // Ensure URL stays on /members
    if (location.hash !== '#/members') navigate('/members')
    return
  }

  // If clicking a tab that matches a known route, navigate to it
  // to keep the URL and sidebar in sync.
  const routeMap: Record<string, string> = {
    'members-list': '/members',
    'attendance': '/attendance',
    'groups': '/groups',
    'pastoral': '/pastoral-care',
    'reports': '/reports'
  }

  const targetPath = routeMap[tabName]
  if (targetPath && location.hash !== '#' + targetPath) {
    navigate(targetPath)
    return
  }

  _state.activeTab = tabName

  _container.querySelectorAll('.mm-tab').forEach(t => t.classList.remove('active'))
  _container.querySelectorAll('.mm-section').forEach(s => s.classList.remove('active'))

  _container.querySelector(`.mm-tab[data-tab="${tabName}"]`)?.classList.add('active')
  _container.querySelector(`#mm-section-${tabName}`)?.classList.add('active')

  // Sidebar filter panel — only visible on members-list
  const filterPanel = _container.querySelector<HTMLElement>('#mm-filterPanel')
  if (filterPanel) filterPanel.style.display = tabName === 'members-list' ? '' : 'none'

  // Sync sidebar active item
  _container.querySelectorAll<HTMLElement>('[data-sidebar-tab]').forEach(item => {
    item.classList.toggle('active', item.dataset['sidebarTab'] === tabName)
  })

  // Render sub-page
  if (tabName === 'attendance') _renderAttSessions()
  if (tabName === 'groups') _renderGroups()
  if (tabName === 'pastoral') _renderPastoral()
  if (tabName === 'reports') _renderReports()
}

function _setSidebarItem(tabName: string, quickFilter?: string): void {
  if (!_state) return
  if (quickFilter) {
    _state.sidebarFilter = quickFilter
    _state.page = 1
  }
  _setTab(tabName)
  if (quickFilter) _renderMembers()
}

// ── Mobile filter dropdown ────────────────────────────────────────────────────

function _bindMobileFilterDropdown(): void {
  if (!_container) return
  const trigger = _container.querySelector<HTMLElement>('#mm-fddTrigger')
  const panel   = _container.querySelector<HTMLElement>('#mm-fddPanel')
  const wrap    = _container.querySelector<HTMLElement>('#mm-fddWrap')
  if (!trigger || !panel || !wrap) return

  const open  = () => { panel.classList.add('mm-fdd-open'); trigger.setAttribute('aria-expanded', 'true');  _syncFddHint() }
  const close = () => { panel.classList.remove('mm-fdd-open'); trigger.setAttribute('aria-expanded', 'false') }
  const isOpen = () => panel.classList.contains('mm-fdd-open')

  trigger.addEventListener('click', e => { e.stopPropagation(); isOpen() ? close() : open() })
  document.addEventListener('click', e => { if (!wrap.contains(e.target as Node)) close() })

  // Accordion headers
  _container.querySelectorAll<HTMLElement>('[data-fdd-sec]').forEach(hdr => {
    const toggle = () => {
      const sec   = hdr.dataset['fddSec']!
      const items = _container!.querySelector<HTMLElement>(`#mm-fddI-${sec}`)
      const chev  = hdr.querySelector<SVGElement>('.mm-fdd-chev')
      if (!items) return
      const nowOpen = !items.classList.contains('mm-fdd-items-open')
      items.classList.toggle('mm-fdd-items-open', nowOpen)
      chev?.classList.toggle('mm-fdd-chev-open', nowOpen)
      hdr.setAttribute('aria-expanded', String(nowOpen))
    }
    hdr.addEventListener('click', toggle)
    hdr.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } })
  })

  // Checkbox rows
  _container.querySelectorAll<HTMLElement>('[data-fdd-g]').forEach(row => {
    row.addEventListener('click', () => {
      if (!_state) return
      const cb  = row.querySelector<HTMLElement>('.mm-fdd-cb')!
      const g   = row.dataset['fddG']!
      const v   = row.dataset['fddV']!
      const on  = !cb.classList.contains('mm-fdd-on')
      cb.classList.toggle('mm-fdd-on', on)
      if (g === 'status')      { on ? _state.statusFilters.add(v) : _state.statusFilters.delete(v) }
      else if (g === 'gender') { on ? _state.genderFilters.add(v) : _state.genderFilters.delete(v) }
      _syncFddUI()
    })
  })

  // Clear all
  _container.querySelector('#mm-fddClearAll')?.addEventListener('click', () => {
    if (!_state) return
    _state.statusFilters.clear()
    _state.genderFilters.clear()
    _container!.querySelectorAll<HTMLElement>('.mm-fdd-cb.mm-fdd-on').forEach(cb => cb.classList.remove('mm-fdd-on'))
    _syncFddUI()
    _updateFilterCount()
    _state.page = 1
    _renderMembers()
  })

  // Apply
  _container.querySelector('#mm-fddApply')?.addEventListener('click', () => {
    _updateFilterCount()
    _state!.page = 1
    _renderMembers()
    close()
  })
}

function _syncFddUI(): void {
  if (!_state || !_container) return
  // Pill count on trigger button
  const total = _state.statusFilters.size + _state.genderFilters.size
  const pill  = _container.querySelector<HTMLElement>('#mm-fddPill')
  if (pill) { pill.textContent = String(total); pill.style.display = total > 0 ? '' : 'none' }
  // Per-section badges
  ;[['status', _state.statusFilters.size], ['gender', _state.genderFilters.size]].forEach(([g, n]) => {
    const b = _container!.querySelector<HTMLElement>(`#mm-fddB-${g}`)
    if (b) { b.textContent = String(n); b.style.display = (n as number) > 0 ? '' : 'none' }
  })
  _syncFddHint()
}

function _syncFddHint(): void {
  if (!_state || !_container) return
  const hint = _container.querySelector<HTMLElement>('#mm-fddHint')
  if (hint) hint.textContent = `${_state.filtered.length} member${_state.filtered.length !== 1 ? 's' : ''}`
}

// ── Event binding ─────────────────────────────────────────────────────────────

function _bindAll(): void {
  if (!_container) return

  // Sub-nav tabs
  _container.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => _setTab(btn.dataset['tab']!))
  })

  // Sidebar items
  _container.querySelectorAll<HTMLButtonElement>('[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['sidebarTab']!
      const filter = btn.dataset['sidebarFilter']
      _setSidebarItem(tab, filter)
    })
  })

  // Export CSV (sidebar)
  _container.querySelector('#mm-exportCsvSidebar')?.addEventListener('click', _doExportCsv)

  // Search
  _container.querySelector<HTMLInputElement>('#mm-memberSearch')?.addEventListener('input', e => {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _searchDebounce = setTimeout(() => {
      _state!.search = (e.target as HTMLInputElement).value.trim().toLowerCase()
      _state!.page = 1
      _renderMembers()
    }, 200)
  })

  // Sort
  _container.querySelector<HTMLSelectElement>('#mm-sortSelect')?.addEventListener('change', e => {
    _state!.sortMode = (e.target as HTMLSelectElement).value
    _state!.page = 1
    _renderMembers()
  })

  // View toggle
  _container.querySelector('#mm-gridViewBtn')?.addEventListener('click', () => _setView('grid'))
  _container.querySelector('#mm-listViewBtn')?.addEventListener('click', () => _setView('list'))

  // Export (toolbar)
  _container.querySelector('#mm-exportBtn')?.addEventListener('click', _doExportCsv)

  // Add member
  _container.querySelector('#mm-bulkImportBtn')?.addEventListener('click', () => navigate('/members/bulk-import'))
  _container.querySelector('#mm-addMemberBtn')?.addEventListener('click', () => _openMemberModal())

  // Detail overlay close
  _container.querySelector('#mm-detailOverlay')?.addEventListener('click', _closeDetail)
  _container.querySelector('#mm-detailClose')?.addEventListener('click', _closeDetail)

  // Member modal overlay / cancel


  // Filters (sidebar checkboxes)
  _container.querySelectorAll<HTMLButtonElement>('[data-filter-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset['filterGroup']!
      const val = btn.dataset['filterVal']!
      const cb = btn.querySelector('.mm-filter-cb')!
      const isOn = cb.classList.toggle('checked')
      if (group === 'status') {
        isOn ? _state!.statusFilters.add(val) : _state!.statusFilters.delete(val)
      } else if (group === 'gender') {
        isOn ? _state!.genderFilters.add(val) : _state!.genderFilters.delete(val)
      }
      _updateFilterCount()
      _state!.page = 1
      _renderMembers()
    })
  })

  // Filter clear buttons
  _container.querySelectorAll<HTMLButtonElement>('[data-filter-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset['filterClear']!
      if (group === 'status') {
        _state!.statusFilters.clear()
        _container!.querySelectorAll('[data-filter-group="status"] .mm-filter-cb').forEach(cb => cb.classList.remove('checked'))
      } else if (group === 'gender') {
        _state!.genderFilters.clear()
        _container!.querySelectorAll('[data-filter-group="gender"] .mm-filter-cb').forEach(cb => cb.classList.remove('checked'))
      }
      _updateFilterCount()
      _state!.page = 1
      _renderMembers()
    })
  })

  // Clear search
  _container.querySelector('#mm-clearSearch')?.addEventListener('click', () => {
    _state!.search = ''
    const inp = _container!.querySelector<HTMLInputElement>('#mm-memberSearch')
    if (inp) inp.value = ''
    _state!.page = 1
    _renderMembers()
  })

  // Bulk bar actions
  _container.querySelector('#mm-bulkChangeStatus')?.addEventListener('click', _bulkChangeStatus)
  _container.querySelector('#mm-bulkExport')?.addEventListener('click', _bulkExport)
  _container.querySelector('#mm-bulkRemove')?.addEventListener('click', _bulkRemove)
  _container.querySelector('#mm-bulkClose')?.addEventListener('click', _clearSelection)
  _container.querySelector('#mm-bulkSendSMS')?.addEventListener('click', () => {
    Toast.info(`SMS queued for ${_state!.selectedIds.size} member(s).`)
    _clearSelection()
  })

  // Select-all (table)
  _container.querySelector('#mm-selectAllCheck')?.addEventListener('click', () => {
    const el = _container!.querySelector<HTMLElement>('#mm-selectAllCheck')!
    const isAll = el.classList.toggle('checked')
    const cur = _state!.filtered.slice((_state!.page - 1) * PAGE_SIZE, _state!.page * PAGE_SIZE)
    cur.forEach(m => { isAll ? _state!.selectedIds.add(m.id) : _state!.selectedIds.delete(m.id) })
    _updateBulkBar()
    _renderMembers()
  })

  // Attendance page buttons
  _container.querySelector('#mm-newSessionBtn')?.addEventListener('click', _openAttSessionModal)
  _container.querySelector('#mm-markAttBtn')?.addEventListener('click', () => Toast.info('Select a session below to begin marking attendance.'))
  _container.querySelector('#mm-attSessionModalOverlay')?.addEventListener('click', _closeAttSessionModal)
  _container.querySelector('#mm-closeAttSessionModal')?.addEventListener('click', _closeAttSessionModal)
  _container.querySelector('#mm-saveAttSessionBtn')?.addEventListener('click', _saveAttSession)
  _container.querySelector('#mm-saveAttendanceBtn')?.addEventListener('click', _saveAttendance)
  _container.querySelector('#mm-closeAttTableBtn')?.addEventListener('click', _closeAttTable)

  // Groups page
  _container.querySelector('#mm-newGroupBtn')?.addEventListener('click', () => _openGroupModal(null))
  _container.querySelector('#mm-groupModalOverlay')?.addEventListener('click', _closeGroupModal)
  _container.querySelector('#mm-closeGroupModal')?.addEventListener('click', _closeGroupModal)
  _container.querySelector('#mm-groupModalCancel')?.addEventListener('click', _closeGroupModal)
  _container.querySelector('#mm-saveGroupBtn')?.addEventListener('click', _saveGroup)

  // Pastoral care
  _container.querySelector('#mm-addFlagBtn')?.addEventListener('click', _openFlagModal)
  _container.querySelector('#mm-flagModalOverlay')?.addEventListener('click', _closeFlagModal)
  _container.querySelector('#mm-closeFlagModal')?.addEventListener('click', _closeFlagModal)
  _container.querySelector('#mm-flagModalCancel')?.addEventListener('click', _closeFlagModal)
  _container.querySelector('#mm-saveFlagBtn')?.addEventListener('click', _saveFlag)

  // Reports
  _container.querySelector('#mm-exportReportBtn')?.addEventListener('click', () => {
    Toast.info('Generating PDF report…')
  })
  _container.querySelector<HTMLSelectElement>('#mm-reportPeriodSelect')?.addEventListener('change', e => {
    Toast.info(`Loading report for ${(e.target as HTMLSelectElement).value}…`)
  })
  _container.querySelectorAll<HTMLElement>('.mm-report-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.querySelector('.mm-report-name')?.textContent ?? 'Report'
      Toast.info(`Generating ${name}…`)
    })
  })

  // Navigate to member profile full page
  _container.querySelector('#mm-viewFullProfile')?.addEventListener('click', () => {
    if (_state?.detailMember) navigate(`/members/${_state.detailMember.id}`)
  })

  // Mobile filter dropdown
  _bindMobileFilterDropdown()
}

/** Rebind events that are part of dynamically rendered rows/cards */
function _bindRowEvents(): void {
  if (!_container) return

  // Card clicks — toggle select or open detail
  _container.querySelectorAll<HTMLElement>('.mm-member-card').forEach(card => {
    card.addEventListener('click', e => {
      const viewBtn = (e.target as Element).closest('[data-view-id]')
      if (viewBtn) {
        const id = (viewBtn as HTMLElement).dataset['viewId']!
        const m = _state!.members.find(x => x.id === id)
        if (m) _openDetail(m)
        return
      }
      // Clicking anywhere else on card toggles selection
      const id = card.dataset['memberId']!
      const sel = _state!.selectedIds
      if (sel.has(id)) { sel.delete(id); card.classList.remove('selected') }
      else { sel.add(id); card.classList.add('selected') }
      _updateBulkBar()
    })
  })

  // Table: view, edit, deactivate buttons
  _container.querySelectorAll<HTMLElement>('[data-view-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset['viewId']!
      const m = _state!.members.find(x => x.id === id)
      if (m) _openDetail(m)
    })
  })

  _container.querySelectorAll<HTMLElement>('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      _openMemberModal(btn.dataset['editId']!)
    })
  })

  _container.querySelectorAll<HTMLElement>('[data-deactivate-id]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const id = btn.dataset['deactivateId']!
      const m = _state!.members.find(x => x.id === id)
      if (!m) return
      if (!confirm(`Deactivate ${formatName(m.first_name, m.last_name, m.title)}?`)) return
      try {
        await deactivateMember(id)
        Toast.success(`${formatName(m.first_name, m.last_name, m.title)} deactivated.`)
        await _loadMembers()
        _renderMembers()
        await _renderStats()
      } catch (err) {
        Toast.fromError(err)
      }
    })
  })

  // Row checkbox (table)
  _container.querySelectorAll<HTMLElement>('[data-row-check]').forEach(cb => {
    cb.addEventListener('click', e => {
      e.stopPropagation()
      const id = cb.dataset['rowCheck']!
      cb.classList.toggle('checked')
      if (_state!.selectedIds.has(id)) _state!.selectedIds.delete(id)
      else _state!.selectedIds.add(id)
      _updateBulkBar()
    })
  })
}

// ── View toggle ───────────────────────────────────────────────────────────────

function _setView(v: 'grid' | 'list'): void {
  if (!_state || !_container) return
  _state.view = v
  _container.querySelector('#mm-gridViewBtn')?.classList.toggle('active', v === 'grid')
  _container.querySelector('#mm-listViewBtn')?.classList.toggle('active', v === 'list')
  _renderMembers()
}

// ── Filter count badge ────────────────────────────────────────────────────────

function _updateFilterCount(): void {
  if (!_state || !_container) return
  const count = _state.statusFilters.size + _state.genderFilters.size
  const pill = _container.querySelector('#mm-filterCount')
  if (pill) {
    pill.textContent = String(count)
    pill.classList.toggle('show', count > 0)
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

async function _doExportCsv(): Promise<void> {
  Toast.info('Generating CSV export…')
  try {
    const csv = await exportMembersCsv()
    downloadCsv(csv, 'caci_members.csv')
    Toast.success('CSV exported successfully.')
  } catch {
    // Fall back to client-side CSV from current data
    const headers = ['Membership #', 'First Name', 'Last Name', 'Status', 'Gender', 'Phone', 'Email', 'Occupation', 'Joined']
    const rows = (_state?.filtered ?? []).map(m => [
      m.membership_number ?? '', m.first_name, m.last_name,
      m.membership_status, m.gender, m.primary_phone ?? '', m.email ?? '',
      m.occupation ?? '', fmtDate(m.join_date),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'caci_members.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    Toast.success('CSV exported successfully.')
  }
}

// ── Initial state ─────────────────────────────────────────────────────────────

function _buildInitialState(): State {
  return {
    members: [], filtered: [], loading: false,
    view: 'grid', search: '', sortMode: 'joined-desc',
    activeTab: _getInitialTabFromHash(), sidebarFilter: 'all',
    selectedIds: new Set(),
    page: 1,
    statusFilters: new Set(),
    genderFilters: new Set(),
    // Attendance
    attSessions: [
      { id: 's1', name: 'Sunday Service', type: 'Sunday Service', date: 'May 4, 2025', time: '09:00', present: 284, absent: 28, excused: 12 },
      { id: 's2', name: 'Mid-week Prayer', type: 'Prayer Meeting', date: 'Apr 30, 2025', time: '18:30', present: 142, absent: 170, excused: 6 },
      { id: 's3', name: 'Sunday Service', type: 'Sunday Service', date: 'Apr 27, 2025', time: '09:00', present: 271, absent: 41, excused: 8 },
      { id: 's4', name: 'Youth Service', type: 'Youth Service', date: 'Apr 26, 2025', time: '15:00', present: 68, absent: 12, excused: 4 },
      { id: 's5', name: 'Sunday Service', type: 'Sunday Service', date: 'Apr 20, 2025', time: '09:00', present: 268, absent: 44, excused: 10 },
    ],
    currentAttId: null,
    memberAtt: {},
    // Groups
    groups: [
      { id: 'g1', name: 'Worship Team', type: 'Department', leader: 'Ama Osei', members: 24, day: 'Sunday', desc: 'Leads congregational worship.' },
      { id: 'g2', name: 'Ushers', type: 'Department', leader: 'Nana Adjei', members: 18, day: 'Sunday', desc: 'Manages seating and reception.' },
      { id: 'g3', name: "Men's Fellowship", type: 'Fellowship', leader: 'Kwame Mensah', members: 98, day: 'Saturday', desc: "Monthly fellowship for men." },
      { id: 'g4', name: "Women's Fellowship", type: 'Fellowship', leader: 'Ama Osei', members: 112, day: 'Saturday', desc: "Monthly fellowship for women." },
      { id: 'g5', name: 'Youth Ministry', type: 'Ministry', leader: 'Efua Mensah', members: 72, day: 'Saturday', desc: "Weekly youth meetings." },
      { id: 'g6', name: "Children's Ministry", type: 'Ministry', leader: 'Grace Amponsah', members: 55, day: 'Sunday', desc: "Sunday school and holiday programs." },
      { id: 'g7', name: 'Admin Committee', type: 'Committee', leader: 'Grace Amponsah', members: 8, day: 'Wednesday', desc: "Records and administrative coordination." },
      { id: 'g8', name: 'Couples Fellowship', type: 'Fellowship', leader: 'Kwame Mensah', members: 34, day: '', desc: "Monthly meetings for married couples." },
      { id: 'g9', name: 'Assakae Cell', type: 'Cell Group', leader: 'Kwabena Boateng', members: 22, day: 'Tuesday', desc: "Midweek cell group." },
      { id: 'g10', name: 'Finance Committee', type: 'Committee', leader: 'Nana Adjei', members: 6, day: 'Monday', desc: "Oversees budgets and reporting." },
      { id: 'g11', name: 'Evangelism Team', type: 'Ministry', leader: 'Emmanuel Asante', members: 15, day: '', desc: "Outreach and community engagement." },
    ],
    // Pastoral
    pcFlags: [
      { id: 'f1', member: 'Kofi Acheampong', type: 'absent', reason: 'Absent 5+ weeks', date: 'May 3, 2025', assignTo: 'Elder Mensah', priority: 'high', resolved: false },
      { id: 'f2', member: 'Akosua Frimpong', type: 'followup', reason: 'Prospect — needs follow-up to convert to active', date: 'Apr 29, 2025', assignTo: 'Deaconess Ama Osei', priority: 'normal', resolved: false },
      { id: 'f3', member: 'Samuel Adusei', type: 'first-timer', reason: 'Visited twice, no commitment yet', date: 'Apr 28, 2025', assignTo: 'Unassigned', priority: 'normal', resolved: false },
      { id: 'f4', member: 'Yaa Asantewaa', type: 'life-event', reason: 'Bereavement — lost mother last week', date: 'May 1, 2025', assignTo: 'Pastor', priority: 'urgent', resolved: false },
      { id: 'f5', member: 'Emmanuel Asante', type: 'followup', reason: 'Moved job, may relocate assembly', date: 'Apr 15, 2025', assignTo: 'Deacon Nana', priority: 'normal', resolved: false },
    ],
    pcFirstTimers: [
      { name: 'Kweku Ankamah', date: 'May 4, 2025', phone: '+233 24 555 6666', followedUp: true },
      { name: 'Adwoa Boakye', date: 'May 4, 2025', phone: '+233 20 777 8888', followedUp: false },
      { name: 'Fiifi Mensah', date: 'Apr 27, 2025', phone: '+233 27 999 0000', followedUp: true },
      { name: 'Nana Brew', date: 'Apr 27, 2025', phone: '+233 24 111 2222', followedUp: false },
    ],
    pcLifeEvents: [
      { name: 'Yaa Asantewaa', event: 'Bereavement (Mother)', date: 'Apr 30, 2025', type: 'Bereavement' },
      { name: 'Kwabena Boateng', event: 'New Baby (Boy)', date: 'Apr 22, 2025', type: 'Birth' },
      { name: 'Grace Amponsah', event: 'Promotion at work', date: 'May 2, 2025', type: 'Milestone' },
    ],
    detailMember: null,
    editingId: null,
  }
}

function _getInitialTabFromHash(): string {
  const hash = location.hash.slice(1)
  // Disabled tabs — always fall back to members-list
  if (hash.startsWith('/attendance') || hash.startsWith('/groups') || hash.startsWith('/pastoral-care') || hash.startsWith('/reports'))
    return 'members-list'
  return 'members-list'
}

// Shows a coming-soon inline toast for disabled membership tabs
function _showComingSoonTab(tabName: string): void {
  const labels: Record<string, string> = {
    attendance: 'Attendance',
    groups: 'Groups & Units',
    pastoral: 'Pastoral Care',
    reports: 'Reports',
  }
  const section = labels[tabName] ?? tabName

  const existing = document.getElementById('mm-coming-soon-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'mm-coming-soon-toast'
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    z-index: 10000; display: flex; align-items: flex-start; gap: 12px;
    background: var(--bg-card); border: 1px solid var(--border-default);
    border-radius: 12px; padding: 14px 16px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    max-width: 340px; width: calc(100% - 32px);
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: var(--font-sans);
  `
  toast.innerHTML = `
    <div style="
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      background: var(--caci-blue-bg); display: flex; align-items: center;
      justify-content: center; font-size: 18px; color: var(--caci-blue);
    "><i class="bi bi-hammer"></i></div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px;">
        Coming Soon
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
        <strong style="color:var(--text-primary)">${section}</strong> is currently being built and will be released soon. Stay tuned!
      </div>
    </div>
    <button id="mm-cs-close" style="
      background: none; border: none; cursor: pointer; padding: 2px;
      color: var(--text-secondary); font-size: 14px; flex-shrink: 0;
    "><i class="bi bi-x-lg"></i></button>
  `

  document.body.appendChild(toast)
  toast.querySelector('#mm-cs-close')?.addEventListener('click', () => toast.remove())
  setTimeout(() => toast?.remove(), 5000)
}

// ── CSS injection ─────────────────────────────────────────────────────────────

function _injectCSS(): void {
  injectMembershipCSS()
}

// ── HTML template ─────────────────────────────────────────────────────────────

function _buildHTML(): string {
  return `
<div class="mm-root">

<!-- ═══ SUB-NAV TABS ═══ -->
<div class="mm-subnav">
  <button class="mm-tab ${_state!.activeTab === 'members-list' ? 'active' : ''}" data-tab="members-list">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    All Members <span class="mm-badge" id="mm-subnav-count">0</span>
  </button>
  <button class="mm-tab" data-tab="attendance" style="opacity:0.55;" title="Coming soon">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
    Attendance <span style="font-size:9px;background:var(--caci-blue-bg);color:var(--caci-blue);border-radius:6px;padding:1px 5px;font-weight:700;vertical-align:middle;">SOON</span>
  </button>
  <button class="mm-tab" data-tab="groups" style="opacity:0.55;" title="Coming soon">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
    Groups &amp; Units <span style="font-size:9px;background:var(--caci-blue-bg);color:var(--caci-blue);border-radius:6px;padding:1px 5px;font-weight:700;vertical-align:middle;">SOON</span>
  </button>
  <button class="mm-tab" data-tab="pastoral" style="opacity:0.55;" title="Coming soon">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    Pastoral Care <span style="font-size:9px;background:var(--caci-blue-bg);color:var(--caci-blue);border-radius:6px;padding:1px 5px;font-weight:700;vertical-align:middle;">SOON</span>
  </button>
  <button class="mm-tab" data-tab="reports" style="opacity:0.55;" title="Coming soon">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    Reports <span style="font-size:9px;background:var(--caci-blue-bg);color:var(--caci-blue);border-radius:6px;padding:1px 5px;font-weight:700;vertical-align:middle;">SOON</span>
  </button>
</div>

<!-- ═══ WEB LAYOUT ═══ -->
<div class="mm-layout">

<!-- ─── SIDEBAR ─── -->
<aside>

  <!-- Quick Access -->
  <div class="mm-sidebar-card mm-mobile-hide">
    <div class="mm-sidebar-title">Quick Access</div>
    <button class="mm-sidebar-item ${_state!.activeTab === 'members-list' ? 'active' : ''}" data-sidebar-tab="members-list">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><path d="M10.5 14v-1.5a2.5 2.5 0 0 0-2.5-2.5H4A2.5 2.5 0 0 0 1.5 12.5V14"/><circle cx="6" cy="5" r="2.5"/><path d="M13.5 14v-1a2 2 0 0 0-2-2"/><path d="M10.5 3a2 2 0 0 1 0 4"/></svg>
        All Members
      </div>
      <span class="mm-count" id="mm-nav-count-all">0</span>
    </button>
    <button class="mm-sidebar-item" data-sidebar-tab="members-list" data-sidebar-filter="active">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10,10"/></svg>
        Active Members
      </div>
      <span class="mm-count" id="mm-nav-count-active">0</span>
    </button>
    <button class="mm-sidebar-item" data-sidebar-tab="members-list" data-sidebar-filter="visitor">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><path d="M8 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 14c0-2.2 2.7-4 6-4s6 1.8 6 4"/></svg>
        Visitors
      </div>
      <span class="mm-count" id="mm-nav-count-visitor">0</span>
    </button>
    <button class="mm-sidebar-item" data-sidebar-tab="members-list" data-sidebar-filter="recent">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
        New This Month
      </div>
      <span class="mm-count" id="mm-nav-count-new">0</span>
    </button>
    <button class="mm-sidebar-item ${_state!.activeTab === 'attendance' ? 'active' : ''}" data-sidebar-tab="attendance">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/><polyline points="5,10 7,12 11,9"/></svg>
        Attendance
      </div>
    </button>
    <button class="mm-sidebar-item ${_state!.activeTab === 'groups' ? 'active' : ''}" data-sidebar-tab="groups">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><circle cx="12" cy="3.5" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12.5" r="2"/><line x1="5.5" y1="8.8" x2="10.5" y2="11.2"/><line x1="10.5" y1="4.8" x2="5.5" y2="7.2"/></svg>
        Groups &amp; Units
      </div>
    </button>
    <button class="mm-sidebar-item ${_state!.activeTab === 'pastoral' ? 'active' : ''}" data-sidebar-tab="pastoral">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><path d="M13.9 3a3.7 3.7 0 0 0-5.2 0L8 3.7l-.7-.7a3.7 3.7 0 0 0-5.2 5.2l.7.7L8 14.2l5.2-5.3.7-.7a3.7 3.7 0 0 0 0-5.2z"/></svg>
        Pastoral Care
      </div>
      <span class="mm-count alert">7</span>
    </button>
    <button class="mm-sidebar-item ${_state!.activeTab === 'reports' ? 'active' : ''}" data-sidebar-tab="reports">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><path d="M2 14h12M4 14v-3M8 14V8M12 14V4"/></svg>
        Reports
      </div>
    </button>
    <button class="mm-sidebar-item" id="mm-exportCsvSidebar">
      <div class="mm-sidebar-item-left">
        <svg viewBox="0 0 16 16"><path d="M13 10v3H3v-3"/><path d="M8 2v8"/><path d="M5 7l3 3 3-3"/></svg>
        Export CSV
      </div>
    </button>
  </div>

  <!-- Filters (desktop sidebar — hidden on mobile, replaced by toolbar dropdown) -->
  <div class="mm-sidebar-card" id="mm-filterPanel">
    <div class="mm-sidebar-title" style="display:flex;align-items:center;justify-content:space-between;">
      Filters
      <span class="mm-filter-pill" id="mm-filterCount">0</span>
    </div>

    <div class="mm-filter-group">
      <div class="mm-filter-group-label">Status
        <button class="mm-filter-clear" data-filter-clear="status">Clear</button>
      </div>
      <button class="mm-filter-option" data-filter-group="status" data-filter-val="active">
        <div class="mm-filter-cb ${_state!.statusFilters.has('active') ? 'checked' : ''}"></div> Active <span class="mm-filter-option-count">—</span>
      </button>
      <button class="mm-filter-option" data-filter-group="status" data-filter-val="inactive">
        <div class="mm-filter-cb ${_state!.statusFilters.has('inactive') ? 'checked' : ''}"></div> Inactive <span class="mm-filter-option-count">—</span>
      </button>
      <button class="mm-filter-option" data-filter-group="status" data-filter-val="visitor">
        <div class="mm-filter-cb ${_state!.statusFilters.has('visitor') ? 'checked' : ''}"></div> Visitor <span class="mm-filter-option-count">—</span>
      </button>
      <button class="mm-filter-option" data-filter-group="status" data-filter-val="prospect">
        <div class="mm-filter-cb ${_state!.statusFilters.has('prospect') ? 'checked' : ''}"></div> Prospect <span class="mm-filter-option-count">—</span>
      </button>
    </div>

    <div class="mm-filter-divider"></div>

    <div class="mm-filter-group">
      <div class="mm-filter-group-label">Gender
        <button class="mm-filter-clear" data-filter-clear="gender">Clear</button>
      </div>
      <button class="mm-filter-option" data-filter-group="gender" data-filter-val="male">
        <div class="mm-filter-cb ${_state!.genderFilters.has('male') ? 'checked' : ''}"></div> Male <span class="mm-filter-option-count">—</span>
      </button>
      <button class="mm-filter-option" data-filter-group="gender" data-filter-val="female">
        <div class="mm-filter-cb ${_state!.genderFilters.has('female') ? 'checked' : ''}"></div> Female <span class="mm-filter-option-count">—</span>
      </button>
    </div>

    <div class="mm-filter-divider"></div>

    <div class="mm-filter-group">
      <div class="mm-filter-group-label">Joined</div>
      <select class="mm-filter-select" id="mm-joinedFilter">
        <option value="all" ${_state!.sidebarFilter === 'all' ? 'selected' : ''}>All Time</option>
        <option value="month">This Month</option>
        <option value="quarter">Last 3 Months</option>
        <option value="year">This Year</option>
        <option value="last-year">Last Year</option>
      </select>
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="mm-sidebar-card mm-mobile-hide">
    <div class="mm-sidebar-title">Quick Stats</div>
    <div class="mm-qs-item"><span class="mm-qs-label">Active</span><span class="mm-qs-val" id="mm-qs-active">—</span></div>
    <div class="mm-stat-bar" style="margin-bottom:8px;"><div class="mm-stat-fill" id="mm-qs-active-bar" style="width:0;background:var(--mm-blue);"></div></div>
    <div class="mm-qs-item"><span class="mm-qs-label">Visitor</span><span class="mm-qs-val" id="mm-qs-visitor">—</span></div>
    <div class="mm-stat-bar" style="margin-bottom:8px;"><div class="mm-stat-fill" id="mm-qs-visitor-bar" style="width:0;background:#0969da;"></div></div>
    <div class="mm-qs-item"><span class="mm-qs-label">Inactive</span><span class="mm-qs-val" id="mm-qs-inactive">—</span></div>
    <div class="mm-stat-bar" style="margin-bottom:8px;"><div class="mm-stat-fill" id="mm-qs-inactive-bar" style="width:0;background:var(--mm-text-muted);"></div></div>
    <div class="mm-qs-item"><span class="mm-qs-label">Prospect</span><span class="mm-qs-val" id="mm-qs-prospect">—</span></div>
    <div class="mm-stat-bar"><div class="mm-stat-fill" id="mm-qs-prospect-bar" style="width:0;background:var(--mm-gold);"></div></div>
  </div>

</aside>

<!-- ─── MAIN ─── -->
<main class="mm-main">

<!-- ░░░ MEMBERS LIST PAGE ░░░ -->
<div class="mm-section ${_state!.activeTab === 'members-list' ? 'active' : ''}" id="mm-section-members-list">

  <!-- Stats Row -->
  <div class="mm-stats-row">
    <div class="mm-stat-card">
      <div class="mm-stat-label">Total Members</div>
      <div class="mm-stat-value" id="mm-stat-total">—</div>
      <div class="mm-stat-sub" id="mm-stat-total-pct">Loading…</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" id="mm-stat-total-bar" style="width:0;background:var(--mm-blue);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">Active</div>
      <div class="mm-stat-value" id="mm-stat-active">—</div>
      <div class="mm-stat-sub">Active members</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" id="mm-stat-active-bar" style="width:0;background:var(--mm-blue);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">Visitors</div>
      <div class="mm-stat-value" id="mm-stat-visitors">—</div>
      <div class="mm-stat-sub">Total visitors</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" id="mm-stat-visitors-bar" style="width:0;background:var(--mm-red);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">New This Month</div>
      <div class="mm-stat-value" id="mm-stat-new">—</div>
      <div class="mm-stat-sub">Last 30 days</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" id="mm-stat-new-bar" style="width:0;background:var(--mm-gold);"></div></div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="mm-toolbar">
    <div class="mm-search-wrap">
      <svg class="mm-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input class="mm-search-input" type="text" id="mm-memberSearch" placeholder="Search by name, ID, phone, or occupation…">
    </div>
    <div class="mm-toolbar-sep"></div>
    <select class="mm-sort-select" id="mm-sortSelect">
      <option value="joined-desc">Joined (Newest)</option>
      <option value="name-asc">Name A–Z</option>
      <option value="name-desc">Name Z–A</option>
      <option value="joined-asc">Joined (Oldest)</option>
      <option value="status">Status</option>
    </select>

    <!-- Mobile-only filter dropdown -->
    <div class="mm-fdd-wrap" id="mm-fddWrap">
      <button class="mm-fdd-trigger" id="mm-fddTrigger" aria-haspopup="true" aria-expanded="false">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filters
        <span class="mm-fdd-pill" id="mm-fddPill" style="display:none">0</span>
      </button>

      <div class="mm-fdd-panel" id="mm-fddPanel" role="dialog" aria-label="Filter options">
        <div class="mm-fdd-hdr">
          <span class="mm-fdd-hdr-title">Filter members</span>
          <button class="mm-fdd-clear-all" id="mm-fddClearAll">Clear all</button>
        </div>
        <div class="mm-fdd-body">

          <!-- Status accordion -->
          <div class="mm-fdd-section">
            <div class="mm-fdd-acc-hdr mm-fdd-acc-open" data-fdd-sec="status" tabindex="0" role="button" aria-expanded="true">
              <div class="mm-fdd-acc-left">
                <span class="mm-fdd-acc-label">Status</span>
                <span class="mm-fdd-acc-badge" id="mm-fddB-status" style="display:none"></span>
              </div>
              <svg class="mm-fdd-chev mm-fdd-chev-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="mm-fdd-items mm-fdd-items-open" id="mm-fddI-status">
              <div class="mm-fdd-row" data-fdd-g="status" data-fdd-v="active">
                <div class="mm-fdd-cb ${_state!.statusFilters.has('active') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl">Active</span>
              </div>
              <div class="mm-fdd-row" data-fdd-g="status" data-fdd-v="visitor">
                <div class="mm-fdd-cb ${_state!.statusFilters.has('visitor') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl">Visitor</span>
              </div>
              <div class="mm-fdd-row" data-fdd-g="status" data-fdd-v="prospect">
                <div class="mm-fdd-cb ${_state!.statusFilters.has('prospect') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl">Prospect</span>
              </div>
              <div class="mm-fdd-row" data-fdd-g="status" data-fdd-v="inactive">
                <div class="mm-fdd-cb ${_state!.statusFilters.has('inactive') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl mm-fdd-lbl-dim">Inactive</span>
              </div>
            </div>
          </div>

          <!-- Gender accordion -->
          <div class="mm-fdd-section">
            <div class="mm-fdd-acc-hdr" data-fdd-sec="gender" tabindex="0" role="button" aria-expanded="false">
              <div class="mm-fdd-acc-left">
                <span class="mm-fdd-acc-label">Gender</span>
                <span class="mm-fdd-acc-badge" id="mm-fddB-gender" style="display:none"></span>
              </div>
              <svg class="mm-fdd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="mm-fdd-items" id="mm-fddI-gender">
              <div class="mm-fdd-row" data-fdd-g="gender" data-fdd-v="male">
                <div class="mm-fdd-cb ${_state!.genderFilters.has('male') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl">Male</span>
              </div>
              <div class="mm-fdd-row" data-fdd-g="gender" data-fdd-v="female">
                <div class="mm-fdd-cb ${_state!.genderFilters.has('female') ? 'mm-fdd-on' : ''}"><svg viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5 5 4 8 8.5 2"/></svg></div>
                <span class="mm-fdd-lbl">Female</span>
              </div>
            </div>
          </div>

        </div>
        <div class="mm-fdd-footer">
          <span class="mm-fdd-hint" id="mm-fddHint"></span>
          <button class="mm-fdd-apply" id="mm-fddApply">Apply</button>
        </div>
      </div>
    </div>

    <div class="mm-view-toggle">
      <button class="mm-view-btn active" id="mm-gridViewBtn" title="Grid view">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
      </button>
      <button class="mm-view-btn" id="mm-listViewBtn" title="List view">
        <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
    </div>
    <button class="mm-btn-outline" id="mm-exportBtn">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export
    </button>
    ${hasPermission(getCurrentUser()?.role || '', 'membership.members.import') ? '<button class="mm-btn-outline" id="mm-bulkImportBtn" style="gap:6px;display:flex;align-items:center;"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Bulk Import</button>' : ''}
    <button class="mm-btn-primary" id="mm-addMemberBtn">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Member
    </button>
  </div>

  <!-- Bulk bar -->
  <div class="mm-bulk-bar" id="mm-bulkBar">
    <div class="mm-bulk-bar-left">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <span id="mm-bulkCount">0</span> members selected
    </div>
    <div class="mm-bulk-actions">
      <button class="mm-bulk-btn" id="mm-bulkChangeStatus">Change Status</button>
      <button class="mm-bulk-btn" id="mm-bulkSendSMS">Send SMS</button>
      <button class="mm-bulk-btn" id="mm-bulkExport">Export Selected</button>
      <button class="mm-bulk-btn danger" id="mm-bulkRemove">Deactivate</button>
      <button class="mm-bulk-close" id="mm-bulkClose">
        <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>

  <!-- Results info -->
  <div class="mm-results-info">
    <div class="mm-results-count">Showing <strong id="mm-visibleCount">0</strong> members</div>
    <div style="font-size:12px;color:var(--mm-text-muted);" id="mm-pageInfo">Page 1 of 1</div>
  </div>

  <!-- Grid View -->
  <div id="mm-gridView" class="mm-member-grid"></div>

  <!-- List View -->
  <div id="mm-listView" class="mm-table-wrap" style="display:none;">
    <table class="mm-table">
      <thead>
        <tr>
          <th class="mm-col-check">
            <div class="mm-table-cb" id="mm-selectAllCheck"></div>
          </th>
          <th>Name</th>
          <th>Member ID</th>
          <th>Status</th>
          <th>Occupation</th>
          <th>Joined <i class="mm-sort-icon sorted">↓</i></th>
          <th class="mm-col-actions"></th>
        </tr>
      </thead>
      <tbody id="mm-tableBody"></tbody>
    </table>
  </div>

  <!-- Empty state -->
  <div class="mm-empty" id="mm-emptyState">
    <div class="mm-empty-icon">
      <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <div class="mm-empty-title">No members found</div>
    <div class="mm-empty-sub">Try adjusting your search term or filters.</div>
    <button class="mm-btn-outline" id="mm-clearSearch">Clear Search</button>
  </div>

  <!-- Pagination -->
  <div class="mm-pagination">
    <div class="mm-page-info" id="mm-paginationInfo">Showing 0 results</div>
    <div class="mm-page-btns" id="mm-pageBtns"></div>
  </div>

</div>
<!-- END MEMBERS LIST PAGE -->


<!-- ░░░ ATTENDANCE PAGE ░░░ -->
<div class="mm-section ${_state!.activeTab === 'attendance' ? 'active' : ''}" id="mm-section-attendance">
  <div class="mm-att-page-header">
    <div>
      <div class="mm-att-page-title">Attendance</div>
      <div style="font-size:13px;color:var(--mm-text-secondary);margin-top:2px;">Track member attendance per service or event</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-outline" id="mm-newSessionBtn">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        New Session
      </button>
      <button class="mm-btn-primary" id="mm-markAttBtn">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Mark Attendance
      </button>
    </div>
  </div>

  <div class="mm-stats-row">
    <div class="mm-stat-card">
      <div class="mm-stat-label">Last Sunday</div><div class="mm-stat-value">284</div>
      <div class="mm-stat-sub">81.8% attendance</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" style="width:82%;background:var(--mm-blue);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">Avg (This Month)</div><div class="mm-stat-value">271</div>
      <div class="mm-stat-sub">78.1% of active</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" style="width:78%;background:var(--mm-blue);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">Absent 3+ Weeks</div><div class="mm-stat-value">18</div>
      <div class="mm-stat-sub">needs follow-up</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" style="width:22%;background:var(--mm-red);"></div></div>
    </div>
    <div class="mm-stat-card">
      <div class="mm-stat-label">Sessions (May)</div><div class="mm-stat-value">5</div>
      <div class="mm-stat-sub">4 Sunday, 1 mid-week</div>
      <div class="mm-stat-bar"><div class="mm-stat-fill" style="width:60%;background:var(--mm-gold);"></div></div>
    </div>
  </div>

  <div style="font-size:13px;font-weight:600;color:var(--mm-text-primary);margin-bottom:12px;">Recent Sessions</div>
  <div class="mm-att-sessions-grid" id="mm-attSessionsGrid"></div>

  <div id="mm-attTableWrap" style="display:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-size:14px;font-weight:600;" id="mm-attSessionLabel">—</div>
        <div style="font-size:12px;color:var(--mm-text-secondary);margin-top:2px;" id="mm-attSessionMeta">—</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="mm-btn-ghost" id="mm-closeAttTableBtn">← Back to Sessions</button>
        <button class="mm-btn-primary" id="mm-saveAttendanceBtn">Save Attendance</button>
      </div>
    </div>
    <div class="mm-table-wrap">
      <table class="mm-att-table">
        <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Attendance</th></tr></thead>
        <tbody id="mm-attTableBody"></tbody>
      </table>
    </div>
  </div>
</div>
<!-- END ATTENDANCE PAGE -->


<!-- ░░░ GROUPS PAGE ░░░ -->
<div class="mm-section ${_state!.activeTab === 'groups' ? 'active' : ''}" id="mm-section-groups">
  <div class="mm-att-page-header">
    <div>
      <div class="mm-att-page-title">Groups &amp; Units</div>
      <div style="font-size:13px;color:var(--mm-text-secondary);margin-top:2px;">Manage departments, fellowships, and ministry units</div>
    </div>
    <button class="mm-btn-primary" id="mm-newGroupBtn">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Group
    </button>
  </div>
  <div class="mm-stats-row">
    <div class="mm-stat-card"><div class="mm-stat-label">Total Groups</div><div class="mm-stat-value">11</div><div class="mm-stat-sub">Across all types</div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">Departments</div><div class="mm-stat-value">4</div><div class="mm-stat-sub">Admin, Worship, Youth, Ushers</div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">Fellowships</div><div class="mm-stat-value">5</div><div class="mm-stat-sub">Men, Women, Youth, Children, Couples</div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">Cells</div><div class="mm-stat-value">2</div><div class="mm-stat-sub">Assakae, Tema</div></div>
  </div>
  <div class="mm-groups-grid" id="mm-groupsGrid"></div>
</div>
<!-- END GROUPS PAGE -->


<!-- ░░░ PASTORAL CARE PAGE ░░░ -->
<div class="mm-section ${_state!.activeTab === 'pastoral' ? 'active' : ''}" id="mm-section-pastoral">
  <div class="mm-att-page-header">
    <div>
      <div class="mm-att-page-title">Pastoral Care</div>
      <div style="font-size:13px;color:var(--mm-text-secondary);margin-top:2px;">Follow up flags and care assignments</div>
    </div>
    <button class="mm-btn-primary" id="mm-addFlagBtn">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      Add Flag
    </button>
  </div>
  <div class="mm-stats-row">
    <div class="mm-stat-card"><div class="mm-stat-label">Open Flags</div><div class="mm-stat-value">7</div><div class="mm-stat-sub">Needs attention</div><div class="mm-stat-bar"><div class="mm-stat-fill" style="width:50%;background:var(--mm-red);"></div></div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">First Timers (May)</div><div class="mm-stat-value">4</div><div class="mm-stat-sub">2 followed up</div><div class="mm-stat-bar"><div class="mm-stat-fill" style="width:30%;background:#1a7f37;"></div></div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">Long Absent</div><div class="mm-stat-value">18</div><div class="mm-stat-sub">3+ weeks absent</div><div class="mm-stat-bar"><div class="mm-stat-fill" style="width:40%;background:var(--mm-gold);"></div></div></div>
    <div class="mm-stat-card"><div class="mm-stat-label">Life Events</div><div class="mm-stat-value">3</div><div class="mm-stat-sub">Bereavements, births</div><div class="mm-stat-bar"><div class="mm-stat-fill" style="width:20%;background:#7c3aed;"></div></div></div>
  </div>
  <div class="mm-pastoral-cols">
    <div>
      <div class="mm-pc-card">
        <div class="mm-pc-card-title">Open Follow-up Flags</div>
        <div id="mm-pcFlagsContainer"></div>
      </div>
    </div>
    <div>
      <div class="mm-pc-card">
        <div class="mm-pc-card-title">First Timers — May 2025</div>
        <div id="mm-pcFirstTimers"></div>
      </div>
      <div class="mm-pc-card">
        <div class="mm-pc-card-title">Life Events</div>
        <div id="mm-pcLifeEvents"></div>
      </div>
    </div>
  </div>
</div>
<!-- END PASTORAL CARE PAGE -->


<!-- ░░░ REPORTS PAGE ░░░ -->
<div class="mm-section ${_state!.activeTab === 'reports' ? 'active' : ''}" id="mm-section-reports">
  <div class="mm-att-page-header">
    <div>
      <div class="mm-att-page-title">Reports</div>
      <div style="font-size:13px;color:var(--mm-text-secondary);margin-top:2px;">Membership analytics and downloadable reports</div>
    </div>
    <div style="display:flex;gap:8px;">
      <select class="mm-sort-select" id="mm-reportPeriodSelect">
        <option value="2025">Year 2025</option>
        <option value="2024">Year 2024</option>
        <option value="q1">Q1 2025</option>
        <option value="q2">Q2 2025</option>
      </select>
      <button class="mm-btn-outline" id="mm-exportReportBtn">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export PDF
      </button>
    </div>
  </div>

  <div class="mm-reports-grid" style="grid-template-columns:1fr;">
    <div class="mm-pc-card" style="grid-column:span 1;">
      <div class="mm-pc-card-title">Membership Growth — Jan to May 2025</div>
      <div id="mm-growthChart" style="margin-top:8px;"></div>
    </div>
  </div>
  <div class="mm-reports-grid">
    <div class="mm-pc-card">
      <div class="mm-pc-card-title">Gender Breakdown</div>
      <div id="mm-genderChart" style="margin-top:8px;"></div>
    </div>
    <div class="mm-pc-card">
      <div class="mm-pc-card-title">Status Distribution</div>
      <div id="mm-statusChart" style="margin-top:8px;"></div>
    </div>
    <div class="mm-pc-card">
      <div class="mm-pc-card-title">Monthly Growth Table</div>
      <table class="mm-growth-table" id="mm-growthTable"></table>
    </div>
  </div>

  <div style="font-size:13px;font-weight:600;color:var(--mm-text-primary);margin-bottom:12px;margin-top:8px;">Downloadable Reports</div>
  <div class="mm-reports-grid">
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <div class="mm-report-name">Full Member Register</div>
      <div class="mm-report-desc">All members with contact info, status, role, and joined date. Exports to CSV or PDF.</div>
      <div class="mm-report-footer">Last generated: May 1, 2025</div>
    </div>
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg></div>
      <div class="mm-report-name">Attendance Summary</div>
      <div class="mm-report-desc">Per-session attendance with present, absent, and excused counts for any date range.</div>
      <div class="mm-report-footer">Last generated: Apr 30, 2025</div>
    </div>
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></div>
      <div class="mm-report-name">New Members Report</div>
      <div class="mm-report-desc">All newly registered members within a selected period, including who registered them.</div>
      <div class="mm-report-footer">Last generated: May 1, 2025</div>
    </div>
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <div class="mm-report-name">Long Absent Members</div>
      <div class="mm-report-desc">Members absent for 3 or more consecutive weeks, with last seen date and contact info.</div>
      <div class="mm-report-footer">Last generated: Apr 28, 2025</div>
    </div>
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
      <div class="mm-report-name">Pastoral Care Report</div>
      <div class="mm-report-desc">Open follow-up flags, first timers, and life events requiring pastoral attention.</div>
      <div class="mm-report-footer">Last generated: May 2, 2025</div>
    </div>
    <div class="mm-report-card">
      <div class="mm-report-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
      <div class="mm-report-name">Demographics Report</div>
      <div class="mm-report-desc">Age, gender, occupation, and district breakdown. Useful for ministry planning.</div>
      <div class="mm-report-footer">Last generated: Apr 15, 2025</div>
    </div>
  </div>
</div>
<!-- END REPORTS PAGE -->

</main>
</div>
<!-- END WEB LAYOUT -->


<!-- ═══ DETAIL PANEL ═══ -->
<div class="mm-detail-overlay" id="mm-detailOverlay"></div>
<div class="mm-detail-panel" id="mm-detailPanel">
  <div class="mm-detail-header">
    <span class="mm-detail-header-title">Member Profile</span>
    <button class="mm-detail-close" id="mm-detailClose">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="mm-detail-body" id="mm-detailBody"></div>
</div>


</div>


<!-- ═══ ATTENDANCE SESSION MODAL ═══ -->
<div class="mm-modal-overlay" id="mm-attSessionModalOverlay"></div>
<div class="mm-modal-centred" id="mm-attSessionModal">
  <div class="mm-modal-header">
    <div class="mm-modal-title">New Attendance Session</div>
    <button class="mm-modal-close" id="mm-closeAttSessionModal">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="mm-modal-body">
    <div class="mm-form-row">
      <div class="mm-form-field">
        <label class="mm-form-label">Session Name <span class="req">*</span></label>
        <input type="text" class="mm-form-input" id="mm-attSessionName" placeholder="e.g. Sunday Service">
      </div>
      <div class="mm-form-field">
        <label class="mm-form-label">Session Type</label>
        <select class="mm-form-select" id="mm-attSessionType">
          <option>Sunday Service</option>
          <option>Mid-week Service</option>
          <option>Youth Service</option>
          <option>Prayer Meeting</option>
          <option>Special Event</option>
        </select>
      </div>
    </div>
    <div class="mm-form-row">
      <div class="mm-form-field">
        <label class="mm-form-label">Date <span class="req">*</span></label>
        <input type="date" class="mm-form-input" id="mm-attSessionDate">
      </div>
      <div class="mm-form-field">
        <label class="mm-form-label">Time</label>
        <input type="time" class="mm-form-input" id="mm-attSessionTime" value="09:00">
      </div>
    </div>
    <div class="mm-form-field">
      <label class="mm-form-label">Notes</label>
      <textarea class="mm-form-textarea" id="mm-attSessionNotes" placeholder="Optional notes…"></textarea>
    </div>
  </div>
  <div class="mm-modal-footer">
    <button class="mm-btn-outline" id="mm-cancelAttSession">Cancel</button>
    <button class="mm-btn-primary" id="mm-saveAttSessionBtn">Create Session</button>
  </div>
</div>


<!-- ═══ GROUP MODAL ═══ -->
<div class="mm-modal-overlay" id="mm-groupModalOverlay"></div>
<div class="mm-modal-centred" id="mm-groupModal">
  <div class="mm-modal-header">
    <div class="mm-modal-title" id="mm-groupModalTitle">New Group</div>
    <button class="mm-modal-close" id="mm-closeGroupModal">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="mm-modal-body">
    <div class="mm-form-row">
      <div class="mm-form-field">
        <label class="mm-form-label">Group Name <span class="req">*</span></label>
        <input type="text" class="mm-form-input" id="mm-gName" placeholder="e.g. Worship Team">
      </div>
      <div class="mm-form-field">
        <label class="mm-form-label">Type</label>
        <select class="mm-form-select" id="mm-gType">
          <option>Department</option><option>Fellowship</option><option>Cell Group</option>
          <option>Ministry</option><option>Committee</option>
        </select>
      </div>
    </div>
    <div class="mm-form-field">
      <label class="mm-form-label">Description</label>
      <textarea class="mm-form-textarea" id="mm-gDesc" placeholder="What does this group do?"></textarea>
    </div>
    <div class="mm-form-row">
      <div class="mm-form-field">
        <label class="mm-form-label">Leader / Head</label>
        <select class="mm-form-select" id="mm-gLeader">
          <option value="">Select member…</option>
        </select>
      </div>
      <div class="mm-form-field">
        <label class="mm-form-label">Meeting Day</label>
        <select class="mm-form-select" id="mm-gDay">
          <option value="">—</option>
          <option>Sunday</option><option>Monday</option><option>Tuesday</option>
          <option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option>
        </select>
      </div>
    </div>
  </div>
  <div class="mm-modal-footer">
    <button class="mm-btn-outline" id="mm-groupModalCancel">Cancel</button>
    <button class="mm-btn-primary" id="mm-saveGroupBtn">Create Group</button>
  </div>
</div>


<!-- ═══ PASTORAL FLAG MODAL ═══ -->
<div class="mm-modal-overlay" id="mm-flagModalOverlay"></div>
<div class="mm-modal-centred" id="mm-flagModal">
  <div class="mm-modal-header">
    <div class="mm-modal-title">Add Pastoral Flag</div>
    <button class="mm-modal-close" id="mm-closeFlagModal">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="mm-modal-body">
    <div class="mm-form-field">
      <label class="mm-form-label">Member <span class="req">*</span></label>
      <select class="mm-form-select" id="mm-flagMember">
        <option value="">Select member…</option>
      </select>
    </div>
    <div class="mm-form-row">
      <div class="mm-form-field">
        <label class="mm-form-label">Flag Type</label>
        <select class="mm-form-select" id="mm-flagType">
          <option value="followup">General Follow-up</option>
          <option value="absent">Long Absent</option>
          <option value="life-event">Life Event</option>
          <option value="first-timer">First Timer</option>
          <option value="counselling">Needs Counselling</option>
        </select>
      </div>
      <div class="mm-form-field">
        <label class="mm-form-label">Priority</label>
        <select class="mm-form-select" id="mm-flagPriority">
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
    </div>
    <div class="mm-form-field">
      <label class="mm-form-label">Assign To</label>
      <select class="mm-form-select" id="mm-flagAssign">
        <option>Unassigned</option><option>Pastor</option>
        <option>Elder Mensah</option><option>Deaconess Ama Osei</option>
        <option>Youth Leader Efua</option>
      </select>
    </div>
    <div class="mm-form-field">
      <label class="mm-form-label">Notes</label>
      <textarea class="mm-form-textarea" id="mm-flagNotes" placeholder="Describe the reason for this flag…"></textarea>
    </div>
  </div>
  <div class="mm-modal-footer">
    <button class="mm-btn-outline" id="mm-flagModalCancel">Cancel</button>
    <button class="mm-btn-primary" id="mm-saveFlagBtn">Save Flag</button>
  </div>
</div>

</div>
<!-- END .mm-root -->
`
}