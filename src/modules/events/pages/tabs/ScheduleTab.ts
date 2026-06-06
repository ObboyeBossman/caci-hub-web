import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }                from '@core/authorization/authorization-service'
import { PERMISSIONS }        from '@core/authorization/permissions'
import { debounce }           from '@shared/utils/debounce'
import {
  listServicesDisplay, listServiceTemplates, getServiceDisplay, getServiceStats, listAttendanceDisplay,
  softDeleteService, createService, updateService, createServiceTemplate, updateServiceTemplate,
  softDeleteTemplate, bulkUpsertAttendance, createServiceFromTemplate,
  formatDate, formatDateShort, formatTime, isToday, isFuture, buildRecurrenceLabel
} from '../../repository'
import { RECURRENCE_LABELS, SERVICE_TYPES, DAYS_OF_WEEK } from '../../types'
import type { ServiceDisplay, TemplateDisplay } from '../../types'
import type { ServiceStatus, AttendanceStatus } from '../../../../types/service.types'
import { state, shared } from '../state'
import {
  avatarColor, initials, statusBadge, attBadge, serviceTypeColor,
  toast, closeCtx, openCtx, openDrawer, openModal, confirm
} from '../components'
import { _switchTabAndLoad } from '../Services'

// ══════════════════════════════════════════════════════
// TAB: SCHEDULE
// ══════════════════════════════════════════════════════

export async function _loadSchedule(): Promise<void> {
  if (shared.destroyed) return
  const assemblyId = getActiveAssemblyId()

  try {
    const [services] = await Promise.all([
      listServicesDisplay(),
    ])
    if (shared.destroyed) return
    state.services = services
    _applyScheduleFilters()
    _renderScheduleStats()
    _renderScheduleContent()
  } catch (err: any) {
    if (shared.tabContent) {
      shared.tabContent.innerHTML = `<div class="svc-empty">
        <i class="bi bi-exclamation-circle"></i>
        <div class="svc-empty-title">Failed to load services</div>
        <div class="svc-empty-sub">${err?.message ?? 'Something went wrong.'}</div>
      </div>`
    }
  }
}

export function _applyScheduleFilters(): void {
  const q = state.search.toLowerCase()
  state.filtered = state.services.filter(s => {
    const statusOk = state.statusFilter === 'all' || s.status === state.statusFilter
    const typeOk   = state.typeFilter === 'all'   || s.service_type === state.typeFilter
    const groupOk  = state.groupFilter === 'all'  || s.group_id === state.groupFilter || (!s.group_id && state.groupFilter === 'assembly')
    const searchOk = !q || s.title.toLowerCase().includes(q) || (s.service_type ?? '').toLowerCase().includes(q) || (s.venue ?? '').toLowerCase().includes(q)
    const statOk   = !state.statFilter
      || state.statFilter === 'all'
      || (state.statFilter === 'upcoming'   && isFuture(s.service_date))
      || (state.statFilter === 'today'      && isToday(s.service_date))
      || (state.statFilter === 'completed'  && s.status === 'completed')
      || (state.statFilter === 'cancelled'  && s.status === 'cancelled')
    return statusOk && typeOk && groupOk && searchOk && statOk
  })
}

