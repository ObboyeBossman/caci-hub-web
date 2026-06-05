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

// ══════════════════════════════════════════════════════
// TAB: ATTENDANCE
// ══════════════════════════════════════════════════════

export function _renderAttendanceTab(): void {
  injectAttendanceCSS()
  if (!shared.tabContent) return
  const user   = getCurrentUser()
  const canMark = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)

  shared.tabContent.innerHTML = /* html */`
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
  if (state.attServiceId) {
    _loadAttendanceForService(state.attServiceId)
  }
}

export async function _loadAttendancePicker(): Promise<void> {
  const picker = shared.tabContent?.querySelector<HTMLElement>('#svc-att-service-picker')
  if (!picker) return

  try {
    const services = await listServicesDisplay({ }, { limit: 20 })
    state.attServices = services

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
        <div class="svc-picker-row${state.attServiceId === s.id ? ' selected' : ''}" data-svc-pick="${s.id}">
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

export async function _loadAttendanceForService(serviceId: string): Promise<void> {
  state.attServiceId = serviceId

  const pickerSection = shared.tabContent?.querySelector<HTMLElement>('#svc-att-picker-section')
  const mainSection   = shared.tabContent?.querySelector<HTMLElement>('#svc-att-main-section')
  if (!pickerSection || !mainSection) return

  pickerSection.style.display = 'none'
  mainSection.style.display = ''

  const attContent = shared.tabContent?.querySelector<HTMLElement>('#svc-att-content')!
  attContent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;">
    <span class="svc-spinner" style="width:32px;height:32px;border-width:3px;border-top-color:var(--caci-blue);border-color:rgba(0,75,160,0.2);"></span>
  </div>`

  try {
    const records = await listAttendanceDisplay(serviceId)
    if (shared.destroyed) return

    state.attRecords = records
    state.attCurrentStatus = new Map(records.map(r => [r.member_id, r.status]))
    state.attChanged = new Set()

    const svc = state.attServices.find(s => s.id === serviceId)
    const label = shared.tabContent?.querySelector<HTMLElement>('#svc-att-service-label')
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

export function _applyAttendanceFilters(): void {
  const q = state.attSearch.toLowerCase()
  state.attFiltered = state.attRecords.filter(r => {
    const statusOk = state.attStatusFilter === 'all'
      || (state.attCurrentStatus.get(r.member_id) ?? r.status) === state.attStatusFilter
    const searchOk = !q
      || r.member_name.toLowerCase().includes(q)
      || (r.member_number ?? '').toLowerCase().includes(q)
    return statusOk && searchOk
  })
}

export function _renderAttendanceStats(): void {
  const el = shared.tabContent?.querySelector<HTMLElement>('#svc-att-stats')
  if (!el) return

  const records  = state.attRecords
  const statuses = records.map(r => state.attCurrentStatus.get(r.member_id) ?? r.status)
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
      state.attStatusFilter = f
      el.querySelectorAll('.svc-stat').forEach(c => c.classList.remove('active-filter'))
      if (f !== 'all') card.classList.add('active-filter')
      _applyAttendanceFilters()
      _renderAttendanceTable()
    })
  })
}

