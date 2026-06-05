// src/modules/events_&_services/pages/Services.ts
// Services & Events workspace — single PageModule, tab-based.

import type { PageModule }    from '../../../types/module.types'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }                from '@core/authorization/authorization-service'
import { PERMISSIONS }        from '@core/authorization/permissions'
import { on, off }            from '@core/events'
import { debounce }           from '@shared/utils/debounce'
import {
  listServicesDisplay,
  listServiceTemplates,
  getServiceDisplay,
  getServiceStats,
  listAttendanceDisplay,
  softDeleteService,
  createService,
  updateService,
  createServiceTemplate,
  updateServiceTemplate,
  softDeleteTemplate,
  bulkUpsertAttendance,
  createServiceFromTemplate,
  formatDate, formatDateShort, formatTime, isToday, isFuture,
  buildRecurrenceLabel,
} from '../repository'
import type { ServicesPageState, ServiceDisplay, AttendanceDisplay, TemplateDisplay } from '../types'
import { RECURRENCE_LABELS, SERVICE_TYPES, DAYS_OF_WEEK } from '../types'
import type { ServiceStatus, AttendanceStatus } from '../../../types/service.types'
import SVC_CSS from '../styles/events_&_services.css?raw'

// ── CSS injection ─────────────────────────────────────────────────────────────

function injectCSS(): void {
  if (document.getElementById('svc-page-css')) return
  const s = document.createElement('style')
  s.id = 'svc-page-css'
  s.textContent = SVC_CSS
  document.head.appendChild(s)
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']

function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string): string {
  const parts = name.trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadge(status: ServiceStatus): string {
  return `<span class="svc-status-badge svc-status-${status}">
    <span class="svc-status-dot"></span>${status}
  </span>`
}

function attBadge(status: AttendanceStatus): string {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return `<span class="svc-att-badge svc-att-badge-${status}">${label}</span>`
}

function serviceTypeColor(type: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    'Sunday Service':    { bg: 'rgba(0,75,160,0.1)',  color: 'var(--caci-blue-light)' },
    'Midweek Service':   { bg: 'rgba(34,197,94,0.1)', color: '#56d364' },
    'Prayer Meeting':    { bg: 'rgba(88,166,255,0.1)',color: '#58a6ff' },
    'Cell Meeting':      { bg: 'rgba(210,153,34,0.1)',color: '#d29922' },
    'Youth Service':     { bg: 'rgba(124,58,237,0.1)',color: '#a78bfa' },
    'Bible Study':       { bg: 'rgba(20,184,166,0.1)',color: '#2dd4bf' },
  }
  return map[type] ?? { bg: 'rgba(139,148,158,0.1)', color: 'var(--text-secondary)' }
}

// ── Page state ────────────────────────────────────────────────────────────────

const _state: ServicesPageState = {
  services: [], filtered: [],
  search: '', statusFilter: 'all', typeFilter: 'all', groupFilter: 'all',
  statFilter: null, view: 'list',
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  openServiceId: null,
  attServices: [], attServiceId: null, attRecords: [], attFiltered: [],
  attSearch: '', attStatusFilter: 'all', attChanged: new Set(), attCurrentStatus: new Map(),
  templates: [], tmplFiltered: [], tmplSearch: '',
  reportRange: '30d',
  loading: false, saving: false,
}

let _container:   HTMLElement | null = null
let _destroyed    = false
let _activeTab    = 'schedule'
let _tabContent:  HTMLElement | null = null
let _ctxTarget:   string | null = null

// ── Realtime listeners ────────────────────────────────────────────────────────

function _onServiceCreated() { if (_activeTab === 'schedule')   _loadSchedule() }
function _onServiceUpdated() { if (_activeTab === 'schedule')   _loadSchedule() }
function _onServiceDeleted() { if (_activeTab === 'schedule')   _loadSchedule() }
function _onTmplCreated()    { if (_activeTab === 'templates')  _loadTemplates() }
function _onTmplUpdated()    { if (_activeTab === 'templates')  _loadTemplates() }

// ── Toast ─────────────────────────────────────────────────────────────────────

function _toast(msg: string, icon = 'bi-check-circle-fill', color = '#56d364'): void {
  const id = 'svc-toast-el'
  let el = document.getElementById(id) as HTMLElement
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.className = 'svc-toast'
    document.body.appendChild(el)
  }
  el.innerHTML = `<i class="bi ${icon}" style="font-size:15px;color:${color};"></i><span>${msg}</span>`
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 3000)
}

// ── Context menu ──────────────────────────────────────────────────────────────

function _closeCtx(): void {
  document.getElementById('svc-ctx')?.remove()
}

