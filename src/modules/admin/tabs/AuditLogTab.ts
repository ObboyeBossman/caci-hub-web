// src/modules/admin/tabs/AuditLogTab.ts
// Fully functional Audit Log tab.
// Unified view: member_audit_log + service_audit_log, merged and sorted by changed_at.
// Features: date range picker, entity type filter, search, user filter, paginated table.

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { debounce }            from '@shared/utils/debounce'
import type { WorkspaceTab }   from '../workspace/AdminWorkspaceShell'
import {
  injectWidgetCSS,
  StatsCardGroup,
  showToast,
  avatarColor,
  initials,
} from '../widgets/adminWidgets'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AuditSource = 'member' | 'service'

interface AuditEntry {
  id:           string
  source:       AuditSource
  entityId:     string          // member_id or service_id
  entityLabel:  string          // resolved display name (fetched)
  changedBy:    string          // user_profiles.id
  changedByName: string | null  // resolved full_name
  fieldChanged: string
  oldValue:     string | null
  newValue:     string | null
  changedAt:    string          // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY  (inline — no shared audit repo yet)
// ─────────────────────────────────────────────────────────────────────────────

async function loadAuditLog(opts: {
  assemblyId: string
  fromDate?:  string
  toDate?:    string
  source?:    AuditSource | 'all'
  limit:      number
  offset:     number
}): Promise<{ entries: AuditEntry[]; total: number }> {

  const { assemblyId, fromDate, toDate, source = 'all', limit, offset } = opts

  // ── Member audit log ───────────────────────────────────────────────────────
  let memberRows: any[] = []
  let memberTotal = 0
  if (source === 'all' || source === 'member') {
    let q = supabase
      .from('member_audit_log')
      .select('id, member_id, changed_by, field_changed, old_value, new_value, changed_at', { count: 'exact' })
      .eq('assembly_id', assemblyId)
      .order('changed_at', { ascending: false })

    if (fromDate) q = q.gte('changed_at', fromDate)
    if (toDate)   q = q.lte('changed_at', toDate + 'T23:59:59Z')
    if (source === 'member') q = q.range(offset, offset + limit - 1)

    const { data, count } = await q
    memberRows  = data ?? []
    memberTotal = count ?? 0
  }

  // ── Service audit log ──────────────────────────────────────────────────────
  let serviceRows: any[] = []
  let serviceTotal = 0
  if (source === 'all' || source === 'service') {
    let q = supabase
      .from('service_audit_log')
      .select('id, service_id, changed_by, field_changed, old_value, new_value, changed_at', { count: 'exact' })
      .order('changed_at', { ascending: false })

    if (fromDate) q = q.gte('changed_at', fromDate)
    if (toDate)   q = q.lte('changed_at', toDate + 'T23:59:59Z')
    if (source === 'service') q = q.range(offset, offset + limit - 1)

    const { data, count } = await q
    serviceRows  = data ?? []
    serviceTotal = count ?? 0
  }

  // ── Resolve user names ─────────────────────────────────────────────────────
  const allRows = [
    ...memberRows.map(r => ({ ...r, _source: 'member' as AuditSource, _entityId: r.member_id })),
    ...serviceRows.map(r => ({ ...r, _source: 'service' as AuditSource, _entityId: r.service_id })),
  ]

  // Sort merged result by changed_at desc, then paginate
  allRows.sort((a, b) => b.changed_at.localeCompare(a.changed_at))
  const paged = allRows.slice(offset, offset + limit)
  const total = source === 'all'
    ? memberTotal + serviceTotal
    : source === 'member' ? memberTotal : serviceTotal

  if (paged.length === 0) return { entries: [], total }

  // Resolve user_profiles for changedBy IDs
  const userIds   = [...new Set(paged.map(r => r.changed_by).filter(Boolean))]
  const entityIds = paged.filter(r => r._source === 'member').map(r => r._entityId).filter(Boolean)

  const [{ data: profiles }, { data: members }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('user_profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    entityIds.length > 0
      ? supabase.from('members').select('id, first_name, last_name').in('id', entityIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap   = new Map<string, string>()
  ;(profiles ?? []).forEach((p: any) => userMap.set(p.id, p.full_name))

  const memberMap = new Map<string, string>()
  ;(members ?? []).forEach((m: any) =>
    memberMap.set(m.id, `${m.first_name} ${m.last_name}`.trim())
  )

  const entries: AuditEntry[] = paged.map(r => ({
    id:            r.id,
    source:        r._source,
    entityId:      r._entityId,
    entityLabel:   r._source === 'member'
      ? (memberMap.get(r._entityId) ?? r._entityId?.slice(0, 8) ?? '—')
      : `Service ${r._entityId?.slice(0, 8) ?? '—'}`,
    changedBy:     r.changed_by,
    changedByName: userMap.get(r.changed_by) ?? null,
    fieldChanged:  r.field_changed,
    oldValue:      r.old_value ?? null,
    newValue:      r.new_value ?? null,
    changedAt:     r.changed_at,
  }))

  return { entries, total }
}

async function getAuditSummary(assemblyId: string): Promise<{
  totalToday:   number
  totalWeek:    number
  totalMember:  number
  totalService: number
}> {
  const now     = new Date()
  const today   = now.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

  const [todayMem, todaySvc, weekMem, weekSvc, allMem, allSvc] = await Promise.all([
    supabase.from('member_audit_log').select('id', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId).gte('changed_at', today).then(r => r.count ?? 0),
    supabase.from('service_audit_log').select('id', { count: 'exact', head: true })
      .gte('changed_at', today).then(r => r.count ?? 0),
    supabase.from('member_audit_log').select('id', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId).gte('changed_at', weekAgo).then(r => r.count ?? 0),
    supabase.from('service_audit_log').select('id', { count: 'exact', head: true })
      .gte('changed_at', weekAgo).then(r => r.count ?? 0),
    supabase.from('member_audit_log').select('id', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId).then(r => r.count ?? 0),
    supabase.from('service_audit_log').select('id', { count: 'exact', head: true })
      .then(r => r.count ?? 0),
  ])

  return {
    totalToday:   (todayMem as number) + (todaySvc as number),
    totalWeek:    (weekMem as number)  + (weekSvc as number),
    totalMember:  allMem as number,
    totalService: allSvc as number,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_CSS = /* css */`
/* ════════════════════════════════════════════════
   AUDIT LOG TAB  — scoped under .ald-*
════════════════════════════════════════════════ */

/* Table grid — same responsive approach as Accounts */
.ald-row-grid {
  grid-template-columns: 120px 1fr 160px 120px 130px 160px;
}
@media (max-width: 1100px) {
  .ald-row-grid { grid-template-columns: 100px 1fr 140px 120px 160px; }
  .ald-col-entity { display: none !important; }
}
@media (max-width: 800px) {
  .ald-row-grid { grid-template-columns: 100px 1fr 120px 160px; }
  .ald-col-entity,
  .ald-col-old { display: none !important; }
}
@media (max-width: 600px) {
  .ald-row-grid { grid-template-columns: 100px 1fr 160px; }
  .ald-col-entity,
  .ald-col-old,
  .ald-col-new { display: none !important; }
}

/* Source badge */
.ald-source-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 99px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.ald-source-member {
  background: rgba(0,75,160,0.1); border: 1px solid rgba(0,75,160,0.25);
  color: var(--caci-blue-light);
}
.ald-source-service {
  background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
  color: #56d364;
}

/* Field changed */
.ald-field {
  font-family: monospace; font-size: 11px; color: var(--text-primary);
  background: var(--bg-hover); padding: 2px 7px;
  border-radius: 4px; white-space: nowrap;
}

/* Old / New value */
.ald-value-cell {
  font-size: 12px; color: var(--text-secondary);
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ald-value-null { color: var(--text-muted); font-style: italic; }
.ald-value-old { color: var(--caci-red); }
.ald-value-new { color: #56d364; }

/* Changed by */
.ald-by {
  display: flex; align-items: center; gap: 6px;
}
.ald-by-av {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 700; color: #fff;
}

/* Timestamp */
.ald-timestamp {
  font-size: 11px; color: var(--text-muted); white-space: nowrap;
}

/* Date range inputs */
.ald-date-range {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ald-date-inp {
  height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-primary);
  font-family: var(--font-sans); font-size: 13px;
  padding: 0 12px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.ald-date-inp:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.ald-date-inp::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
}

/* Pagination */
.ald-pagination {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-md); flex-wrap: wrap;
}
.ald-page-info { font-size: 12px; color: var(--text-secondary); }
.ald-page-btns { display: flex; align-items: center; gap: var(--space-sm); }
.ald-page-btn {
  height: 34px; padding: 0 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  font-size: 13px; cursor: pointer; font-family: var(--font-sans);
  transition: all 0.15s; display: flex; align-items: center; gap: 5px;
}
.ald-page-btn:hover:not(:disabled) {
  border-color: var(--border-strong); color: var(--text-primary);
}
.ald-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ald-page-btn.active {
  background: var(--caci-blue); border-color: transparent; color: #fff;
}

/* Mobile card for audit */
.ald-mob-card {
  background: linear-gradient(135deg, var(--bg-card), var(--bg-page));
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  animation: awFadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both;
  display: flex; flex-direction: column; gap: 8px;
}
.ald-mob-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ald-change-arrow { color: var(--text-muted); font-size: 12px; flex-shrink: 0; }

/* Export btn */
.ald-export-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary); font-size: 13px; font-family: var(--font-sans);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.ald-export-btn i { font-size: 14px; }
.ald-export-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
`

let _auditCSSInjected = false
function _injectAuditCSS(): void {
  if (_auditCSSInjected) return
  _auditCSSInjected = true
  const s = document.createElement('style')
  s.id = 'ald-tab-css'
  s.textContent = AUDIT_CSS
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fieldLabel(field: string): string {
  // Convert snake_case to Title Case
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG TAB
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export class AuditLogTab implements WorkspaceTab {
  readonly id         = 'audit'
  readonly label      = 'Audit Log'
  readonly icon       = 'clock-history'
  readonly permission = 'admin.audit.view'

  private _container:  HTMLElement | null = null
  private _entries:    AuditEntry[]       = []
  private _total       = 0
  private _page        = 0
  private _search      = ''
  private _source:     AuditSource | 'all' = 'all'
  private _fromDate    = ''
  private _toDate      = ''
  private _loading     = false
  private _destroyed   = false

  // Summary stats (loaded once)
  private _summary: Awaited<ReturnType<typeof getAuditSummary>> | null = null

  async render(container: HTMLElement): Promise<void> {
    _injectAuditCSS()
    injectWidgetCSS()
    this._container = container
    this._destroyed = false
    this._page      = 0

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      container.innerHTML = `
        <div class="aw-empty" style="padding:60px 20px;">
          <div class="aw-empty-icon-wrap"><i class="bi bi-building-slash"></i></div>
          <p class="aw-empty-title">No assembly linked</p>
        </div>`
      return
    }

    // Skeleton
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg);">
        <div class="aw-stats-row">
          ${[1,2,3,4].map(() => `<div style="height:90px;background:var(--bg-card);
            border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>`).join('')}
        </div>
        <div style="height:52px;background:var(--bg-card);border-radius:var(--radius-lg);
                    border:1px solid var(--border-default);"></div>
        <div style="height:480px;background:var(--bg-card);border-radius:var(--radius-lg);
                    border:1px solid var(--border-default);"></div>
      </div>`

    // Load summary and first page in parallel
    try {
      ;[this._summary] = await Promise.all([
        getAuditSummary(assemblyId),
        this._fetchPage(assemblyId),
      ])
    } catch (err) {
      console.error('[AuditLogTab] load error', err)
    }

    if (this._destroyed) return
    this._buildUI(assemblyId)
  }

  private async _fetchPage(assemblyId: string): Promise<void> {
    this._loading = true
    try {
      const result = await loadAuditLog({
        assemblyId,
        fromDate: this._fromDate || undefined,
        toDate:   this._toDate   || undefined,
        source:   this._source,
        limit:    PAGE_SIZE,
        offset:   this._page * PAGE_SIZE,
      })
      this._entries = result.entries
      this._total   = result.total
    } finally {
      this._loading = false
    }
  }

  private _buildUI(assemblyId: string): void {
    if (!this._container || this._destroyed) return
    this._container.innerHTML = ''

    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-lg);'
    this._container.appendChild(wrap)

    // ── Stats ──────────────────────────────────────────────────────────────
    if (this._summary) {
      const s = this._summary
      new StatsCardGroup(
        wrap,
        [
          {
            id: 'today', label: 'Today', icon: 'calendar-day',
            accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.15)',
            getValue: () => s.totalToday,
            getSub:   () => 'changes',
          },
          {
            id: 'week', label: 'This Week', icon: 'calendar-week-fill',
            accentColor: '#22c55e', glowColor: 'rgba(34,197,94,0.15)',
            getValue: () => s.totalWeek,
            getSub:   () => 'last 7 days',
          },
          {
            id: 'member', label: 'Member Changes', icon: 'person-fill',
            accentColor: '#d29922', glowColor: 'rgba(210,153,34,0.15)',
            getValue: () => s.totalMember,
          },
          {
            id: 'service', label: 'Service Changes', icon: 'calendar-event-fill',
            accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)',
            getValue: () => s.totalService,
          },
        ],
        (id: string | null) => {
          if (id === 'member' || id === 'service') {
            this._source = id as AuditSource
          } else {
            this._source = 'all'
          }
          this._page = 0
          this._refresh(assemblyId)
        }
      )
    }

    // ── Filter bar ─────────────────────────────────────────────────────────
    const filterBar = document.createElement('div')
    filterBar.className = 'aw-toolbar'
    filterBar.innerHTML = `
      <div class="aw-search">
        <i class="bi bi-search"></i>
        <input type="text" placeholder="Search by field, value, or user…" id="ald-search">
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;flex-shrink:0;">
        <div class="aw-filter-wrap">
          <i class="bi bi-layers"></i>
          <select class="aw-filter-select" id="ald-source-filter">
            <option value="all">All Sources</option>
            <option value="member">Members</option>
            <option value="service">Services</option>
          </select>
        </div>
        <div class="ald-date-range">
          <input type="date" class="ald-date-inp" id="ald-from" title="From date">
          <span style="font-size:12px;color:var(--text-muted);">to</span>
          <input type="date" class="ald-date-inp" id="ald-to" title="To date">
          <button class="aw-tbtn" id="ald-date-clear" title="Clear dates"
                  style="padding:0 10px;height:40px;">
            <i class="bi bi-x-circle" style="font-size:13px;"></i>
          </button>
        </div>
        <button class="ald-export-btn" id="ald-export" title="Export audit log">
          <i class="bi bi-download"></i>
          <span class="aw-btn-label">Export CSV</span>
        </button>
      </div>`
    wrap.appendChild(filterBar)

    // Search handler
    filterBar.querySelector<HTMLInputElement>('#ald-search')
      ?.addEventListener('input', debounce((e: Event) => {
        this._search = (e.target as HTMLInputElement).value.toLowerCase()
        this._renderTableArea()
      }, 200))

    // Source filter
    filterBar.querySelector<HTMLSelectElement>('#ald-source-filter')
      ?.addEventListener('change', e => {
        this._source = (e.target as HTMLSelectElement).value as any
        this._page   = 0
        this._refresh(assemblyId)
      })

    // Date range
    filterBar.querySelector('#ald-from')?.addEventListener('change', e => {
      this._fromDate = (e.target as HTMLInputElement).value
      this._page = 0
      this._refresh(assemblyId)
    })
    filterBar.querySelector('#ald-to')?.addEventListener('change', e => {
      this._toDate = (e.target as HTMLInputElement).value
      this._page   = 0
      this._refresh(assemblyId)
    })
    filterBar.querySelector('#ald-date-clear')?.addEventListener('click', () => {
      this._fromDate = ''
      this._toDate   = ''
      const from = filterBar.querySelector<HTMLInputElement>('#ald-from')
      const to   = filterBar.querySelector<HTMLInputElement>('#ald-to')
      if (from) from.value = ''
      if (to)   to.value   = ''
      this._page = 0
      this._refresh(assemblyId)
    })

    // Export
    filterBar.querySelector('#ald-export')?.addEventListener('click', () => {
      this._exportCSV()
    })

    // ── Table area ─────────────────────────────────────────────────────────
    const tableArea = document.createElement('div')
    tableArea.id = 'ald-table-area'
    wrap.appendChild(tableArea)

    this._renderTableArea()
  }

  private async _refresh(assemblyId: string): Promise<void> {
    if (this._destroyed) return
    const tableArea = this._container?.querySelector<HTMLElement>('#ald-table-area')
    if (tableArea) {
      tableArea.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;
                    padding:64px;color:var(--text-muted);gap:10px;">
          <span class="aw-spinner" style="border-top-color:var(--caci-blue-light);"></span>
          Loading…
        </div>`
    }
    await this._fetchPage(assemblyId)
    if (this._destroyed) return
    this._renderTableArea()
  }

  private _renderTableArea(): void {
    const tableArea = this._container?.querySelector<HTMLElement>('#ald-table-area')
    if (!tableArea || this._destroyed) return

    // Client-side search filter on loaded page
    const displayed = this._search
      ? this._entries.filter(e =>
          e.fieldChanged.toLowerCase().includes(this._search) ||
          (e.oldValue ?? '').toLowerCase().includes(this._search) ||
          (e.newValue ?? '').toLowerCase().includes(this._search) ||
          (e.changedByName ?? '').toLowerCase().includes(this._search) ||
          e.entityLabel.toLowerCase().includes(this._search)
        )
      : this._entries

    const totalPages = Math.ceil(this._total / PAGE_SIZE)

    if (!displayed.length && !this._loading) {
      tableArea.innerHTML = `
        <div class="aw-table-wrap">
          <div class="aw-empty" style="padding:64px 20px;">
            <div class="aw-empty-icon-wrap"><i class="bi bi-clock"></i></div>
            <p class="aw-empty-title">No audit entries found</p>
            <p class="aw-empty-desc">
              ${this._fromDate || this._toDate || this._source !== 'all'
                ? 'No changes match your current filters. Try adjusting the date range or source.'
                : 'No changes have been recorded yet for this assembly.'}
            </p>
          </div>
        </div>`
      return
    }

    // ── Desktop table ──────────────────────────────────────────────────────
    const headerHTML = `
      <div class="aw-table-header aw-table-row ald-row-grid" style="min-height:40px;cursor:default;">
        <div class="aw-col-hd">Source</div>
        <div class="aw-col-hd">Field Changed</div>
        <div class="aw-col-hd ald-col-entity">Entity</div>
        <div class="aw-col-hd ald-col-old">Old Value</div>
        <div class="aw-col-hd ald-col-new">New Value</div>
        <div class="aw-col-hd">Changed By · When</div>
      </div>`

    const rowsHTML = displayed.map((e, i) => {
      const delay      = Math.min(i * 25, 300)
      const byAv       = e.changedByName ? initials(e.changedByName) : '?'
      const byColor    = e.changedByName ? avatarColor(e.changedByName) : 'var(--text-muted)'

      return `
      <div class="aw-table-row ald-row-grid"
           style="animation:awFadeUp 0.3s cubic-bezier(0.16,1,0.3,1) ${delay}ms both;">
        <div class="aw-col-cell">
          <span class="ald-source-badge ${e.source === 'member' ? 'ald-source-member' : 'ald-source-service'}">
            <i class="bi bi-${e.source === 'member' ? 'person-fill' : 'calendar-event-fill'}" style="font-size:10px;"></i>
            ${e.source === 'member' ? 'Member' : 'Service'}
          </span>
        </div>
        <div class="aw-col-cell" style="flex-direction:column;align-items:flex-start;gap:2px;">
          <span class="ald-field">${e.fieldChanged}</span>
          <span style="font-size:10px;color:var(--text-muted);">${e.entityLabel}</span>
        </div>
        <div class="aw-col-cell ald-col-entity">
          <span style="font-size:12px;color:var(--text-secondary);">${e.entityLabel}</span>
        </div>
        <div class="aw-col-cell ald-col-old">
          <span class="ald-value-cell ald-value-old" title="${e.oldValue ?? '—'}">
            ${e.oldValue ?? `<span class="ald-value-null">null</span>`}
          </span>
        </div>
        <div class="aw-col-cell ald-col-new">
          <span class="ald-value-cell ald-value-new" title="${e.newValue ?? '—'}">
            ${e.newValue ?? `<span class="ald-value-null">null</span>`}
          </span>
        </div>
        <div class="aw-col-cell" style="flex-direction:column;align-items:flex-start;gap:3px;">
          <div class="ald-by">
            <div class="ald-by-av" style="background:${byColor};">${byAv}</div>
            <span style="font-size:12px;color:var(--text-primary);">
              ${e.changedByName ?? 'Unknown user'}
            </span>
          </div>
          <span class="ald-timestamp" title="${formatAbsoluteTime(e.changedAt)}">
            ${formatRelativeTime(e.changedAt)}
          </span>
        </div>
      </div>`
    }).join('')

    // Mobile cards
    const mobCardsHTML = displayed.map((e, i) => {
      const delay   = Math.min(i * 25, 300)
      const byAv    = e.changedByName ? initials(e.changedByName) : '?'
      const byColor = e.changedByName ? avatarColor(e.changedByName) : 'var(--text-muted)'

      return `
      <div class="ald-mob-card" style="animation-delay:${delay}ms;">
        <div class="ald-mob-row">
          <span class="ald-source-badge ${e.source === 'member' ? 'ald-source-member' : 'ald-source-service'}">
            <i class="bi bi-${e.source === 'member' ? 'person-fill' : 'calendar-event-fill'}" style="font-size:10px;"></i>
            ${e.source === 'member' ? 'Member' : 'Service'}
          </span>
          <span class="ald-timestamp">${formatRelativeTime(e.changedAt)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="ald-field">${e.fieldChanged}</span>
          <span style="font-size:11px;color:var(--text-muted);">on ${e.entityLabel}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
          ${e.oldValue
            ? `<span class="ald-value-old" style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.oldValue}</span>
               <i class="bi bi-arrow-right ald-change-arrow"></i>`
            : ''}
          <span class="ald-value-new" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${e.newValue ?? `<span class="ald-value-null">null</span>`}
          </span>
        </div>
        <div class="ald-by">
          <div class="ald-by-av" style="background:${byColor};width:18px;height:18px;font-size:7px;">${byAv}</div>
          <span style="font-size:11px;color:var(--text-secondary);">
            ${e.changedByName ?? 'Unknown'}
          </span>
          <span style="font-size:10px;color:var(--text-muted);">${formatAbsoluteTime(e.changedAt)}</span>
        </div>
      </div>`
    }).join('')

    // Pagination
    const start = this._page * PAGE_SIZE + 1
    const end   = Math.min((this._page + 1) * PAGE_SIZE, this._total)
    const pageNums = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
      // Smart pagination: always show first/last, window around current
      const maxPage = totalPages - 1
      if (totalPages <= 7) return i
      if (i === 0) return 0
      if (i === 6) return maxPage
      const start = Math.max(1, this._page - 2)
      const end   = Math.min(maxPage - 1, this._page + 2)
      if (i - 1 < end - start + 1) return start + i - 1
      return -1 // placeholder for ellipsis
    })

    const pageButtonsHTML = pageNums.map(n => {
      if (n < 0) return `<span style="font-size:12px;color:var(--text-muted);">…</span>`
      return `<button class="ald-page-btn${n === this._page ? ' active' : ''}" data-go-page="${n}">
        ${n + 1}
      </button>`
    }).join('')

    tableArea.innerHTML = `
      <div class="aw-table-wrap">
        ${headerHTML}
        <div class="aw-table-body">${rowsHTML}</div>
      </div>
      <div class="aw-mobile-rows" style="display:none;flex-direction:column;gap:8px;">
        ${mobCardsHTML}
      </div>

      <!-- Pagination -->
      <div class="ald-pagination" style="margin-top:var(--space-md);">
        <span class="ald-page-info">
          Showing <strong>${start}–${end}</strong> of <strong>${this._total}</strong> entries
        </span>
        <div class="ald-page-btns">
          <button class="ald-page-btn" id="ald-prev" ${this._page === 0 ? 'disabled' : ''}>
            <i class="bi bi-chevron-left" style="font-size:12px;"></i>
            Prev
          </button>
          ${pageButtonsHTML}
          <button class="ald-page-btn" id="ald-next" ${this._page >= totalPages - 1 ? 'disabled' : ''}>
            Next
            <i class="bi bi-chevron-right" style="font-size:12px;"></i>
          </button>
        </div>
      </div>`

    // Mobile swap
    if (window.innerWidth <= 639) {
      tableArea.querySelector('.aw-table-wrap')!.querySelector('.aw-table-body')!
        .parentElement!.style.cssText = 'background:transparent;border:none;border-radius:0;overflow:visible;'
      const mobRows = tableArea.querySelector<HTMLElement>('.aw-mobile-rows')!
      mobRows.style.display = 'flex'
    }

    // Bind pagination
    tableArea.querySelector('#ald-prev')?.addEventListener('click', () => {
      if (this._page > 0) {
        this._page--
        this._refresh(getActiveAssemblyId()!)
      }
    })
    tableArea.querySelector('#ald-next')?.addEventListener('click', () => {
      if (this._page < totalPages - 1) {
        this._page++
        this._refresh(getActiveAssemblyId()!)
      }
    })
    tableArea.querySelectorAll<HTMLButtonElement>('[data-go-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset['goPage']!, 10)
        if (!isNaN(p) && p !== this._page) {
          this._page = p
          this._refresh(getActiveAssemblyId()!)
        }
      })
    })
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  private _exportCSV(): void {
    if (!this._entries.length) {
      showToast('No entries to export', 'info')
      return
    }

    const header = ['Source', 'Entity', 'Field Changed', 'Old Value', 'New Value', 'Changed By', 'Changed At']
    const rows   = this._entries.map(e => [
      e.source,
      e.entityLabel,
      e.fieldChanged,
      e.oldValue ?? '',
      e.newValue ?? '',
      e.changedByName ?? e.changedBy,
      formatAbsoluteTime(e.changedAt),
    ])

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Audit log exported', 'success')
  }

  destroy(): void {
    this._destroyed = true
    this._container = null
  }
}