export function _renderScheduleTab(): void {
  injectScheduleCSS()
  if (!shared.tabContent) return
  const user     = getCurrentUser()
  const canCreate = user && can(user, PERMISSIONS.SERVICES_CREATE)
  const canEdit   = user && can(user, PERMISSIONS.SERVICES_EDIT)

  shared.tabContent.innerHTML = /* html */`
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
          <button class="svc-view-btn ${state.view === 'list' ? 'active' : ''}" id="svc-view-list" title="List view" aria-label="List view">
            <i class="bi bi-list-ul"></i>
          </button>
          <button class="svc-view-btn ${state.view === 'calendar' ? 'active' : ''}" id="svc-view-cal" title="Calendar view" aria-label="Calendar view">
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

export function _renderScheduleStats(): void {
  const el = shared.tabContent?.querySelector<HTMLElement>('#svc-sched-stats')
  if (!el) return

  const { services } = state
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
      if (state.statFilter === key) {
        _clearStatFilter()
      } else {
        state.statFilter = key
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

  if (state.statFilter) {
    const active = el.querySelector<HTMLElement>(`[data-filter="${state.statFilter}"]`)
    active?.classList.add('active-filter')
  }
}

export function _clearStatFilter(): void {
  state.statFilter = null
  shared.tabContent?.querySelectorAll('.svc-stat').forEach(c => c.classList.remove('active-filter'))
  _applyScheduleFilters()
  _renderScheduleContent()
  _renderScheduleFilterBanner()
}

export function _renderScheduleFilterBanner(): void {
  const banner = shared.tabContent?.querySelector<HTMLElement>('#svc-sched-banner')
  if (!banner) return

  if (state.statFilter && state.statFilter !== 'all') {
    const labels: Record<string, string> = {
      upcoming: 'Upcoming', today: 'Today', completed: 'Completed', cancelled: 'Cancelled',
    }
    banner.classList.add('show')
    banner.innerHTML = `
      <i class="bi bi-funnel-fill" style="color:var(--caci-blue-light);"></i>
      <span class="svc-filter-pill">${labels[state.statFilter] ?? state.statFilter}</span>
      <span style="font-size:12px;color:var(--text-secondary);">${state.filtered.length} result${state.filtered.length !== 1 ? 's' : ''}</span>
      <button class="svc-filter-clear" id="svc-sched-clear-filter"><i class="bi bi-x"></i> Clear</button>`
    banner.querySelector('#svc-sched-clear-filter')?.addEventListener('click', () => _clearStatFilter())
  } else {
    banner.classList.remove('show')
  }
}

export function _renderScheduleContent(): void {
  const content = shared.tabContent?.querySelector<HTMLElement>('#svc-sched-content')
  const meta    = shared.tabContent?.querySelector<HTMLElement>('#svc-sched-meta')
  if (!content || !meta) return

  meta.innerHTML = `<span>Showing <strong>${state.filtered.length}</strong> service${state.filtered.length !== 1 ? 's' : ''}</span>`
  _renderScheduleFilterBanner()

  if (state.view === 'calendar') {
    _renderCalendar(content)
  } else {
    _renderServiceList(content)
  }
}

export function _renderServiceList(container: HTMLElement): void {
  const user    = getCurrentUser()
  const canEdit = user && can(user, PERMISSIONS.SERVICES_EDIT)
  const canDel  = user && can(user, PERMISSIONS.SERVICES_DELETE)
  const list    = state.filtered

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
      const svc = state.services.find(s => s.id === id)
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

export function _openServiceCtx(
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

  openCtx(x, y, items)
}

export async function _markServiceStatus(id: string, status: ServiceStatus): Promise<void> {
  try {
    await updateService(id, { status })
    await _loadSchedule()
    toast(`Service marked as ${status}.`)
  } catch (err: any) {
    toast(err?.message ?? 'Failed to update status.', 'bi-exclamation-circle', 'var(--caci-red)')
  }
}

export function _deleteService(svc: ServiceDisplay): void {
  const user = getCurrentUser()
  if (!user) return
  confirm(
    `Delete "${svc.title}"?`,
    'This service will be soft-deleted and hidden from all views. Attendance records are preserved.',
    'Delete Service',
    async () => {
      await softDeleteService(svc.id, user.id)
      await _loadSchedule()
      toast('Service deleted.')
    }
  )
}

export async function _openServiceDrawer(id: string): Promise<void> {
  const svc = state.services.find(s => s.id === id)
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

  const drawer = openDrawer(svc.title, body, footer)

  document.getElementById('svc-drawer-att-btn')?.addEventListener('click', () => {
    drawer.close()
    _switchTabAndLoad('attendance', svc.id)
  })
  document.getElementById('svc-drawer-edit-btn')?.addEventListener('click', () => {
    drawer.close()
    _openEditServiceModal(svc)
  })
}


export function _renderCalendar(container: HTMLElement): void {
  const year  = state.calYear
  const month = state.calMonth
  const now   = new Date()

  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()

  // Build service map: date string → services[]
  const svcMap = new Map<string, ServiceDisplay[]>()
  state.services.forEach(s => {
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
    if (state.calMonth === 0) { state.calYear--; state.calMonth = 11 }
    else state.calMonth--
    _renderCalendar(container)
  })
  container.querySelector('#svc-cal-next')?.addEventListener('click', () => {
    if (state.calMonth === 11) { state.calYear++; state.calMonth = 0 }
    else state.calMonth++
    _renderCalendar(container)
  })

  container.querySelectorAll<HTMLElement>('.svc-cal-event').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation()
      _openServiceDrawer(el.dataset['svcId']!)
    })
  })
}

export function _dateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  return d.toISOString().split('T')[0]
}

export function _bindScheduleToolbar(): void {
  const search = shared.tabContent?.querySelector<HTMLInputElement>('#svc-sched-search')!
  const debouncedSearch = debounce((q: string) => {
    state.search = q
    _applyScheduleFilters()
    _renderScheduleContent()
  }, 220)
  search?.addEventListener('input', () => debouncedSearch(search.value))

  shared.tabContent?.querySelector('#svc-sched-type-filter')?.addEventListener('change', e => {
    state.typeFilter = (e.target as HTMLSelectElement).value
    _applyScheduleFilters(); _renderScheduleContent()
  })
  shared.tabContent?.querySelector('#svc-sched-status-filter')?.addEventListener('change', e => {
    state.statusFilter = (e.target as HTMLSelectElement).value as any
    _applyScheduleFilters(); _renderScheduleContent()
  })

  shared.tabContent?.querySelector('#svc-view-list')?.addEventListener('click', () => {
    state.view = 'list'
    shared.tabContent?.querySelector('#svc-view-list')?.classList.add('active')
    shared.tabContent?.querySelector('#svc-view-cal')?.classList.remove('active')
    _renderScheduleContent()
  })
  shared.tabContent?.querySelector('#svc-view-cal')?.addEventListener('click', () => {
    state.view = 'calendar'
    shared.tabContent?.querySelector('#svc-view-cal')?.classList.add('active')
    shared.tabContent?.querySelector('#svc-view-list')?.classList.remove('active')
    _renderScheduleContent()
  })

  // Mobile search toggle
  shared.tabContent?.querySelector('#svc-sched-mob-search')?.addEventListener('click', () => {
    const toolbar = shared.tabContent?.querySelector('#svc-sched-toolbar')!
    const wrap    = shared.tabContent?.querySelector<HTMLElement>('#svc-sched-search-wrap')!
    toolbar.classList.toggle('search-open')
    wrap.classList.toggle('open')
    if (wrap.classList.contains('open')) search?.focus()
  })

  shared.tabContent?.querySelector('#svc-sched-create')?.addEventListener('click', () => _openCreateServiceModal())
  shared.tabContent?.querySelector('#svc-sched-from-tmpl')?.addEventListener('click', () => _openFromTemplateModal())
}

// ── Create / Edit Service Modal ───────────────────────────────────────────────

export function _openCreateServiceModal(): void {
  _openServiceFormModal(null)
}

export function _openEditServiceModal(svc: ServiceDisplay): void {
  _openServiceFormModal(svc)
}

export function _openServiceFormModal(svc: ServiceDisplay | null): void {
  const isEdit = !!svc
  const { el, close } = openModal(
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
        toast('Service updated.')
      } else {
        await createService({ title, service_type: type, service_date: date, start_time: time, venue, notes, status: 'scheduled' })
        toast('Service created.')
      }
      close()
      await _loadSchedule()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Service'}`
      toast(err?.message ?? 'Failed to save.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

export function _openFromTemplateModal(): void {
  const { el, close } = openModal(
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
      toast('Service generated from template.')
      await _loadSchedule()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-lightning"></i> Generate`
      toast(err?.message ?? 'Failed to generate.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}


const _TAB_CSS = `
/* ── Calendar view ── */
.svc-cal-wrap {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
}
.svc-cal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border-default);
}
.svc-cal-nav {
  width: 32px; height: 32px; border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); background: var(--bg-page);
  color: var(--text-secondary); cursor: pointer; display: flex;
  align-items: center; justify-content: center; font-size: 14px;
  transition: all 0.15s;
}
.svc-cal-nav:hover { border-color: var(--border-strong); color: var(--text-primary); }
.svc-cal-month { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.svc-cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr);
}
.svc-cal-daylabel {
  padding: 8px 4px; text-align: center;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
}
.svc-cal-cell {
  min-height: 90px; border-right: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  padding: 6px; position: relative;
  transition: background 0.15s;
}
.svc-cal-cell:nth-child(7n) { border-right: none; }
.svc-cal-cell:hover { background: rgba(255,255,255,0.015); }
.svc-cal-cell.other-month { opacity: 0.35; }
.svc-cal-cell.today { background: rgba(0,75,160,0.05); }
.svc-cal-cell.today .svc-cal-date {
  background: var(--caci-blue); color: #fff; border-radius: 50%;
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
}
.svc-cal-date {
  font-size: 11px; font-weight: 500; color: var(--text-secondary);
  margin-bottom: 4px; width: 22px; text-align: center;
}
.svc-cal-event {
  display: block; font-size: 10px; font-weight: 500;
  padding: 2px 5px; border-radius: 3px; margin-bottom: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer; transition: opacity 0.15s;
}
.svc-cal-event:hover { opacity: 0.8; }
.svc-cal-more {
  font-size: 10px; color: var(--text-muted); cursor: pointer;
}
@media (max-width: 640px) {
  .svc-cal-cell { min-height: 60px; padding: 4px; }
  .svc-cal-event { display: none; }
  .svc-cal-event:first-of-type { display: block; }
}

`;
export function injectScheduleCSS() {
  if (document.getElementById('css-injectScheduleCSS')) return;
  const s = document.createElement('style');
  s.id = 'css-injectScheduleCSS';
  s.textContent = _TAB_CSS;
  document.head.appendChild(s);
}