function _openCtx(
  x: number, y: number,
  items: Array<{ label: string; icon: string; danger?: boolean; action: () => void }>
): void {
  _closeCtx()
  const menu = document.createElement('div')
  menu.id = 'svc-ctx'
  menu.className = 'svc-ctx-menu'
  menu.style.cssText = `left:${x}px;top:${y}px;`
  menu.innerHTML = items.map((item, i) =>
    `<div class="svc-ctx-item${item.danger ? ' danger' : ''}" data-idx="${i}">
      <i class="bi ${item.icon}"></i>${item.label}
    </div>`
  ).join('')
  document.body.appendChild(menu)

  // Flip if off-screen
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect()
    if (r.right > window.innerWidth)  menu.style.left = `${x - r.width}px`
    if (r.bottom > window.innerHeight) menu.style.top = `${y - r.height}px`
  })

  menu.querySelectorAll<HTMLElement>('.svc-ctx-item').forEach((el, i) => {
    el.addEventListener('click', () => { _closeCtx(); items[i].action() })
  })
  setTimeout(() => {
    document.addEventListener('click', _closeCtx, { once: true })
  }, 0)
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function _openDrawer(
  title: string,
  bodyHtml: string,
  footerHtml: string,
  onClose?: () => void
): { update: (body: string, footer: string) => void; close: () => void } {
  document.getElementById('svc-drawer-wrap')?.remove()

  const wrap = document.createElement('div')
  wrap.id = 'svc-drawer-wrap'
  wrap.innerHTML = `
    <div class="svc-drawer-backdrop" id="svc-drawer-bd"></div>
    <div class="svc-drawer" id="svc-drawer" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="svc-drawer-header">
        <h2 class="svc-drawer-title" id="svc-drawer-title">${title}</h2>
        <button class="svc-drawer-close" id="svc-drawer-close" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="svc-drawer-body" id="svc-drawer-body">${bodyHtml}</div>
      <div class="svc-drawer-footer" id="svc-drawer-footer">${footerHtml}</div>
    </div>`
  document.body.appendChild(wrap)

  const close = () => {
    wrap.remove()
    onClose?.()
  }

  wrap.querySelector('#svc-drawer-bd')?.addEventListener('click', close)
  wrap.querySelector('#svc-drawer-close')?.addEventListener('click', close)

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc) }
  })

  return {
    close,
    update(body: string, footer: string) {
      const b = document.getElementById('svc-drawer-body')
      const f = document.getElementById('svc-drawer-footer')
      if (b) b.innerHTML = body
      if (f) f.innerHTML = footer
    }
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function _openModal(
  title: string,
  bodyHtml: string,
  footerHtml: string,
  opts: { large?: boolean } = {}
): { el: HTMLElement; close: () => void } {
  document.getElementById('svc-modal-wrap')?.remove()

  const wrap = document.createElement('div')
  wrap.id = 'svc-modal-wrap'
  wrap.className = 'svc-modal-backdrop'
  wrap.innerHTML = `
    <div class="svc-modal${opts.large ? ' svc-modal-lg' : ''}" role="dialog" aria-modal="true">
      <div class="svc-modal-header">
        <h2 class="svc-modal-title">${title}</h2>
        <button class="svc-modal-close" id="svc-modal-close" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="svc-modal-body" id="svc-modal-body">${bodyHtml}</div>
      <div class="svc-modal-footer" id="svc-modal-footer">${footerHtml}</div>
    </div>`
  document.body.appendChild(wrap)

  const close = () => wrap.remove()
  wrap.querySelector('#svc-modal-close')?.addEventListener('click', close)
  wrap.addEventListener('click', e => { if (e.target === wrap) close() })
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc) }
  })

  return { el: wrap, close }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function _confirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => Promise<void>
): void {
  const { el, close } = _openModal('', `
    <div class="svc-confirm-box" style="margin:auto;">
      <div class="svc-confirm-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
      <div class="svc-confirm-title">${title}</div>
      <div class="svc-confirm-msg">${message}</div>
      <div class="svc-confirm-btns">
        <button class="btn btn-outline" id="svc-conf-cancel">Cancel</button>
        <button class="btn btn-danger" id="svc-conf-ok">
          <i class="bi bi-trash3"></i> ${confirmLabel}
        </button>
      </div>
    </div>`, '', { large: false })

  el.querySelector<HTMLElement>('#svc-conf-cancel')?.addEventListener('click', close)
  el.querySelector<HTMLElement>('#svc-conf-ok')?.addEventListener('click', async () => {
    const btn = el.querySelector<HTMLButtonElement>('#svc-conf-ok')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`
    try {
      await onConfirm()
      close()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-trash3"></i> ${confirmLabel}`
      _toast(err?.message ?? 'Operation failed.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

// ══════════════════════════════════════════════════════
// TAB: SCHEDULE
// ══════════════════════════════════════════════════════

async function _loadSchedule(): Promise<void> {
  if (_destroyed) return
  const assemblyId = getActiveAssemblyId()

  try {
    const [services] = await Promise.all([
      listServicesDisplay(),
    ])
    if (_destroyed) return
    _state.services = services
    _applyScheduleFilters()
    _renderScheduleStats()
    _renderScheduleContent()
  } catch (err: any) {
    if (_tabContent) {
      _tabContent.innerHTML = `<div class="svc-empty">
        <i class="bi bi-exclamation-circle"></i>
        <div class="svc-empty-title">Failed to load services</div>
        <div class="svc-empty-sub">${err?.message ?? 'Something went wrong.'}</div>
      </div>`
    }
  }
}

function _applyScheduleFilters(): void {
  const q = _state.search.toLowerCase()
  _state.filtered = _state.services.filter(s => {
    const statusOk = _state.statusFilter === 'all' || s.status === _state.statusFilter
    const typeOk   = _state.typeFilter === 'all'   || s.service_type === _state.typeFilter
    const groupOk  = _state.groupFilter === 'all'  || s.group_id === _state.groupFilter || (!s.group_id && _state.groupFilter === 'assembly')
    const searchOk = !q || s.title.toLowerCase().includes(q) || (s.service_type ?? '').toLowerCase().includes(q) || (s.venue ?? '').toLowerCase().includes(q)
    const statOk   = !_state.statFilter
      || _state.statFilter === 'all'
      || (_state.statFilter === 'upcoming'   && isFuture(s.service_date))
      || (_state.statFilter === 'today'      && isToday(s.service_date))
      || (_state.statFilter === 'completed'  && s.status === 'completed')
      || (_state.statFilter === 'cancelled'  && s.status === 'cancelled')
    return statusOk && typeOk && groupOk && searchOk && statOk
  })
}

function _renderScheduleTab(): void {
  if (!_tabContent) return
  const user     = getCurrentUser()
  const canCreate = user && can(user, PERMISSIONS.SERVICES_CREATE)
  const canEdit   = user && can(user, PERMISSIONS.SERVICES_EDIT)

  _tabContent.innerHTML = /* html */`
    <!-- Stat cards -->
    <div class="svc-stats-row" id="svc-sched-stats"></div>

    <!-- Filter banner -->
    <div class="svc-filter-banner" id="svc-sched-banner"></div>

    <!-- Toolbar -->
    <div class="svc-toolbar" id="svc-sched-toolbar">
      <div class="svc-search-wrap" id="svc-sched-search-wrap">
        <i class="bi bi-search"></i>
        <input type="text" id="svc-sched-search" placeholder="Search services…" autocomplete="off" aria-label="Search services">
      </div>
      <button class="svc-tbtn svc-tbtn-icon" id="svc-sched-mob-search" aria-label="Search">
        <i class="bi bi-search"></i>
      </button>
      <div class="svc-filter-wrap">
        <i class="bi bi-calendar3"></i>
        <select class="svc-filter-select" id="svc-sched-type-filter" aria-label="Filter by type">
          <option value="all">All Types</option>
          ${SERVICE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="svc-filter-wrap">
        <i class="bi bi-funnel"></i>
        <select class="svc-filter-select" id="svc-sched-status-filter" aria-label="Filter by status">
          <option value="all">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="svc-toolbar-actions">
        <div class="svc-view-toggle">
          <button class="svc-view-btn ${_state.view === 'list' ? 'active' : ''}" id="svc-view-list" title="List view" aria-label="List view">
            <i class="bi bi-list-ul"></i>
          </button>
          <button class="svc-view-btn ${_state.view === 'calendar' ? 'active' : ''}" id="svc-view-cal" title="Calendar view" aria-label="Calendar view">
            <i class="bi bi-calendar3"></i>
          </button>
        </div>
        ${canCreate ? `
        <button class="svc-tbtn" id="svc-sched-from-tmpl">
          <i class="bi bi-lightning"></i>
          <span class="svc-btn-label">From Template</span>
        </button>
        <button class="svc-tbtn svc-tbtn-primary" id="svc-sched-create">
          <i class="bi bi-plus-lg"></i>
          <span class="svc-btn-label">New Service</span>
        </button>` : ''}
      </div>
    </div>

    <!-- Meta bar -->
    <div class="svc-meta" id="svc-sched-meta"></div>

    <!-- Content area — list or calendar -->
    <div id="svc-sched-content"></div>
  `

  _renderScheduleStats()
  _renderScheduleContent()
  _bindScheduleToolbar()
}

function _renderScheduleStats(): void {
  const el = _tabContent?.querySelector<HTMLElement>('#svc-sched-stats')
  if (!el) return

  const { services } = _state
  const today    = new Date().toISOString().split('T')[0]
  const upcoming = services.filter(s => s.service_date >= today && s.status !== 'cancelled').length
  const todaySvc = services.filter(s => isToday(s.service_date)).length

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const completedMonth = services.filter(s =>
    s.status === 'completed' && s.service_date >= monthStart && s.service_date <= monthEnd
  ).length
  const cancelled = services.filter(s => s.status === 'cancelled').length

  el.innerHTML = `
  <div class="svc-stat" data-filter="upcoming" style="--stat-accent:var(--caci-blue);--stat-glow:rgba(0,75,160,0.2);" role="button" tabindex="0" aria-label="Filter: Upcoming">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
        <i class="bi bi-calendar-event-fill" style="color:var(--caci-blue-light);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Upcoming</span>
    </div>
    <div class="svc-stat-value">${upcoming}
      <span class="svc-stat-sub">services</span>
    </div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${services.length ? Math.round(upcoming/services.length*100) : 0}%;background:linear-gradient(90deg,var(--caci-blue),var(--caci-blue-light));"></div>
    </div>
  </div>

  <div class="svc-stat" data-filter="today" style="--stat-accent:#f0a500;--stat-glow:rgba(240,165,0,0.2);" role="button" tabindex="0" aria-label="Filter: Today">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(240,165,0,0.12);">
        <i class="bi bi-sun-fill" style="color:#f0a500;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Today</span>
    </div>
    <div class="svc-stat-value">${todaySvc}
      <span class="svc-stat-sub">services</span>
    </div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${todaySvc > 0 ? 100 : 0}%;background:rgba(240,165,0,0.5);"></div>
    </div>
  </div>

  <div class="svc-stat" data-filter="completed" style="--stat-accent:#22c55e;--stat-glow:rgba(34,197,94,0.18);" role="button" tabindex="0" aria-label="Filter: Completed">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
        <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Completed (Month)</span>
    </div>
    <div class="svc-stat-value">${completedMonth}</div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:100%;background:rgba(34,197,94,0.4);"></div>
    </div>
  </div>

  <div class="svc-stat" data-filter="cancelled" style="--stat-accent:var(--caci-red);--stat-glow:rgba(198,0,38,0.18);" role="button" tabindex="0" aria-label="Filter: Cancelled">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(198,0,38,0.08);">
        <i class="bi bi-x-circle-fill" style="color:var(--caci-red);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Cancelled</span>
    </div>
    <div class="svc-stat-value">${cancelled}</div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${services.length ? Math.round(cancelled/services.length*100) : 0}%;background:rgba(198,0,38,0.35);"></div>
    </div>
  </div>`

  el.querySelectorAll<HTMLElement>('.svc-stat').forEach(card => {
    const onClick = () => {
      const key = card.dataset['filter']!
      if (_state.statFilter === key) {
        _clearStatFilter()
      } else {
        _state.statFilter = key
        el.querySelectorAll('.svc-stat').forEach(c => {
          c.classList.toggle('active-filter', c === card)
        })
        _applyScheduleFilters()
        _renderScheduleContent()
        _renderScheduleFilterBanner()
      }
    }
    card.addEventListener('click', onClick)
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onClick() })
  })

  if (_state.statFilter) {
    const active = el.querySelector<HTMLElement>(`[data-filter="${_state.statFilter}"]`)
    active?.classList.add('active-filter')
  }
}

function _clearStatFilter(): void {
  _state.statFilter = null
  _tabContent?.querySelectorAll('.svc-stat').forEach(c => c.classList.remove('active-filter'))
  _applyScheduleFilters()
  _renderScheduleContent()
  _renderScheduleFilterBanner()
}

function _renderScheduleFilterBanner(): void {
  const banner = _tabContent?.querySelector<HTMLElement>('#svc-sched-banner')
  if (!banner) return

  if (_state.statFilter && _state.statFilter !== 'all') {
    const labels: Record<string, string> = {
      upcoming: 'Upcoming', today: 'Today', completed: 'Completed', cancelled: 'Cancelled',
    }
    banner.classList.add('show')
    banner.innerHTML = `
      <i class="bi bi-funnel-fill" style="color:var(--caci-blue-light);"></i>
      <span class="svc-filter-pill">${labels[_state.statFilter] ?? _state.statFilter}</span>
      <span style="font-size:12px;color:var(--text-secondary);">${_state.filtered.length} result${_state.filtered.length !== 1 ? 's' : ''}</span>
      <button class="svc-filter-clear" id="svc-sched-clear-filter"><i class="bi bi-x"></i> Clear</button>`
    banner.querySelector('#svc-sched-clear-filter')?.addEventListener('click', () => _clearStatFilter())
  } else {
    banner.classList.remove('show')
  }
}

function _renderScheduleContent(): void {
  const content = _tabContent?.querySelector<HTMLElement>('#svc-sched-content')
  const meta    = _tabContent?.querySelector<HTMLElement>('#svc-sched-meta')
  if (!content || !meta) return

  meta.innerHTML = `<span>Showing <strong>${_state.filtered.length}</strong> service${_state.filtered.length !== 1 ? 's' : ''}</span>`
  _renderScheduleFilterBanner()

  if (_state.view === 'calendar') {
    _renderCalendar(content)
  } else {
    _renderServiceList(content)
  }
}

function _renderServiceList(container: HTMLElement): void {
  const user    = getCurrentUser()
  const canEdit = user && can(user, PERMISSIONS.SERVICES_EDIT)
  const canDel  = user && can(user, PERMISSIONS.SERVICES_DELETE)
  const list    = _state.filtered

  if (!list.length) {
    container.innerHTML = `<div class="svc-empty">
      <i class="bi bi-calendar-x"></i>
      <div class="svc-empty-title">No services found</div>
      <div class="svc-empty-sub">Try adjusting your search or filters.</div>
    </div>`
    return
  }

  container.innerHTML = `
    <div class="svc-table-wrap">
      <div class="svc-table-row header">
        <div class="svc-col-hd">Service</div>
        <div class="svc-col-hd">Date</div>
        <div class="svc-col-hd svc-col-hide-time">Time</div>
        <div class="svc-col-hd svc-col-hide-venue">Venue</div>
        <div class="svc-col-hd svc-col-hide-group">Group</div>
        <div class="svc-col-hd">Status</div>
        <div class="svc-col-hd">Attendance</div>
        <div class="svc-col-hd" style="justify-content:flex-end;">Actions</div>
      </div>
      <div id="svc-list-body">
        ${list.map((s, i) => {
          const tc = serviceTypeColor(s.service_type)
          const delay = Math.min(i * 30, 400)
          const attPct = s.attendance_count > 0
            ? Math.round(s.present_count / s.attendance_count * 100)
            : null

          return `
          <!-- Desktop row -->
          <div class="svc-table-row" data-svc-id="${s.id}" style="animation:svcFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) ${delay}ms both;">
            <div class="svc-col-cell" style="gap:10px;min-width:0;">
              <div style="width:36px;height:36px;border-radius:9px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-calendar2-week" style="font-size:15px;color:${tc.color};"></i>
              </div>
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.title}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${s.service_type}</div>
              </div>
            </div>
            <div class="svc-col-cell">
              <div>
                <div style="font-size:12px;font-weight:500;color:var(--text-primary);">${formatDateShort(s.service_date)}</div>
                ${isToday(s.service_date) ? '<div style="font-size:10px;color:#f0a500;font-weight:600;">TODAY</div>' : ''}
              </div>
            </div>
            <div class="svc-col-cell svc-col-hide-time">
              <span style="font-size:12px;color:var(--text-secondary);">${s.start_time ? formatTime(s.start_time) : '—'}</span>
            </div>
            <div class="svc-col-cell svc-col-hide-venue" style="min-width:0;">
              <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${s.venue ?? '—'}</span>
            </div>
            <div class="svc-col-cell svc-col-hide-group">
              <span style="font-size:12px;color:var(--text-secondary);">${s.group_name ?? 'All Members'}</span>
            </div>
            <div class="svc-col-cell">${statusBadge(s.status)}</div>
            <div class="svc-col-cell">
              ${s.attendance_count > 0
                ? `<div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;min-width:40px;height:4px;background:var(--border-default);border-radius:99px;overflow:hidden;">
                      <div style="height:100%;width:${attPct}%;background:#22c55e;border-radius:99px;transition:width 0.5s;"></div>
                    </div>
                    <span style="font-size:11px;color:var(--text-secondary);white-space:nowrap;">${s.present_count}/${s.attendance_count}</span>
                  </div>`
                : `<span style="font-size:11px;color:var(--text-muted);">—</span>`}
            </div>
            <div class="svc-col-cell" style="justify-content:flex-end;gap:4px;">
              <button class="svc-tbtn" data-action="view" data-svc="${s.id}" style="padding:0 8px;height:30px;font-size:12px;" title="View details">
                <i class="bi bi-eye"></i>
              </button>
              ${canEdit ? `<button class="svc-tbtn" data-action="ctx" data-svc="${s.id}" style="padding:0 8px;height:30px;font-size:12px;" title="More options">
                <i class="bi bi-three-dots"></i>
              </button>` : ''}
            </div>
          </div>

          <!-- Mobile card -->
          <div class="svc-card-row" data-svc-id="${s.id}" style="animation-delay:${delay}ms;">
            <div style="width:42px;height:42px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="bi bi-calendar2-week" style="font-size:18px;color:${tc.color};"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.title}</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
                ${formatDateShort(s.service_date)}${s.start_time ? ' · ' + formatTime(s.start_time) : ''} · ${s.service_type}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
              ${statusBadge(s.status)}
              ${s.attendance_count > 0 ? `<span style="font-size:10px;color:var(--text-muted);">${s.present_count}/${s.attendance_count}</span>` : ''}
            </div>
          </div>`
        }).join('')}
      </div>
    </div>`

  // View buttons
  container.querySelectorAll<HTMLElement>('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset['svc']!
      _openServiceDrawer(id)
    })
  })

  // Ctx buttons
  container.querySelectorAll<HTMLElement>('[data-action="ctx"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id  = btn.dataset['svc']!
      const svc = _state.services.find(s => s.id === id)
      if (!svc) return
      const rect = btn.getBoundingClientRect()
      _openServiceCtx(id, svc, rect.right, rect.bottom + 4)
    })
  })

  // Row click → drawer
  container.querySelectorAll<HTMLElement>('[data-svc-id]').forEach(row => {
    row.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('button')) return
      _openServiceDrawer(row.dataset['svcId']!)
    })
  })
}

