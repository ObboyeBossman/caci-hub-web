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
import { _openServiceDrawer, _openCreateServiceModal } from './ScheduleTab'

// TAB: EVENTS
// ══════════════════════════════════════════════════════

export function _renderEventsTab(): void {
  if (!shared.tabContent) return
  const user     = getCurrentUser()
  const canCreate = user && can(user, PERMISSIONS.SERVICES_CREATE)

  shared.tabContent.innerHTML = /* html */`
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

  // Events are services with certain service_types — filter from state.services
  const eventTypes = ['Convention', 'Conference', 'Retreat', 'Outreach', 'Other']
  const events = state.services.filter(s => eventTypes.includes(s.service_type))

  const today  = new Date().toISOString().split('T')[0]
  const year   = new Date().getFullYear().toString()

  const upcomingEl  = shared.tabContent.querySelector('#svc-ev-upcoming')
  const completedEl = shared.tabContent.querySelector('#svc-ev-completed')
  const yearEl      = shared.tabContent.querySelector('#svc-ev-year')
  const totalEl     = shared.tabContent.querySelector('#svc-ev-total')

  if (upcomingEl)  upcomingEl.textContent  = String(events.filter(e => e.service_date >= today && e.status !== 'cancelled').length)
  if (completedEl) completedEl.textContent = String(events.filter(e => e.status === 'completed' && e.service_date.startsWith(year)).length)
  if (yearEl)      yearEl.textContent      = String(events.filter(e => e.service_date.startsWith(year)).length)
  if (totalEl)     totalEl.textContent     = String(events.length)

  const content = shared.tabContent.querySelector<HTMLElement>('#svc-ev-content')!

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

  shared.tabContent.querySelector('#svc-ev-create')?.addEventListener('click', () => _openCreateServiceModal())
}

// ══════════════════════════════════════════════════════
