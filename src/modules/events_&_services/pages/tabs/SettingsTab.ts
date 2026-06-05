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

// TAB: SETTINGS
// ══════════════════════════════════════════════════════

export function _renderSettingsTab(): void {
  if (!shared.tabContent) return

  shared.tabContent.innerHTML = /* html */`
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

  shared.tabContent.querySelector('#svc-set-save')?.addEventListener('click', () => {
    toast('Settings saved.')
  })
}