function _openServiceCtx(
  id: string,
  svc: ServiceDisplay,
  x: number,
  y: number
): void {
  const user     = getCurrentUser()
  const canEdit  = user && can(user, PERMISSIONS.SERVICES_EDIT)
  const canDel   = user && can(user, PERMISSIONS.SERVICES_DELETE)
  const canAtt   = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)

  const items: Array<{ label: string; icon: string; danger?: boolean; action: () => void }> = [
    { label: 'View Details', icon: 'bi-eye',           action: () => _openServiceDrawer(id) },
  ]
  if (canAtt && svc.status !== 'cancelled') {
    items.push({ label: 'Record Attendance', icon: 'bi-person-check', action: () => _switchTabAndLoad('attendance', id) })
  }
  if (canEdit) {
    items.push({ label: 'Edit Service',   icon: 'bi-pencil',       action: () => _openEditServiceModal(svc) })
    if (svc.status === 'scheduled') {
      items.push({ label: 'Mark Completed', icon: 'bi-check-circle', action: () => _markServiceStatus(id, 'completed') })
      items.push({ label: 'Cancel Service', icon: 'bi-x-circle',     action: () => _markServiceStatus(id, 'cancelled') })
    }
  }
  if (canDel) {
    items.push({ label: 'Delete Service', icon: 'bi-trash3', danger: true, action: () => _deleteService(svc) })
  }

  _openCtx(x, y, items)
}

async function _markServiceStatus(id: string, status: ServiceStatus): Promise<void> {
  try {
    await updateService(id, { status })
    await _loadSchedule()
    _toast(`Service marked as ${status}.`)
  } catch (err: any) {
    _toast(err?.message ?? 'Failed to update status.', 'bi-exclamation-circle', 'var(--caci-red)')
  }
}

function _deleteService(svc: ServiceDisplay): void {
  const user = getCurrentUser()
  if (!user) return
  _confirm(
    `Delete "${svc.title}"?`,
    'This service will be soft-deleted and hidden from all views. Attendance records are preserved.',
    'Delete Service',
    async () => {
      await softDeleteService(svc.id, user.id)
      await _loadSchedule()
      _toast('Service deleted.')
    }
  )
}