export function _renderAttendanceTable(): void {
  const container = shared.tabContent?.querySelector<HTMLElement>('#svc-att-content')
  const meta      = shared.tabContent?.querySelector<HTMLElement>('#svc-att-meta')
  if (!container || !meta) return

  const user     = getCurrentUser()
  const canMark  = user && can(user, PERMISSIONS.SERVICES_ATTENDANCE_MARK)
  const list     = state.attFiltered

  meta.innerHTML = `<span>Showing <strong>${list.length}</strong> member${list.length !== 1 ? 's' : ''}</span>
    ${state.attChanged.size > 0 ? `<span style="font-size:12px;color:#d29922;font-weight:500;display:flex;align-items:center;gap:4px;"><i class="bi bi-circle-fill" style="font-size:8px;"></i>${state.attChanged.size} unsaved change${state.attChanged.size !== 1 ? 's' : ''}</span>` : ''}`

  // Show unsaved badge on save button
  const saveBadge = shared.tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
  if (saveBadge) {
    saveBadge.style.display = state.attChanged.size > 0 ? 'flex' : 'none'
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
          const currentStatus = state.attCurrentStatus.get(r.member_id) ?? r.status
          const bg = avatarColor(r.member_name)
          const ini = initials(r.member_name)
          const changed = state.attChanged.has(r.member_id)
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

        const prevStatus = state.attCurrentStatus.get(memberId)
        state.attCurrentStatus.set(memberId, status)
        state.attChanged.add(memberId)

        // Update all buttons for this member (table + card)
        container.querySelectorAll<HTMLElement>(`[data-set-status][data-member="${memberId}"]`).forEach(b => {
          const s = b.dataset['setStatus']!
          b.className = 'svc-att-status-btn' + (s === status ? ` active-${s}` : '')
          b.setAttribute('aria-pressed', String(s === status))
        })

        // Reflect on stat cards
        state.attFiltered = state.attFiltered  // trigger re-render of stats
        _renderAttendanceStats()

        // Unsaved badge
        const saveBadge = shared.tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
        if (saveBadge) saveBadge.style.display = 'flex'

        const metaEl = shared.tabContent?.querySelector<HTMLElement>('#svc-att-meta')
        if (metaEl) metaEl.innerHTML =
          `<span>Showing <strong>${list.length}</strong> member${list.length !== 1 ? 's' : ''}</span>
           <span style="font-size:12px;color:#d29922;font-weight:500;display:flex;align-items:center;gap:4px;"><i class="bi bi-circle-fill" style="font-size:8px;"></i>${state.attChanged.size} unsaved</span>`
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

export function _updateBulkBar(): void {
  const checkboxes = shared.tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
  const bar        = shared.tabContent?.querySelector<HTMLElement>('#svc-att-bulk-bar')!
  const count      = shared.tabContent?.querySelector<HTMLElement>('#svc-att-bulk-count')!

  if (checkboxes.length > 0) {
    bar.classList.add('visible')
    count.textContent = String(checkboxes.length)
  } else {
    bar.classList.remove('visible')
  }
}

export function _bindAttendanceToolbar(): void {
  shared.tabContent?.querySelector('#svc-att-back')?.addEventListener('click', () => {
    state.attServiceId = null
    const pickerSection = shared.tabContent?.querySelector<HTMLElement>('#svc-att-picker-section')
    const mainSection   = shared.tabContent?.querySelector<HTMLElement>('#svc-att-main-section')
    if (pickerSection) pickerSection.style.display = ''
    if (mainSection)   mainSection.style.display = 'none'
  })

  const search = shared.tabContent?.querySelector<HTMLInputElement>('#svc-att-search')!
  const debouncedSearch = debounce((q: string) => {
    state.attSearch = q
    _applyAttendanceFilters()
    _renderAttendanceTable()
  }, 220)
  search?.addEventListener('input', () => debouncedSearch(search.value))

  shared.tabContent?.querySelector('#svc-att-filter')?.addEventListener('change', e => {
    state.attStatusFilter = (e.target as HTMLSelectElement).value as any
    _applyAttendanceFilters()
    _renderAttendanceTable()
  })

  shared.tabContent?.querySelector('#svc-att-mark-all')?.addEventListener('click', () => {
    state.attRecords.forEach(r => {
      state.attCurrentStatus.set(r.member_id, 'present')
      state.attChanged.add(r.member_id)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
    toast('All members marked present.')
  })

  shared.tabContent?.querySelector('#svc-att-save')?.addEventListener('click', async () => {
    if (!state.attServiceId || state.attChanged.size === 0) return
    const btn = shared.tabContent?.querySelector<HTMLButtonElement>('#svc-att-save')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`

    try {
      const records = [...state.attChanged].map(memberId => ({
        service_id: state.attServiceId!,
        member_id:  memberId,
        status:     state.attCurrentStatus.get(memberId)!,
      }))
      await bulkUpsertAttendance(records)
      state.attChanged.clear()
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-floppy"></i><span class="svc-btn-label">Save</span>`
      const saveBadge = shared.tabContent?.querySelector<HTMLElement>('#svc-att-save-badge')
      if (saveBadge) saveBadge.style.display = 'none'
      toast(`Attendance saved — ${records.length} record${records.length !== 1 ? 's' : ''} updated.`)
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-floppy"></i><span class="svc-btn-label">Save</span>`
      toast(err?.message ?? 'Failed to save attendance.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })

  shared.tabContent?.querySelector('#svc-att-bulk-present')?.addEventListener('click', () => {
    const checked = shared.tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
    checked.forEach(chk => {
      const mid = chk.dataset['member']!
      state.attCurrentStatus.set(mid, 'present')
      state.attChanged.add(mid)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
  })

  shared.tabContent?.querySelector('#svc-att-bulk-absent')?.addEventListener('click', () => {
    const checked = shared.tabContent?.querySelectorAll<HTMLInputElement>('.svc-att-chk:checked') ?? []
    checked.forEach(chk => {
      const mid = chk.dataset['member']!
      state.attCurrentStatus.set(mid, 'absent')
      state.attChanged.add(mid)
    })
    _applyAttendanceFilters()
    _renderAttendanceStats()
    _renderAttendanceTable()
  })
}

// ══════════════════════════════════════════════════════

const _TAB_CSS = `
/* ── Attendance table ── */
.svc-att-row {
  display: grid;
  grid-template-columns: 44px 1fr 140px 120px 140px 120px;
  align-items: center; gap: 0; padding: 0 14px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s; min-height: 58px;
}
.svc-att-row.header {
  min-height: 38px; background: var(--bg-card);
  border-bottom: 1px solid var(--border-default);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.svc-att-row:last-child { border-bottom: none; }
.svc-att-row:hover:not(.header) { background: rgba(255,255,255,0.02); }

@media (max-width: 860px) {
  .svc-att-row { grid-template-columns: 44px 1fr 140px 120px; }
  .svc-att-col-hide-group, .svc-att-col-hide-notes { display: none !important; }
}
@media (max-width: 640px) {
  .svc-att-row.header { display: none !important; }
  .svc-att-row:not(.header) { display: none !important; }
}

/* ── Attendance status buttons ── */
.svc-att-status-group {
  display: inline-flex; border: 1px solid var(--border-default);
  border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0;
}
.svc-att-status-btn {
  padding: 0 10px; height: 28px; border: none; background: transparent;
  font-size: 11px; font-weight: 500; cursor: pointer; font-family: var(--font-sans);
  color: var(--text-muted); transition: all 0.15s; white-space: nowrap;
}
.svc-att-status-btn + .svc-att-status-btn { border-left: 1px solid var(--border-default); }
.svc-att-status-btn.active-present { background: rgba(34,197,94,0.15); color: #56d364; }
.svc-att-status-btn.active-absent  { background: rgba(198,0,38,0.12); color: #ff6b7a; }
.svc-att-status-btn.active-excused { background: rgba(210,153,34,0.12); color: #d29922; }
.svc-att-status-btn:hover:not([class*="active"]) {
  background: var(--bg-hover); color: var(--text-secondary);
}

/* ── Attendance mobile card ── */
.svc-att-card {
  display: none;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  padding: 12px 14px;
  animation: svcFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
}
@media (max-width: 639px) { .svc-att-card { display: block !important; } }

/* ── Bulk action bar ── */
.svc-bulk-bar {
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid rgba(0,75,160,0.3); border-radius: var(--radius-lg);
  padding: 10px 14px; display: none; align-items: center; gap: var(--space-sm);
  box-shadow: 0 0 0 1px rgba(0,75,160,0.1), 0 4px 24px rgba(0,0,0,0.2);
  animation: svcSlideDown 0.3s cubic-bezier(0.16,1,0.3,1) both;
  margin-bottom: var(--space-md);
}
.svc-bulk-bar.visible { display: flex; }
@keyframes svcSlideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Section subheader ── */
.svc-section-head {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted);
  padding: 0 2px; margin-bottom: var(--space-sm);
}

/* ── Attendance service picker ── */
.svc-picker-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 12px 14px;
  cursor: pointer; transition: border-color 0.18s, transform 0.18s;
}
.svc-picker-row:hover {
  border-color: rgba(0,75,160,0.35); transform: translateX(2px);
}
.svc-picker-row.selected {
  border-color: var(--caci-blue);
  background: rgba(0,75,160,0.04);
}
/* ── Attendance summary bar ── */
.svc-att-summary {
  display: flex; gap: var(--space-sm); flex-wrap: wrap;
  padding: 12px 14px; border-bottom: 1px solid var(--border-default);
  background: rgba(255,255,255,0.01);
}
.svc-att-sum-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary);
}
.svc-att-sum-val {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
}

`;
export function injectAttendanceCSS() {
  if (document.getElementById('css-injectAttendanceCSS')) return;
  const s = document.createElement('style');
  s.id = 'css-injectAttendanceCSS';
  s.textContent = _TAB_CSS;
  document.head.appendChild(s);
}