async function _openServiceDrawer(id: string): Promise<void> {
  const svc = _state.services.find(s => s.id === id)
    ?? await getServiceDisplay(id).catch(() => null)
  if (!svc) return

  const user    = getCurrentUser()
  const canEdit = user && can(user, PERMISSIONS.SERVICES_EDIT)
  const canAtt  = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)
  const tc      = serviceTypeColor(svc.service_type)

  const body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
      <div style="width:48px;height:48px;border-radius:12px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="bi bi-calendar2-week" style="font-size:22px;color:${tc.color};"></i>
      </div>
      <div style="min-width:0;">
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);line-height:1.3;">${svc.title}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${svc.service_type}</div>
      </div>
    </div>
    ${statusBadge(svc.status)}

    <div class="svc-detail-section">
      <div class="svc-detail-section-title">Service Details</div>
      <div class="svc-detail-row">
        <span class="svc-detail-key">Date</span>
        <span class="svc-detail-val">${formatDate(svc.service_date)}${isToday(svc.service_date) ? ' <span style="color:#f0a500;font-weight:600;">(Today)</span>' : ''}</span>
      </div>
      <div class="svc-detail-row">
        <span class="svc-detail-key">Time</span>
        <span class="svc-detail-val">${svc.start_time ? formatTime(svc.start_time) : '—'}</span>
      </div>
      <div class="svc-detail-row">
        <span class="svc-detail-key">Venue</span>
        <span class="svc-detail-val">${svc.venue ?? '—'}</span>
      </div>
      <div class="svc-detail-row">
        <span class="svc-detail-key">Group</span>
        <span class="svc-detail-val">${svc.group_name ?? 'All Assembly Members'}</span>
      </div>
      ${svc.template_title ? `<div class="svc-detail-row">
        <span class="svc-detail-key">Template</span>
        <span class="svc-detail-val">${svc.template_title}</span>
      </div>` : ''}
    </div>

    ${svc.attendance_count > 0 ? `
    <div class="svc-detail-section">
      <div class="svc-detail-section-title">Attendance Summary</div>
      <div style="display:flex;gap:var(--space-md);">
        <div style="flex:1;text-align:center;padding:10px 0;">
          <div style="font-size:22px;font-weight:700;color:#56d364;">${svc.present_count}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Present</div>
        </div>
        <div style="width:1px;background:var(--border-subtle);"></div>
        <div style="flex:1;text-align:center;padding:10px 0;">
          <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${svc.attendance_count - svc.present_count}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Absent</div>
        </div>
        <div style="width:1px;background:var(--border-subtle);"></div>
        <div style="flex:1;text-align:center;padding:10px 0;">
          <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${svc.attendance_count}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Total</div>
        </div>
      </div>
    </div>` : ''}

    ${svc.notes ? `
    <div class="svc-detail-section">
      <div class="svc-detail-section-title">Notes</div>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0;">${svc.notes}</p>
    </div>` : ''}
  `

  const footer = `
    ${canAtt && svc.status !== 'cancelled' ? `
    <button class="btn btn-primary" id="svc-drawer-att-btn" style="flex:1;">
      <i class="bi bi-person-check"></i> Record Attendance
    </button>` : ''}
    ${canEdit ? `
    <button class="btn btn-outline" id="svc-drawer-edit-btn">
      <i class="bi bi-pencil"></i> Edit
    </button>` : ''}
  `

  const drawer = _openDrawer(svc.title, body, footer)

  document.getElementById('svc-drawer-att-btn')?.addEventListener('click', () => {
    drawer.close()
    _switchTabAndLoad('attendance', svc.id)
  })
  document.getElementById('svc-drawer-edit-btn')?.addEventListener('click', () => {
    drawer.close()
    _openEditServiceModal(svc)
  })
}

function _switchTabAndLoad(tab: string, serviceId?: string): void {
  _activeTab = tab
  if (tab === 'attendance' && serviceId) {
    _state.attServiceId = serviceId
  }
  _renderTabBar()
  _renderActiveTab()
}

function _renderCalendar(container: HTMLElement): void {
  const year  = _state.calYear
  const month = _state.calMonth
  const now   = new Date()

  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()

  // Build service map: date string → services[]
  const svcMap = new Map<string, ServiceDisplay[]>()
  _state.services.forEach(s => {
    const key = s.service_date
    if (!svcMap.has(key)) svcMap.set(key, [])
    svcMap.get(key)!.push(s)
  })

  const todayStr = now.toISOString().split('T')[0]

  // Cells: start from Sunday
  const cells: Array<{ day: number; inMonth: boolean; dateStr: string }> = []
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + i + 1
    cells.push({ day: d, inMonth: false, dateStr: _dateStr(year, month - 1, d) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, dateStr: _dateStr(year, month, d) })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, inMonth: false, dateStr: _dateStr(year, month + 1, d) })
  }

  container.innerHTML = `
    <div class="svc-cal-wrap">
      <div class="svc-cal-header">
        <button class="svc-cal-nav" id="svc-cal-prev" aria-label="Previous month">
          <i class="bi bi-chevron-left"></i>
        </button>
        <span class="svc-cal-month">${monthName}</span>
        <button class="svc-cal-nav" id="svc-cal-next" aria-label="Next month">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
      <div class="svc-cal-grid">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
          `<div class="svc-cal-daylabel">${d}</div>`
        ).join('')}
        ${cells.map(cell => {
          const svcs   = svcMap.get(cell.dateStr) ?? []
          const toShow = svcs.slice(0, 3)
          const more   = svcs.length - 3
          return `<div class="svc-cal-cell${!cell.inMonth ? ' other-month' : ''}${cell.dateStr === todayStr ? ' today' : ''}">
            <div class="svc-cal-date">${cell.day}</div>
            ${toShow.map(s => {
              const tc = serviceTypeColor(s.service_type)
              return `<span class="svc-cal-event" data-svc-id="${s.id}" style="background:${tc.bg};color:${tc.color};" title="${s.title}">
                ${s.start_time ? formatTime(s.start_time).split(' ')[0] + ' ' : ''}${s.title}
              </span>`
            }).join('')}
            ${more > 0 ? `<div class="svc-cal-more">+${more} more</div>` : ''}
          </div>`
        }).join('')}
      </div>
    </div>`

  container.querySelector('#svc-cal-prev')?.addEventListener('click', () => {
    if (_state.calMonth === 0) { _state.calYear--; _state.calMonth = 11 }
    else _state.calMonth--
    _renderCalendar(container)
  })
  container.querySelector('#svc-cal-next')?.addEventListener('click', () => {
    if (_state.calMonth === 11) { _state.calYear++; _state.calMonth = 0 }
    else _state.calMonth++
    _renderCalendar(container)
  })

  container.querySelectorAll<HTMLElement>('.svc-cal-event').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation()
      _openServiceDrawer(el.dataset['svcId']!)
    })
  })
}

function _dateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  return d.toISOString().split('T')[0]
}

function _bindScheduleToolbar(): void {
  const search = _tabContent?.querySelector<HTMLInputElement>('#svc-sched-search')!
  const debouncedSearch = debounce((q: string) => {
    _state.search = q
    _applyScheduleFilters()
    _renderScheduleContent()
  }, 220)
  search?.addEventListener('input', () => debouncedSearch(search.value))

  _tabContent?.querySelector('#svc-sched-type-filter')?.addEventListener('change', e => {
    _state.typeFilter = (e.target as HTMLSelectElement).value
    _applyScheduleFilters(); _renderScheduleContent()
  })
  _tabContent?.querySelector('#svc-sched-status-filter')?.addEventListener('change', e => {
    _state.statusFilter = (e.target as HTMLSelectElement).value as any
    _applyScheduleFilters(); _renderScheduleContent()
  })

  _tabContent?.querySelector('#svc-view-list')?.addEventListener('click', () => {
    _state.view = 'list'
    _tabContent?.querySelector('#svc-view-list')?.classList.add('active')
    _tabContent?.querySelector('#svc-view-cal')?.classList.remove('active')
    _renderScheduleContent()
  })
  _tabContent?.querySelector('#svc-view-cal')?.addEventListener('click', () => {
    _state.view = 'calendar'
    _tabContent?.querySelector('#svc-view-cal')?.classList.add('active')
    _tabContent?.querySelector('#svc-view-list')?.classList.remove('active')
    _renderScheduleContent()
  })

  // Mobile search toggle
  _tabContent?.querySelector('#svc-sched-mob-search')?.addEventListener('click', () => {
    const toolbar = _tabContent?.querySelector('#svc-sched-toolbar')!
    const wrap    = _tabContent?.querySelector<HTMLElement>('#svc-sched-search-wrap')!
    toolbar.classList.toggle('search-open')
    wrap.classList.toggle('open')
    if (wrap.classList.contains('open')) search?.focus()
  })

  _tabContent?.querySelector('#svc-sched-create')?.addEventListener('click', () => _openCreateServiceModal())
  _tabContent?.querySelector('#svc-sched-from-tmpl')?.addEventListener('click', () => _openFromTemplateModal())
}

// ── Create / Edit Service Modal ───────────────────────────────────────────────

function _openCreateServiceModal(): void {
  _openServiceFormModal(null)
}

function _openEditServiceModal(svc: ServiceDisplay): void {
  _openServiceFormModal(svc)
}

function _openServiceFormModal(svc: ServiceDisplay | null): void {
  const isEdit = !!svc
  const { el, close } = _openModal(
    isEdit ? 'Edit Service' : 'Create Service',
    `<div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-f-title">Service Title *</label>
        <input id="svc-f-title" type="text" placeholder="e.g. Sunday Morning Service" maxlength="100"
          value="${isEdit ? svc!.title.replace(/"/g, '&quot;') : ''}">
        <div class="svc-field-error" id="svc-f-title-err">Title is required.</div>
      </div>
      <div class="svc-field">
        <label for="svc-f-type">Service Type *</label>
        <select id="svc-f-type">
          ${SERVICE_TYPES.map(t =>
            `<option value="${t}"${isEdit && svc!.service_type === t ? ' selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-f-date">Service Date *</label>
        <input id="svc-f-date" type="date" value="${isEdit ? svc!.service_date : new Date().toISOString().split('T')[0]}">
        <div class="svc-field-error" id="svc-f-date-err">Date is required.</div>
      </div>
      <div class="svc-field">
        <label for="svc-f-time">Start Time</label>
        <input id="svc-f-time" type="time" value="${isEdit && svc!.start_time ? svc!.start_time.substring(0,5) : ''}">
      </div>
    </div>
    <div class="svc-field">
      <label for="svc-f-venue">Venue</label>
      <input id="svc-f-venue" type="text" placeholder="e.g. Main Auditorium"
        value="${isEdit && svc!.venue ? svc!.venue.replace(/"/g, '&quot;') : ''}">
    </div>
    ${isEdit ? `<div class="svc-field">
      <label for="svc-f-status">Status</label>
      <select id="svc-f-status">
        <option value="scheduled"${svc!.status==='scheduled'?' selected':''}>Scheduled</option>
        <option value="completed"${svc!.status==='completed'?' selected':''}>Completed</option>
        <option value="cancelled"${svc!.status==='cancelled'?' selected':''}>Cancelled</option>
      </select>
    </div>` : ''}
    <div class="svc-field">
      <label for="svc-f-notes">Notes</label>
      <textarea id="svc-f-notes" placeholder="Any additional notes…">${isEdit && svc!.notes ? svc!.notes : ''}</textarea>
    </div>`,
    `<button class="btn btn-outline" id="svc-f-cancel">Cancel</button>
     <button class="btn btn-primary" id="svc-f-save">
       <i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Service'}
     </button>`
  )

  el.querySelector('#svc-f-cancel')?.addEventListener('click', close)

  el.querySelector('#svc-f-save')?.addEventListener('click', async () => {
    const title = (el.querySelector<HTMLInputElement>('#svc-f-title')!).value.trim()
    const date  = (el.querySelector<HTMLInputElement>('#svc-f-date')!).value
    const titleErr = el.querySelector<HTMLElement>('#svc-f-title-err')!
    const dateErr  = el.querySelector<HTMLElement>('#svc-f-date-err')!
    let valid = true

    if (!title) { titleErr.classList.add('show'); valid = false } else titleErr.classList.remove('show')
    if (!date)  { dateErr.classList.add('show');  valid = false } else dateErr.classList.remove('show')
    if (!valid) return

    const btn = el.querySelector<HTMLButtonElement>('#svc-f-save')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`

    const type   = (el.querySelector<HTMLSelectElement>('#svc-f-type')!).value
    const time   = (el.querySelector<HTMLInputElement>('#svc-f-time')!).value || null
    const venue  = (el.querySelector<HTMLInputElement>('#svc-f-venue')!).value.trim() || null
    const notes  = (el.querySelector<HTMLTextAreaElement>('#svc-f-notes')!).value.trim() || null
    const status = el.querySelector<HTMLSelectElement>('#svc-f-status')?.value as ServiceStatus | undefined

    try {
      if (isEdit) {
        await updateService(svc!.id, { title, service_type: type, service_date: date, start_time: time, venue, notes, ...(status ? { status } : {}) })
        _toast('Service updated.')
      } else {
        await createService({ title, service_type: type, service_date: date, start_time: time, venue, notes, status: 'scheduled' })
        _toast('Service created.')
      }
      close()
      await _loadSchedule()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Service'}`
      _toast(err?.message ?? 'Failed to save.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

function _openFromTemplateModal(): void {
  const { el, close } = _openModal(
    'Generate from Template',
    `<div class="svc-field">
      <label>Choose a template</label>
      <div id="svc-tmpl-picker-list" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text-muted);">
          <span class="svc-spinner" style="border-top-color:var(--caci-blue);border-color:rgba(0,75,160,0.2);"></span>
        </div>
      </div>
    </div>
    <div class="svc-field" id="svc-tmpl-date-wrap" style="display:none;">
      <label for="svc-tmpl-date">Service Date *</label>
      <input id="svc-tmpl-date" type="date" value="${new Date().toISOString().split('T')[0]}">
    </div>`,
    `<button class="btn btn-outline" id="svc-tmpl-cancel">Cancel</button>
     <button class="btn btn-primary" id="svc-tmpl-gen" disabled>
       <i class="bi bi-lightning"></i> Generate
     </button>`
  )

  let selectedTmplId: string | null = null

  el.querySelector('#svc-tmpl-cancel')?.addEventListener('click', close)

  // Load templates
  listServiceTemplates().then(tmpls => {
    const list = el.querySelector('#svc-tmpl-picker-list')!
    if (!tmpls.length) {
      list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">No active templates found. Create one in the Templates tab.</div>`
      return
    }
    list.innerHTML = tmpls.map(t => `
      <div class="svc-picker-row" data-tmpl-id="${t.id}">
        <div style="width:36px;height:36px;border-radius:9px;background:rgba(0,75,160,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="bi bi-arrow-repeat" style="font-size:15px;color:var(--caci-blue-light);"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${t.title}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:1px;">${t.recurrence_label} · ${t.service_type}</div>
        </div>
        <span class="svc-recur-chip">${RECURRENCE_LABELS[t.recurrence as keyof typeof RECURRENCE_LABELS] ?? t.recurrence}</span>
      </div>`).join('')

    list.querySelectorAll<HTMLElement>('[data-tmpl-id]').forEach(row => {
      row.addEventListener('click', () => {
        list.querySelectorAll('.svc-picker-row').forEach(r => r.classList.remove('selected'))
        row.classList.add('selected')
        selectedTmplId = row.dataset['tmplId']!
        el.querySelector<HTMLElement>('#svc-tmpl-date-wrap')!.style.display = ''
        el.querySelector<HTMLButtonElement>('#svc-tmpl-gen')!.disabled = false
      })
    })
  })

  el.querySelector('#svc-tmpl-gen')?.addEventListener('click', async () => {
    if (!selectedTmplId) return
    const date = el.querySelector<HTMLInputElement>('#svc-tmpl-date')!.value
    if (!date) return

    const btn = el.querySelector<HTMLButtonElement>('#svc-tmpl-gen')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`
    try {
      await createServiceFromTemplate(selectedTmplId, date)
      close()
      _toast('Service generated from template.')
      await _loadSchedule()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-lightning"></i> Generate`
      _toast(err?.message ?? 'Failed to generate.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

// ══════════════════════════════════════════════════════
// TAB: ATTENDANCE
// ══════════════════════════════════════════════════════

function _renderAttendanceTab(): void {
  if (!_tabContent) return
  const user   = getCurrentUser()
  const canMark = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)

  _tabContent.innerHTML = /* html */`
    <!-- Service picker (shown when no service selected) -->
    <div id="svc-att-picker-section">
      <p class="svc-section-head">Select a Service</p>
      <div id="svc-att-service-picker" style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-muted);">
          <span class="svc-spinner" style="border-top-color:var(--caci-blue);border-color:rgba(0,75,160,0.2);"></span>
        </div>
      </div>
    </div>

    <!-- Attendance section (shown when service is selected) -->
    <div id="svc-att-main-section" style="display:none;">
      <!-- Stat cards -->
      <div class="svc-stats-row" id="svc-att-stats"></div>

      <!-- Bulk bar -->
      <div class="svc-bulk-bar" id="svc-att-bulk-bar">
        <i class="bi bi-people-fill" style="color:var(--caci-blue-light);font-size:16px;"></i>
        <span id="svc-att-bulk-count" style="font-size:13px;color:var(--text-primary);font-weight:600;"></span>
        <span style="font-size:13px;color:var(--text-secondary);">member(s) selected</span>
        <div style="margin-left:auto;display:flex;gap:var(--space-sm);">
          <button class="svc-tbtn" id="svc-att-bulk-present" style="height:32px;font-size:12px;">
            <i class="bi bi-check-circle"></i> <span class="svc-btn-label">Mark Present</span>
          </button>
          <button class="svc-tbtn" id="svc-att-bulk-absent" style="height:32px;font-size:12px;">
            <i class="bi bi-x-circle"></i> <span class="svc-btn-label">Mark Absent</span>
          </button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="svc-toolbar" style="margin-bottom:var(--space-md);">
        <div style="display:flex;align-items:center;gap:8px;flex:1;">
          <button class="svc-tbtn" id="svc-att-back" style="flex-shrink:0;">
            <i class="bi bi-arrow-left"></i>
            <span class="svc-btn-label">Change Service</span>
          </button>
          <div id="svc-att-service-label" style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;"></div>
        </div>
        <div class="svc-search-wrap" id="svc-att-search-wrap">
          <i class="bi bi-search"></i>
          <input type="text" id="svc-att-search" placeholder="Search members…" autocomplete="off" aria-label="Search members">
        </div>
        <div class="svc-filter-wrap">
          <i class="bi bi-funnel"></i>
          <select class="svc-filter-select" id="svc-att-filter" aria-label="Filter by status">
            <option value="all">All</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>
        ${canMark ? `
        <div class="svc-toolbar-actions">
          <button class="svc-tbtn" id="svc-att-mark-all">
            <i class="bi bi-check-all"></i>
            <span class="svc-btn-label">Mark All Present</span>
          </button>
          <button class="svc-tbtn svc-tbtn-primary" id="svc-att-save" style="position:relative;">
            <i class="bi bi-floppy"></i>
            <span class="svc-btn-label">Save</span>
            <span id="svc-att-save-badge" style="position:absolute;top:-6px;right:-6px;display:none;
              width:16px;height:16px;border-radius:50%;background:var(--caci-red);
              font-size:9px;color:#fff;align-items:center;justify-content:center;">!</span>
          </button>
        </div>` : ''}
      </div>

      <!-- Meta -->
      <div class="svc-meta" id="svc-att-meta"></div>

      <!-- Table / cards -->
      <div id="svc-att-content"></div>
    </div>`

  _loadAttendancePicker()
  _bindAttendanceToolbar()

  // If a service ID was set (from Schedule tab), auto-select it
  if (_state.attServiceId) {
    _loadAttendanceForService(_state.attServiceId)
  }
}

async function _loadAttendancePicker(): Promise<void> {
  const picker = _tabContent?.querySelector<HTMLElement>('#svc-att-service-picker')
  if (!picker) return

  try {
    const services = await listServicesDisplay({ }, { limit: 20 })
    _state.attServices = services

    if (!services.length) {
      picker.innerHTML = `<div class="svc-empty" style="padding:32px;">
        <i class="bi bi-calendar-x"></i>
        <div class="svc-empty-title">No recent services</div>
      </div>`
      return
    }

    picker.innerHTML = services.map(s => {
      const tc = serviceTypeColor(s.service_type)
      return `
        <div class="svc-picker-row${_state.attServiceId === s.id ? ' selected' : ''}" data-svc-pick="${s.id}">
          <div style="width:40px;height:40px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-calendar2-week" style="font-size:16px;color:${tc.color};"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${s.title}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:1px;">
              ${formatDate(s.service_date)}${s.start_time ? ' · ' + formatTime(s.start_time) : ''} · ${s.service_type}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
            ${statusBadge(s.status)}
            ${s.attendance_count > 0 ? `<span style="font-size:10px;color:var(--text-muted);">${s.present_count}/${s.attendance_count} present</span>` : ''}
          </div>
        </div>`
    }).join('')

    picker.querySelectorAll<HTMLElement>('[data-svc-pick]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset['svcPick']!
        _loadAttendanceForService(id)
      })
    })
  } catch (err) {
    picker.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Failed to load services.</div>`
  }
}

async function _loadAttendanceForService(serviceId: string): Promise<void> {
  _state.attServiceId = serviceId

  const pickerSection = _tabContent?.querySelector<HTMLElement>('#svc-att-picker-section')
  const mainSection   = _tabContent?.querySelector<HTMLElement>('#svc-att-main-section')
  if (!pickerSection || !mainSection) return

  pickerSection.style.display = 'none'
  mainSection.style.display = ''

  const attContent = _tabContent?.querySelector<HTMLElement>('#svc-att-content')!
  attContent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;">
    <span class="svc-spinner" style="width:32px;height:32px;border-width:3px;border-top-color:var(--caci-blue);border-color:rgba(0,75,160,0.2);"></span>
  </div>`

  try {
    const records = await listAttendanceDisplay(serviceId)
    if (_destroyed) return

    _state.attRecords = records
    _state.attCurrentStatus = new Map(records.map(r => [r.member_id, r.status]))
    _state.attChanged = new Set()

    const svc = _state.attServices.find(s => s.id === serviceId)
    const label = _tabContent?.querySelector<HTMLElement>('#svc-att-service-label')
    if (label && svc) label.textContent = svc.title

    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
  } catch (err: any) {
    attContent.innerHTML = `<div class="svc-empty">
      <i class="bi bi-exclamation-circle"></i>
      <div class="svc-empty-title">Failed to load attendance</div>
      <div class="svc-empty-sub">${err?.message ?? 'Something went wrong.'}</div>
    </div>`
  }
}

function _applyAttendanceFilters(): void {
  const q = _state.attSearch.toLowerCase()
  _state.attFiltered = _state.attRecords.filter(r => {
    const statusOk = _state.attStatusFilter === 'all'
      || (_state.attCurrentStatus.get(r.member_id) ?? r.status) === _state.attStatusFilter
    const searchOk = !q
      || r.member_name.toLowerCase().includes(q)
      || (r.member_number ?? '').toLowerCase().includes(q)
    return statusOk && searchOk
  })
}

function _renderAttendanceStats(): void {
  const el = _tabContent?.querySelector<HTMLElement>('#svc-att-stats')
  if (!el) return

  const records  = _state.attRecords
  const statuses = records.map(r => _state.attCurrentStatus.get(r.member_id) ?? r.status)
  const present  = statuses.filter(s => s === 'present').length
  const absent   = statuses.filter(s => s === 'absent').length
  const excused  = statuses.filter(s => s === 'excused').length
  const total    = records.length
  const pct      = total ? Math.round(present / total * 100) : 0

  el.innerHTML = `
  <div class="svc-stat" data-att-filter="all" style="--stat-accent:var(--caci-blue);--stat-glow:rgba(0,75,160,0.2);" role="button" tabindex="0">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
        <i class="bi bi-people-fill" style="color:var(--caci-blue-light);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Expected</span>
    </div>
    <div class="svc-stat-value">${total}</div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:100%;background:linear-gradient(90deg,var(--caci-blue),var(--caci-blue-light));"></div>
    </div>
  </div>
  <div class="svc-stat" data-att-filter="present" style="--stat-accent:#22c55e;--stat-glow:rgba(34,197,94,0.18);" role="button" tabindex="0">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
        <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Present</span>
    </div>
    <div class="svc-stat-value">${present}
      <span class="svc-stat-sub">${pct}%</span>
    </div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${pct}%;background:rgba(34,197,94,0.5);"></div>
    </div>
  </div>
  <div class="svc-stat" data-att-filter="absent" style="--stat-accent:var(--caci-red);--stat-glow:rgba(198,0,38,0.15);" role="button" tabindex="0">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(198,0,38,0.08);">
        <i class="bi bi-person-x-fill" style="color:var(--caci-red);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Absent</span>
    </div>
    <div class="svc-stat-value">${absent}</div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${total ? Math.round(absent/total*100) : 0}%;background:rgba(198,0,38,0.4);"></div>
    </div>
  </div>
  <div class="svc-stat" data-att-filter="excused" style="--stat-accent:#d29922;--stat-glow:rgba(210,153,34,0.18);" role="button" tabindex="0">
    <div class="svc-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(210,153,34,0.1);">
        <i class="bi bi-hourglass-split" style="color:#d29922;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Excused</span>
    </div>
    <div class="svc-stat-value">${excused}</div>
    <div class="svc-stat-bar">
      <div class="svc-stat-bar-fill" style="width:${total ? Math.round(excused/total*100) : 0}%;background:rgba(210,153,34,0.4);"></div>
    </div>
  </div>`

  el.querySelectorAll<HTMLElement>('[data-att-filter]').forEach(card => {
    card.addEventListener('click', () => {
      const f = card.dataset['attFilter'] as AttendanceStatus | 'all'
      _state.attStatusFilter = f
      el.querySelectorAll('.svc-stat').forEach(c => c.classList.remove('active-filter'))
      if (f !== 'all') card.classList.add('active-filter')
      _applyAttendanceFilters()
      _renderAttendanceTable()
    })
  })
}

function _renderAttendanceTable(): void {
  const container = _tabContent?.querySelector<HTMLElement>('#svc-att-content')
  const meta      = _tabContent?.querySelector<HTMLElement>('#svc-att-meta')
  if (!container || !meta) return

  const user     = getCurrentUser()
  const canMark  = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)
  const list     = _state.attFiltered

  meta.innerHTML = `<span>Showing <strong>${list.length}</strong> member${list.length !== 1 ? 's' : ''}</span>
    ${_state.attChanged.size > 0 ? `<span style="font-size:12px;color:#d29922;font-weight:500;display:flex;align-items:center;gap:4px;"><i class="bi bi-circle-fill" style="font-size:8px;"></i>${_state.attChanged.size} unsaved change${_state.attChanged.size !== 1 ? 's' : ''}</span>` : ''}`

  // Show unsaved badge on save button
  const saveBadge = _tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
  if (saveBadge) {
    saveBadge.style.display = _state.attChanged.size > 0 ? 'flex' : 'none'
  }

  if (!list.length) {
    container.innerHTML = `<div class="svc-empty">
      <i class="bi bi-person-check"></i>
      <div class="svc-empty-title">No records match</div>
      <div class="svc-empty-sub">Try clearing your search or filters.</div>
    </div>`
    return
  }

  container.innerHTML = `
    <div class="svc-table-wrap">
      <div class="svc-att-row header">
        <div class="svc-col-hd" style="padding-left:8px;">
          ${canMark ? `<input type="checkbox" id="svc-att-select-all" class="mchk" aria-label="Select all">` : ''}
        </div>
        <div class="svc-col-hd">Member</div>
        <div class="svc-col-hd svc-att-col-hide-group">Group</div>
        <div class="svc-col-hd">Status</div>
        <div class="svc-col-hd svc-att-col-hide-notes">Notes</div>
        <div class="svc-col-hd" style="justify-content:flex-end;">Marked At</div>
      </div>
      <div id="svc-att-rows">
        ${list.map((r, i) => {
          const currentStatus = _state.attCurrentStatus.get(r.member_id) ?? r.status
          const bg = avatarColor(r.member_name)
          const ini = initials(r.member_name)
          const changed = _state.attChanged.has(r.member_id)
          const delay = Math.min(i * 25, 300)

          return `
          <!-- Desktop row -->
          <div class="svc-att-row" data-member="${r.member_id}" style="animation:svcFadeUp 0.32s cubic-bezier(0.16,1,0.3,1) ${delay}ms both;${changed ? 'background:rgba(210,153,34,0.03);' : ''}">
            <div class="svc-col-cell" style="padding-left:8px;">
              ${canMark ? `<input type="checkbox" class="mchk svc-att-chk" data-member="${r.member_id}" aria-label="Select ${r.member_name}">` : ''}
            </div>
            <div class="svc-col-cell" style="gap:10px;min-width:0;">
              <div style="width:34px;height:34px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${ini}</div>
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.member_name}</div>
                <div style="font-size:10px;color:var(--text-muted);">${r.member_number ?? ''}</div>
              </div>
            </div>
            <div class="svc-col-cell svc-att-col-hide-group">
              <span style="font-size:12px;color:var(--text-secondary);">${r.group_name ?? '—'}</span>
            </div>
            <div class="svc-col-cell">
              ${canMark
                ? `<div class="svc-att-status-group" role="group" aria-label="Attendance status for ${r.member_name}">
                    <button class="svc-att-status-btn${currentStatus === 'present' ? ' active-present' : ''}" data-set-status="present" data-member="${r.member_id}" aria-pressed="${currentStatus === 'present'}">Present</button>
                    <button class="svc-att-status-btn${currentStatus === 'absent' ? ' active-absent' : ''}" data-set-status="absent" data-member="${r.member_id}" aria-pressed="${currentStatus === 'absent'}">Absent</button>
                    <button class="svc-att-status-btn${currentStatus === 'excused' ? ' active-excused' : ''}" data-set-status="excused" data-member="${r.member_id}" aria-pressed="${currentStatus === 'excused'}">Excused</button>
                  </div>`
                : attBadge(currentStatus)
              }
            </div>
            <div class="svc-col-cell svc-att-col-hide-notes">
              <span style="font-size:12px;color:var(--text-secondary);">${r.notes ?? '—'}</span>
            </div>
            <div class="svc-col-cell" style="justify-content:flex-end;">
              <span style="font-size:11px;color:var(--text-muted);">${r.marked_at ? new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
          </div>

          <!-- Mobile card -->
          <div class="svc-att-card" data-member="${r.member_id}" style="animation-delay:${delay}ms;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:38px;height:38px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${ini}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${r.member_name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${r.member_number ?? ''}${r.group_name ? ' · ' + r.group_name : ''}</div>
              </div>
            </div>
            ${canMark ? `<div class="svc-att-status-group" role="group" style="width:100%;" aria-label="Attendance status">
              <button class="svc-att-status-btn${currentStatus === 'present' ? ' active-present' : ''}" data-set-status="present" data-member="${r.member_id}" style="flex:1;" aria-pressed="${currentStatus === 'present'}">Present</button>
              <button class="svc-att-status-btn${currentStatus === 'absent' ? ' active-absent' : ''}" data-set-status="absent" data-member="${r.member_id}" style="flex:1;" aria-pressed="${currentStatus === 'absent'}">Absent</button>
              <button class="svc-att-status-btn${currentStatus === 'excused' ? ' active-excused' : ''}" data-set-status="excused" data-member="${r.member_id}" style="flex:1;" aria-pressed="${currentStatus === 'excused'}">Excused</button>
            </div>` : attBadge(currentStatus)}
          </div>`
        }).join('')}
      </div>
    </div>`

  // Status change handlers
  if (canMark) {
    container.querySelectorAll<HTMLElement>('[data-set-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        const memberId = btn.dataset['member']!
        const status   = btn.dataset['setStatus'] as AttendanceStatus

        const prevStatus = _state.attCurrentStatus.get(memberId)
        _state.attCurrentStatus.set(memberId, status)
        _state.attChanged.add(memberId)

        // Update all buttons for this member (table + card)
        container.querySelectorAll<HTMLElement>(`[data-set-status][data-member="${memberId}"]`).forEach(b => {
          const s = b.dataset['setStatus']!
          b.className = 'svc-att-status-btn' + (s === status ? ` active-${s}` : '')
          b.setAttribute('aria-pressed', String(s === status))
        })

        // Reflect on stat cards
        _state.attFiltered = _state.attFiltered  // trigger re-render of stats
        _renderAttendanceStats()

        // Unsaved badge
        const saveBadge = _tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
        if (saveBadge) saveBadge.style.display = 'flex'

        const metaEl = _tabContent?.querySelector<HTMLElement>('#svc-att-meta')
        if (metaEl) metaEl.innerHTML =
          `<span>Showing <strong>${list.length}</strong> member${list.length !== 1 ? 's' : ''}</span>
           <span style="font-size:12px;color:#d29922;font-weight:500;display:flex;align-items:center;gap:4px;"><i class="bi bi-circle-fill" style="font-size:8px;"></i>${_state.attChanged.size} unsaved</span>`
      })
    })

    // Checkbox row selection
    container.querySelectorAll<HTMLInputElement>('.svc-att-chk').forEach(chk => {
      chk.addEventListener('change', () => _updateBulkBar())
    })

    container.querySelector<HTMLInputElement>('#svc-att-select-all')?.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked
      container.querySelectorAll<HTMLInputElement>('.svc-att-chk').forEach(c => { c.checked = checked })
      _updateBulkBar()
    })
  }
}

function _updateBulkBar(): void {
  const checkboxes = _tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
  const bar        = _tabContent?.querySelector<HTMLElement>('#svc-att-bulk-bar')!
  const count      = _tabContent?.querySelector<HTMLElement>('#svc-att-bulk-count')!

  if (checkboxes.length > 0) {
    bar.classList.add('visible')
    count.textContent = String(checkboxes.length)
  } else {
    bar.classList.remove('visible')
  }
}

function _bindAttendanceToolbar(): void {
  _tabContent?.querySelector('#svc-att-back')?.addEventListener('click', () => {
    _state.attServiceId = null
    const pickerSection = _tabContent?.querySelector<HTMLElement>('#svc-att-picker-section')
    const mainSection   = _tabContent?.querySelector<HTMLElement>('#svc-att-main-section')
    if (pickerSection) pickerSection.style.display = ''
    if (mainSection)   mainSection.style.display = 'none'
  })

  const search = _tabContent?.querySelector<HTMLInputElement>('#svc-att-search')!
  const debouncedSearch = debounce((q: string) => {
    _state.attSearch = q
    _applyAttendanceFilters()
    _renderAttendanceTable()
  }, 220)
  search?.addEventListener('input', () => debouncedSearch(search.value))

  _tabContent?.querySelector('#svc-att-filter')?.addEventListener('change', e => {
    _state.attStatusFilter = (e.target as HTMLSelectElement).value as any
    _applyAttendanceFilters()
    _renderAttendanceTable()
  })

  _tabContent?.querySelector('#svc-att-mark-all')?.addEventListener('click', () => {
    _state.attRecords.forEach(r => {
      _state.attCurrentStatus.set(r.member_id, 'present')
      _state.attChanged.add(r.member_id)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
    _toast('All members marked present.')
  })

  _tabContent?.querySelector('#svc-att-save')?.addEventListener('click', async () => {
    if (!_state.attServiceId || _state.attChanged.size === 0) return
    const btn = _tabContent?.querySelector<HTMLButtonElement>('#svc-att-save')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`

    try {
      const records = [..._state.attChanged].map(memberId => ({
        service_id: _state.attServiceId!,
        member_id:  memberId,
        status:     _state.attCurrentStatus.get(memberId)!,
      }))
      await bulkUpsertAttendance(records)
      _state.attChanged.clear()
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-floppy"></i><span class="svc-btn-label">Save</span>`
      const saveBadge = _tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
      if (saveBadge) saveBadge.style.display = 'none'
      _toast(`Attendance saved — ${records.length} record${records.length !== 1 ? 's' : ''} updated.`)
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-floppy"></i><span class="svc-btn-label">Save</span>`
      _toast(err?.message ?? 'Failed to save attendance.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })

  _tabContent?.querySelector('#svc-att-bulk-present')?.addEventListener('click', () => {
    const checked = _tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
    checked.forEach(chk => {
      const mid = chk.dataset['member']!
      _state.attCurrentStatus.set(mid, 'present')
      _state.attChanged.add(mid)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
  })

  _tabContent?.querySelector('#svc-att-bulk-absent')?.addEventListener('click', () => {
    const checked = _tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
    checked.forEach(chk => {
      const mid = chk.dataset['member']!
      _state.attCurrentStatus.set(mid, 'absent')
      _state.attChanged.add(mid)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
  })
}

// ══════════════════════════════════════════════════════
// TAB: TEMPLATES
// ══════════════════════════════════════════════════════

async function _loadTemplates(): Promise<void> {
  if (_destroyed) return
  try {
    _state.templates = await listServiceTemplates({ includeInactive: true })
    _state.tmplFiltered = _state.templates.filter(t =>
      !_state.tmplSearch || t.title.toLowerCase().includes(_state.tmplSearch.toLowerCase())
    )
    _renderTemplatesContent()
  } catch (err) {
    console.error('[services] _loadTemplates', err)
  }
}

function _renderTemplatesTab(): void {
  if (!_tabContent) return
  const user      = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.SERVICES_TEMPLATES_MANAGE)

  _tabContent.innerHTML = /* html */`
    <!-- Stats -->
    <div class="svc-stats-row" id="svc-tmpl-stats"></div>

    <!-- Toolbar -->
    <div class="svc-toolbar" style="margin-bottom:var(--space-md);">
      <div class="svc-search-wrap">
        <i class="bi bi-search"></i>
        <input type="text" id="svc-tmpl-search" placeholder="Search templates…" autocomplete="off" aria-label="Search templates">
      </div>
      ${canManage ? `
      <div class="svc-toolbar-actions">
        <button class="svc-tbtn svc-tbtn-primary" id="svc-tmpl-create">
          <i class="bi bi-plus-lg"></i>
          <span class="svc-btn-label">New Template</span>
        </button>
      </div>` : ''}
    </div>

    <!-- Meta -->
    <div class="svc-meta" id="svc-tmpl-meta"></div>

    <!-- Template grid -->
    <div id="svc-tmpl-content" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-md);"></div>
  `

  _renderTemplatesStats()
  _renderTemplatesContent()

  const search = _tabContent.querySelector<HTMLInputElement>('#svc-tmpl-search')!
  const debouncedSearch = debounce((q: string) => {
    _state.tmplSearch = q
    _state.tmplFiltered = _state.templates.filter(t =>
      !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.service_type.toLowerCase().includes(q.toLowerCase())
    )
    _renderTemplatesContent()
  }, 220)
  search.addEventListener('input', () => debouncedSearch(search.value))

  _tabContent.querySelector('#svc-tmpl-create')?.addEventListener('click', () => _openTemplateModal(null))

  _loadTemplates()
}

function _renderTemplatesStats(): void {
  const el = _tabContent?.querySelector<HTMLElement>('#svc-tmpl-stats')
  if (!el) return
  const { templates } = _state
  const active   = templates.filter(t => t.is_active).length
  const inactive = templates.filter(t => !t.is_active).length
  const total    = templates.length

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  el.innerHTML = `
  <div class="svc-stat" style="--stat-accent:var(--caci-blue);--stat-glow:rgba(0,75,160,0.2);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
        <i class="bi bi-arrow-repeat" style="color:var(--caci-blue-light);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Total Templates</span>
    </div>
    <div class="svc-stat-value">${total}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:linear-gradient(90deg,var(--caci-blue),var(--caci-blue-light));"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:#22c55e;--stat-glow:rgba(34,197,94,0.18);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
        <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Active</span>
    </div>
    <div class="svc-stat-value">${active}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:rgba(34,197,94,0.4);"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:#58a6ff;--stat-glow:rgba(88,166,255,0.18);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(88,166,255,0.12);">
        <i class="bi bi-lightning-fill" style="color:#58a6ff;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Instances Total</span>
    </div>
    <div class="svc-stat-value">${templates.reduce((acc, t) => acc + t.instance_count, 0)}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:rgba(88,166,255,0.4);"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:var(--text-muted);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:var(--bg-hover);">
        <i class="bi bi-slash-circle" style="color:var(--text-muted);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Inactive</span>
    </div>
    <div class="svc-stat-value">${inactive}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:${total ? Math.round(inactive/total*100) : 0}%;background:var(--border-strong);"></div></div>
  </div>`
}

function _renderTemplatesContent(): void {
  const content = _tabContent?.querySelector<HTMLElement>('#svc-tmpl-content')
  const meta    = _tabContent?.querySelector<HTMLElement>('#svc-tmpl-meta')
  if (!content || !meta) return

  const list = _state.tmplFiltered.length ? _state.tmplFiltered : _state.templates

  const user      = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.SERVICES_TEMPLATES_MANAGE)

  meta.innerHTML = `<span>Showing <strong>${list.length}</strong> template${list.length !== 1 ? 's' : ''}</span>`

  if (!list.length) {
    content.innerHTML = `<div class="svc-empty" style="grid-column:1/-1;">
      <i class="bi bi-arrow-repeat"></i>
      <div class="svc-empty-title">No templates found</div>
      <div class="svc-empty-sub">${canManage ? 'Create a template to start generating recurring services.' : 'No templates have been created yet.'}</div>
    </div>`
    return
  }

  content.innerHTML = list.map((t, i) => {
    const tc    = serviceTypeColor(t.service_type)
    const delay = Math.min(i * 35, 420)
    return `
    <div class="svc-tmpl-card" style="animation-delay:${delay}ms;" data-tmpl-id="${t.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <div style="width:40px;height:40px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-arrow-repeat" style="font-size:17px;color:${tc.color};"></i>
          </div>
          <div style="min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${t.service_type}</div>
          </div>
        </div>
        <span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;
          background:${t.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)'};
          border:1px solid ${t.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'};
          color:${t.is_active ? '#56d364' : 'var(--text-muted)'};flex-shrink:0;">
          ${t.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span class="svc-recur-chip"><i class="bi bi-arrow-repeat" style="font-size:10px;"></i>${t.recurrence_label}</span>
        ${t.group_name ? `<span style="font-size:11px;color:var(--text-muted);">· ${t.group_name}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border-subtle);">
        <span style="font-size:11px;color:var(--text-muted);"><strong style="color:var(--text-secondary);">${t.instance_count}</strong> instance${t.instance_count !== 1 ? 's' : ''} generated</span>
        ${canManage ? `
        <div style="display:flex;gap:6px;">
          <button class="svc-tbtn" data-tmpl-edit="${t.id}" style="height:30px;padding:0 8px;font-size:12px;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="svc-tbtn" data-tmpl-del="${t.id}" style="height:30px;padding:0 8px;font-size:12px;color:var(--caci-red);border-color:rgba(198,0,38,0.25);">
            <i class="bi bi-trash3"></i>
          </button>
        </div>` : ''}
      </div>
    </div>`
  }).join('')

  if (canManage) {
    content.querySelectorAll<HTMLElement>('[data-tmpl-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id = btn.dataset['tmplEdit']!
        const tmpl = _state.templates.find(t => t.id === id)
        if (tmpl) _openTemplateModal(tmpl)
      })
    })
    content.querySelectorAll<HTMLElement>('[data-tmpl-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id   = btn.dataset['tmplDel']!
        const tmpl = _state.templates.find(t => t.id === id)
        if (!tmpl) return
        _confirm(
          `Delete "${tmpl.title}"?`,
          'This template will be deactivated and hidden. Existing service instances are preserved.',
          'Delete Template',
          async () => {
            await softDeleteTemplate(id)
            await _loadTemplates()
            _toast('Template deleted.')
          }
        )
      })
    })
  }
}

function _openTemplateModal(tmpl: TemplateDisplay | null): void {
  const isEdit = !!tmpl
  const { el, close } = _openModal(
    isEdit ? 'Edit Template' : 'Create Template',
    `<div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-title">Template Name *</label>
        <input id="svc-tf-title" type="text" placeholder="e.g. Sunday Service" maxlength="100"
          value="${isEdit ? tmpl!.title.replace(/"/g, '&quot;') : ''}">
        <div class="svc-field-error" id="svc-tf-title-err">Title is required.</div>
      </div>
      <div class="svc-field">
        <label for="svc-tf-type">Service Type</label>
        <select id="svc-tf-type">
          ${SERVICE_TYPES.map(t => `<option value="${t}"${isEdit && tmpl!.service_type === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-recur">Recurrence</label>
        <select id="svc-tf-recur">
          ${Object.entries(RECURRENCE_LABELS).map(([k, v]) =>
            `<option value="${k}"${isEdit && tmpl!.recurrence === k ? ' selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="svc-field">
        <label for="svc-tf-day">Day of Week</label>
        <select id="svc-tf-day">
          <option value="">— Any —</option>
          ${DAYS_OF_WEEK.map(d => `<option value="${d}"${isEdit && tmpl!.day_of_week === d ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-time">Start Time</label>
        <input id="svc-tf-time" type="time" value="${isEdit && tmpl!.start_time ? tmpl!.start_time.substring(0,5) : ''}">
      </div>
      <div class="svc-field">
        <label for="svc-tf-venue">Venue</label>
        <input id="svc-tf-venue" type="text" placeholder="e.g. Main Auditorium"
          value="${isEdit && tmpl!.venue ? tmpl!.venue.replace(/"/g, '&quot;') : ''}">
      </div>
    </div>
    <div id="svc-tf-preview" style="padding:10px 12px;background:rgba(0,75,160,0.06);border:1px solid rgba(0,75,160,0.2);border-radius:var(--radius-sm);font-size:12px;color:var(--caci-blue-light);display:flex;align-items:center;gap:8px;">
      <i class="bi bi-arrow-repeat"></i>
      <span id="svc-tf-preview-text">—</span>
    </div>`,
    `<button class="btn btn-outline" id="svc-tf-cancel">Cancel</button>
     <button class="btn btn-primary" id="svc-tf-save">
       <i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Template'}
     </button>`,
    { large: false }
  )

  const updatePreview = () => {
    const recur = el.querySelector<HTMLSelectElement>('#svc-tf-recur')!.value
    const day   = el.querySelector<HTMLSelectElement>('#svc-tf-day')!.value
    const time  = el.querySelector<HTMLInputElement>('#svc-tf-time')!.value
    const preview = buildRecurrenceLabel({ recurrence: recur, day_of_week: day || null, start_time: time || null })
    const previewEl = el.querySelector<HTMLElement>('#svc-tf-preview-text')!
    previewEl.textContent = preview
  }
  el.querySelector('#svc-tf-recur')?.addEventListener('change', updatePreview)
  el.querySelector('#svc-tf-day')?.addEventListener('change', updatePreview)
  el.querySelector('#svc-tf-time')?.addEventListener('input', updatePreview)
  updatePreview()

  el.querySelector('#svc-tf-cancel')?.addEventListener('click', close)

  el.querySelector('#svc-tf-save')?.addEventListener('click', async () => {
    const title = el.querySelector<HTMLInputElement>('#svc-tf-title')!.value.trim()
    const titleErr = el.querySelector<HTMLElement>('#svc-tf-title-err')!
    if (!title) { titleErr.classList.add('show'); return }
    titleErr.classList.remove('show')

    const btn = el.querySelector<HTMLButtonElement>('#svc-tf-save')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`

    const payload = {
      title,
      service_type:  el.querySelector<HTMLSelectElement>('#svc-tf-type')!.value,
      recurrence:    el.querySelector<HTMLSelectElement>('#svc-tf-recur')!.value as any,
      day_of_week:   el.querySelector<HTMLSelectElement>('#svc-tf-day')!.value || null,
      start_time:    el.querySelector<HTMLInputElement>('#svc-tf-time')!.value || null,
      venue:         el.querySelector<HTMLInputElement>('#svc-tf-venue')!.value.trim() || null,
      is_active:     true,
    }

    try {
      if (isEdit) {
        await updateServiceTemplate(tmpl!.id, payload)
        _toast('Template updated.')
      } else {
        await createServiceTemplate(payload as any)
        _toast('Template created.')
      }
      close()
      await _loadTemplates()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Template'}`
      _toast(err?.message ?? 'Failed to save.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

// ══════════════════════════════════════════════════════
// TAB: REPORTS
// ══════════════════════════════════════════════════════

function _renderReportsTab(): void {
  if (!_tabContent) return

  _tabContent.innerHTML = /* html */`
    <!-- Stats -->
    <div class="svc-stats-row" id="svc-rep-stats">
      <div class="svc-stat" style="--stat-accent:var(--caci-blue);">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
            <i class="bi bi-graph-up-arrow" style="color:var(--caci-blue-light);font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Avg. Attendance</span>
        </div>
        <div class="svc-stat-value" id="svc-rep-avg-att">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#22c55e;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
            <i class="bi bi-arrow-up-right" style="color:#22c55e;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Best Attended</span>
        </div>
        <div class="svc-stat-value" id="svc-rep-best" style="font-size:14px;font-weight:600;">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#f0a500;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(240,165,0,0.12);">
            <i class="bi bi-person-plus-fill" style="color:#f0a500;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Total Services</span>
        </div>
        <div class="svc-stat-value" id="svc-rep-total">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#a78bfa;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(124,58,237,0.12);">
            <i class="bi bi-bar-chart-fill" style="color:#a78bfa;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Completion Rate</span>
        </div>
        <div class="svc-stat-value" id="svc-rep-rate">—</div>
      </div>
    </div>

    <!-- Range selector -->
    <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-lg);">
      <span style="font-size:12px;color:var(--text-secondary);">Range:</span>
      ${[['7d','7 days'],['30d','30 days'],['90d','3 months'],['1y','1 year']].map(([k,l]) =>
        `<button class="svc-chip-btn${_state.reportRange === k ? ' active' : ''}" data-range="${k}">${l}</button>`
      ).join('')}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <div class="svc-chart-wrap">
        <div class="svc-chart-title">Attendance Trend</div>
        <div class="svc-chart-canvas-wrap" id="svc-chart-trend">
          <canvas id="svc-canvas-trend" style="width:100%;height:100%;"></canvas>
        </div>
      </div>
      <div class="svc-chart-wrap">
        <div class="svc-chart-title">Services by Type</div>
        <div class="svc-chart-canvas-wrap" id="svc-chart-type" style="height:200px;">
          <canvas id="svc-canvas-type" style="width:100%;height:100%;"></canvas>
        </div>
      </div>
    </div>
    @media (max-width: 640px) {
      .svc-rep-grid { grid-template-columns: 1fr !important; }
    }

    <!-- Absence report -->
    <div class="svc-chart-wrap" style="margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div class="svc-chart-title" style="margin:0;">Members with Most Absences</div>
        <div class="svc-filter-wrap" style="flex-shrink:0;">
          <i class="bi bi-funnel"></i>
          <select class="svc-filter-select" id="svc-rep-abs-threshold" style="min-width:120px;">
            <option value="2">2+ absences</option>
            <option value="3" selected>3+ absences</option>
            <option value="5">5+ absences</option>
            <option value="10">10+ absences</option>
          </select>
        </div>
      </div>
      <div id="svc-rep-abs-list"></div>
    </div>

    <!-- Service performance table -->
    <div class="svc-chart-wrap">
      <div class="svc-chart-title">Service Performance</div>
      <div class="svc-table-wrap" style="border:none;background:transparent;">
        <div id="svc-rep-perf-table"></div>
      </div>
    </div>
  `

  // Add chip button CSS inline once
  if (!document.getElementById('svc-chip-css')) {
    const s = document.createElement('style')
    s.id = 'svc-chip-css'
    s.textContent = `
      .svc-chip-btn {
        padding: 5px 12px; border-radius: 99px; border: 1px solid var(--border-default);
        background: transparent; color: var(--text-secondary); font-size: 12px;
        font-family: var(--font-sans); cursor: pointer; transition: all 0.15s;
      }
      .svc-chip-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
      .svc-chip-btn.active {
        background: rgba(0,75,160,0.1); border-color: rgba(0,75,160,0.4);
        color: var(--caci-blue-light);
      }
    `
    document.head.appendChild(s)
  }

  _tabContent.querySelectorAll<HTMLElement>('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.reportRange = btn.dataset['range'] as any
      _tabContent?.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      _renderReportsData()
    })
  })

  _renderReportsData()
}

function _renderReportsData(): void {
  if (!_tabContent) return
  const services = _state.services

  // Stat computations
  const total       = services.length
  const completed   = services.filter(s => s.status === 'completed')
  const avgAtt      = completed.length > 0
    ? Math.round(completed.reduce((a, s) => a + s.present_count, 0) / completed.length)
    : 0
  const rate        = total > 0 ? Math.round(completed.length / total * 100) : 0
  const bestSvc     = [...completed].sort((a, b) => b.present_count - a.present_count)[0]

  const avgEl  = _tabContent.querySelector('#svc-rep-avg-att')
  const bestEl = _tabContent.querySelector('#svc-rep-best')
  const totEl  = _tabContent.querySelector('#svc-rep-total')
  const rateEl = _tabContent.querySelector('#svc-rep-rate')

  if (avgEl)  avgEl.textContent  = String(avgAtt)
  if (bestEl) bestEl.textContent = bestSvc ? `${bestSvc.present_count} (${bestSvc.title.substring(0, 18)})` : '—'
  if (totEl)  totEl.textContent  = String(total)
  if (rateEl) rateEl.textContent = `${rate}%`

  // Attendance trend bar chart (CSS-only, no canvas library required)
  const trendEl = _tabContent.querySelector<HTMLElement>('#svc-chart-trend')
  if (trendEl) {
    const recent  = completed.slice(0, 12).reverse()
    const maxAtt  = Math.max(...recent.map(s => s.present_count), 1)
    trendEl.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:4px;height:160px;padding:0 4px;">
        ${recent.map(s => {
          const pct  = Math.round(s.present_count / maxAtt * 100)
          const tc   = serviceTypeColor(s.service_type)
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" title="${s.title}: ${s.present_count} present">
            <div style="font-size:9px;color:var(--text-muted);font-weight:600;">${s.present_count}</div>
            <div style="flex:1;width:100%;display:flex;align-items:flex-end;">
              <div style="width:100%;height:${pct}%;min-height:4px;background:${tc.bg};border:1px solid ${tc.color}40;border-radius:3px 3px 0 0;transition:height 0.4s;"></div>
            </div>
            <div style="font-size:9px;color:var(--text-muted);transform:rotate(-30deg);white-space:nowrap;max-width:28px;overflow:hidden;text-overflow:ellipsis;">${formatDateShort(s.service_date)}</div>
          </div>`
        }).join('')}
        ${recent.length === 0 ? `<div style="width:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">No completed services yet</div>` : ''}
      </div>`
  }

  // Services by type donut (CSS-only)
  const typeEl = _tabContent.querySelector<HTMLElement>('#svc-chart-type')
  if (typeEl) {
    const counts: Record<string, number> = {}
    services.forEach(s => { counts[s.service_type] = (counts[s.service_type] ?? 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    typeEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:180px;">
        ${sorted.map(([type, count]) => {
          const tc  = serviceTypeColor(type)
          const pct = Math.round(count / total * 100)
          return `<div style="display:flex;align-items:center;gap:10px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${tc.color};flex-shrink:0;"></div>
            <div style="flex:1;font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${type}</div>
            <div style="width:80px;height:4px;background:var(--border-default);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${tc.color};border-radius:99px;"></div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);width:28px;text-align:right;">${count}</div>
          </div>`
        }).join('')}
      </div>`
  }

  // Performance table
  const perfEl = _tabContent.querySelector<HTMLElement>('#svc-rep-perf-table')
  if (perfEl) {
    const byType: Record<string, { count: number; totalPresent: number; totalAtt: number }> = {}
    services.forEach(s => {
      if (!byType[s.service_type]) byType[s.service_type] = { count: 0, totalPresent: 0, totalAtt: 0 }
      byType[s.service_type].count++
      byType[s.service_type].totalPresent += s.present_count
      byType[s.service_type].totalAtt     += s.attendance_count
    })

    perfEl.innerHTML = Object.entries(byType).map(([type, d]) => {
      const avgP = d.count > 0 ? Math.round(d.totalPresent / d.count) : 0
      const rate = d.totalAtt > 0 ? Math.round(d.totalPresent / d.totalAtt * 100) : 0
      const tc   = serviceTypeColor(type)
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
        <div style="width:8px;height:8px;border-radius:50%;background:${tc.color};flex-shrink:0;"></div>
        <div style="flex:1;font-size:13px;color:var(--text-primary);font-weight:500;">${type}</div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${d.count} services</div>
          <div style="font-size:10px;color:var(--text-muted);">Avg ${avgP} present · ${rate}% rate</div>
        </div>
      </div>`
    }).join('') || `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">No data yet</div>`
  }

  // Absences list
  const absEl    = _tabContent.querySelector<HTMLElement>('#svc-rep-abs-list')
  const threshold = parseInt((_tabContent.querySelector<HTMLSelectElement>('#svc-rep-abs-threshold')?.value ?? '3'))
  if (absEl) _renderAbsenceList(absEl, threshold)

  _tabContent.querySelector('#svc-rep-abs-threshold')?.addEventListener('change', e => {
    const t  = parseInt((e.target as HTMLSelectElement).value)
    if (absEl) _renderAbsenceList(absEl, t)
  })
}

function _renderAbsenceList(container: HTMLElement, threshold: number): void {
  const absentMap = new Map<string, { name: string; count: number }>()
  _state.services.forEach(s => {
    s  // future: join with attRecords for per-member absence tracking
  })

  // Use available attendance records from currently loaded state
  // Real implementation would query the DB for absence aggregation
  container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
    <i class="bi bi-info-circle" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>
    Load a service in the Attendance tab to build absence data, or implement a dedicated server-side absence aggregation query.
  </div>`
}

// ══════════════════════════════════════════════════════
// TAB: EVENTS
// ══════════════════════════════════════════════════════

function _renderEventsTab(): void {
  if (!_tabContent) return
  const user     = getCurrentUser()
  const canCreate = user && can(user, PERMISSIONS.SERVICES_CREATE)

  _tabContent.innerHTML = /* html */`
    <div class="svc-stats-row">
      <div class="svc-stat" style="--stat-accent:var(--caci-blue);">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
            <i class="bi bi-calendar-event-fill" style="color:var(--caci-blue-light);font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Upcoming Events</span>
        </div>
        <div class="svc-stat-value" id="svc-ev-upcoming">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#22c55e;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
            <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Completed (Year)</span>
        </div>
        <div class="svc-stat-value" id="svc-ev-completed">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#f0a500;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(240,165,0,0.12);">
            <i class="bi bi-people-fill" style="color:#f0a500;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">This Year</span>
        </div>
        <div class="svc-stat-value" id="svc-ev-year">—</div>
      </div>
      <div class="svc-stat" style="--stat-accent:#a78bfa;">
        <div class="svc-stat-icon-row">
          <div class="svc-stat-icon" style="background:rgba(124,58,237,0.12);">
            <i class="bi bi-calendar3" style="color:#a78bfa;font-size:15px;"></i>
          </div>
          <span class="svc-stat-label">Total Events</span>
        </div>
        <div class="svc-stat-value" id="svc-ev-total">—</div>
      </div>
    </div>

    <div class="svc-toolbar" style="margin-bottom:var(--space-md);">
      <div class="svc-search-wrap">
        <i class="bi bi-search"></i>
        <input type="text" id="svc-ev-search" placeholder="Search events…" autocomplete="off">
      </div>
      <div class="svc-filter-wrap">
        <i class="bi bi-funnel"></i>
        <select class="svc-filter-select" id="svc-ev-type-filter">
          <option value="all">All Types</option>
          <option value="Convention">Convention</option>
          <option value="Conference">Conference</option>
          <option value="Retreat">Retreat</option>
          <option value="Outreach">Outreach</option>
          <option value="Other">Other</option>
        </select>
      </div>
      ${canCreate ? `
      <div class="svc-toolbar-actions">
        <button class="svc-tbtn svc-tbtn-primary" id="svc-ev-create">
          <i class="bi bi-plus-lg"></i>
          <span class="svc-btn-label">New Event</span>
        </button>
      </div>` : ''}
    </div>

    <div id="svc-ev-content"></div>
  `

  // Events are services with certain service_types — filter from _state.services
  const eventTypes = ['Convention', 'Conference', 'Retreat', 'Outreach', 'Other']
  const events = _state.services.filter(s => eventTypes.includes(s.service_type))

  const today  = new Date().toISOString().split('T')[0]
  const year   = new Date().getFullYear().toString()

  const upcomingEl  = _tabContent.querySelector('#svc-ev-upcoming')
  const completedEl = _tabContent.querySelector('#svc-ev-completed')
  const yearEl      = _tabContent.querySelector('#svc-ev-year')
  const totalEl     = _tabContent.querySelector('#svc-ev-total')

  if (upcomingEl)  upcomingEl.textContent  = String(events.filter(e => e.service_date >= today && e.status !== 'cancelled').length)
  if (completedEl) completedEl.textContent = String(events.filter(e => e.status === 'completed' && e.service_date.startsWith(year)).length)
  if (yearEl)      yearEl.textContent      = String(events.filter(e => e.service_date.startsWith(year)).length)
  if (totalEl)     totalEl.textContent     = String(events.length)

  const content = _tabContent.querySelector<HTMLElement>('#svc-ev-content')!

  if (!events.length) {
    content.innerHTML = `<div class="svc-empty">
      <i class="bi bi-calendar-event"></i>
      <div class="svc-empty-title">No special events found</div>
      <div class="svc-empty-sub">Conventions, conferences, retreats and outreach events appear here when created with those service types.</div>
    </div>`
  } else {
    content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md);">
      ${events.map((ev, i) => {
        const tc    = serviceTypeColor(ev.service_type)
        const delay = Math.min(i * 35, 420)
        return `<div class="svc-tmpl-card" style="animation-delay:${delay}ms;cursor:pointer;" data-ev-id="${ev.id}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:40px;height:40px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="bi bi-calendar-star" style="font-size:17px;color:${tc.color};"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ev.title}</div>
              <div style="font-size:11px;color:var(--text-secondary);">${ev.service_type}</div>
            </div>
            ${statusBadge(ev.status)}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
            <div style="display:flex;align-items:center;gap:6px;"><i class="bi bi-calendar3" style="font-size:12px;"></i>${formatDate(ev.service_date)}</div>
            ${ev.venue ? `<div style="display:flex;align-items:center;gap:6px;"><i class="bi bi-geo-alt" style="font-size:12px;"></i>${ev.venue}</div>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>`

    content.querySelectorAll<HTMLElement>('[data-ev-id]').forEach(card => {
      card.addEventListener('click', () => _openServiceDrawer(card.dataset['evId']!))
    })
  }

  _tabContent.querySelector('#svc-ev-create')?.addEventListener('click', () => _openCreateServiceModal())
}

// ══════════════════════════════════════════════════════
// TAB: SETTINGS
// ══════════════════════════════════════════════════════

function _renderSettingsTab(): void {
  if (!_tabContent) return

  _tabContent.innerHTML = /* html */`
    <div style="max-width:640px;display:flex;flex-direction:column;gap:var(--space-xl);">

      <!-- Service Types -->
      <div class="svc-chart-wrap">
        <div class="svc-chart-title">Service Types</div>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 14px;">
          Service types are defined inline when creating services. The standard types are:
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${SERVICE_TYPES.map(t => {
            const tc = serviceTypeColor(t)
            return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;background:${tc.bg};border:1px solid ${tc.color}30;font-size:12px;font-weight:500;color:${tc.color};">${t}</span>`
          }).join('')}
        </div>
      </div>

      <!-- Calendar settings -->
      <div class="svc-chart-wrap">
        <div class="svc-chart-title">Calendar Settings</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-md);">
          <div class="svc-field">
            <label for="svc-set-first-day">First Day of Week</label>
            <select id="svc-set-first-day">
              <option value="0" selected>Sunday</option>
              <option value="1">Monday</option>
            </select>
          </div>
          <div class="svc-field">
            <label for="svc-set-default-view">Default View</label>
            <select id="svc-set-default-view">
              <option value="list" selected>List</option>
              <option value="calendar">Calendar</option>
            </select>
          </div>
          <div class="svc-field">
            <label for="svc-set-time-format">Time Format</label>
            <select id="svc-set-time-format">
              <option value="12" selected>12-hour (9:00 AM)</option>
              <option value="24">24-hour (09:00)</option>
            </select>
          </div>
          <div style="display:flex;justify-content:flex-end;">
            <button class="btn btn-primary" id="svc-set-save">
              <i class="bi bi-floppy"></i> Save Settings
            </button>
          </div>
        </div>
      </div>

      <!-- Attendance settings -->
      <div class="svc-chart-wrap">
        <div class="svc-chart-title">Attendance Settings</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-md);">
          <div class="svc-field">
            <label for="svc-set-def-status">Default Attendance Status</label>
            <select id="svc-set-def-status">
              <option value="absent" selected>Absent (must mark present)</option>
              <option value="present">Present (must mark absent)</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border-subtle);">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary);">Allow late status</div>
              <div style="font-size:11px;color:var(--text-muted);">Enable "Late" as an attendance option</div>
            </div>
            <label style="cursor:pointer;display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="svc-set-allow-late">
              <span style="font-size:12px;color:var(--text-secondary);">Enabled</span>
            </label>
          </div>
        </div>
      </div>

    </div>
  `

  _tabContent.querySelector('#svc-set-save')?.addEventListener('click', () => {
    _toast('Settings saved.')
  })
}

// ══════════════════════════════════════════════════════
// TAB BAR
// ══════════════════════════════════════════════════════

const TABS = [
  { key: 'schedule',   label: 'Schedule',   icon: 'bi-calendar-event' },
  { key: 'attendance', label: 'Attendance', icon: 'bi-person-check'   },
  { key: 'templates',  label: 'Templates',  icon: 'bi-arrow-repeat'   },
  { key: 'reports',    label: 'Reports',    icon: 'bi-bar-chart-line'  },
  { key: 'events',     label: 'Events',     icon: 'bi-calendar-star'  },
  { key: 'settings',   label: 'Settings',   icon: 'bi-gear'           },
]

function _renderTabBar(): void {
  const bar = _container?.querySelector<HTMLElement>('#svc-tab-bar')
  if (!bar) return

  bar.innerHTML = TABS.map(t => {
    const count = t.key === 'schedule'
      ? _state.services.length
      : t.key === 'templates'
      ? _state.templates.length
      : null

    return `<button
      class="svc-tab-btn${_activeTab === t.key ? ' active' : ''}"
      data-tab="${t.key}"
      aria-selected="${_activeTab === t.key}"
      role="tab"
      aria-controls="svc-tab-panel">
      <i class="bi ${t.icon}"></i>
      <span class="svc-tab-label">${t.label}</span>
      ${count !== null && count > 0 ? `<span class="svc-tab-count">${count}</span>` : ''}
    </button>`
  }).join('')

  bar.querySelectorAll<HTMLElement>('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['tab']!
      if (tab === _activeTab) return
      _activeTab = tab
      _renderTabBar()
      _renderActiveTab()
    })
  })
}

function _renderActiveTab(): void {
  if (!_tabContent) return
  _tabContent.innerHTML = ''

  switch (_activeTab) {
    case 'schedule':   _renderScheduleTab();   _loadSchedule();   break
    case 'attendance': _renderAttendanceTab();                     break
    case 'templates':  _renderTemplatesTab();                      break
    case 'reports':    _renderReportsTab();                        break
    case 'events':     _renderEventsTab();                         break
    case 'settings':   _renderSettingsTab();                       break
  }
}

// ══════════════════════════════════════════════════════
// MAIN PageModule
// ══════════════════════════════════════════════════════

const ServicesPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    _destroyed   = false
    _container   = container
    _activeTab   = 'schedule'

    // Reset state
    Object.assign(_state, {
      services: [], filtered: [],
      search: '', statusFilter: 'all', typeFilter: 'all', groupFilter: 'all',
      statFilter: null, view: 'list',
      calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
      openServiceId: null,
      attServices: [], attServiceId: null, attRecords: [], attFiltered: [],
      attSearch: '', attStatusFilter: 'all', attChanged: new Set(), attCurrentStatus: new Map(),
      templates: [], tmplFiltered: [], tmplSearch: '',
      reportRange: '30d',
      loading: false, saving: false,
    })

    injectCSS()

    const user = getCurrentUser()

    container.innerHTML = /* html */`
      <div class="svc-page">

        <!-- Page header -->
        <div class="svc-page-header">
          <div>
            <h1 class="svc-page-title">Services &amp; Events</h1>
            <p class="svc-page-sub">Schedule, attendance, templates and reports for your assembly</p>
          </div>
        </div>

        <!-- Tab bar -->
        <div class="svc-tab-bar-wrap">
          <div class="svc-tab-bar" id="svc-tab-bar" role="tablist" aria-label="Services workspace tabs"></div>
        </div>

        <!-- Tab panel -->
        <div id="svc-tab-content" role="tabpanel" id="svc-tab-panel"></div>

      </div>`

    _tabContent = container.querySelector('#svc-tab-content')!

    // Register realtime listeners
    on('service:created', _onServiceCreated)
    on('service:updated', _onServiceUpdated)
    on('service:deleted', _onServiceDeleted)
    on('serviceTemplate:created', _onTmplCreated)
    on('serviceTemplate:updated', _onTmplUpdated)

    _renderTabBar()
    _renderActiveTab()
  },

  destroy(): void {
    _destroyed  = true
    _container  = null
    _tabContent = null

    off('service:created', _onServiceCreated)
    off('service:updated', _onServiceUpdated)
    off('service:deleted', _onServiceDeleted)
    off('serviceTemplate:created', _onTmplCreated)
    off('serviceTemplate:updated', _onTmplUpdated)

    // Clean up overlays
    document.getElementById('svc-drawer-wrap')?.remove()
    document.getElementById('svc-modal-wrap')?.remove()
    document.getElementById('svc-ctx')?.remove()
    document.getElementById('svc-toast-el')?.remove()
  },
}

export default ServicesPage