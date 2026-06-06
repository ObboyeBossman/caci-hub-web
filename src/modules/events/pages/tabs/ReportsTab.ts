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

// TAB: REPORTS
// ══════════════════════════════════════════════════════

export function _renderReportsTab(): void {
  injectReportsCSS()
  if (!shared.tabContent) return

  shared.tabContent.innerHTML = /* html */`
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
        `<button class="svc-chip-btn${state.reportRange === k ? ' active' : ''}" data-range="${k}">${l}</button>`
      ).join('')}
    </div>

    <!-- Charts row -->
    <div class="svc-rep-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg);">
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

  shared.tabContent.querySelectorAll<HTMLElement>('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.reportRange = btn.dataset['range'] as any
      shared.tabContent?.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      _renderReportsData()
    })
  })

  _renderReportsData()
}

export function _renderReportsData(): void {
  if (!shared.tabContent) return
  const services = state.services

  // Stat computations
  const total       = services.length
  const completed   = services.filter(s => s.status === 'completed')
  const avgAtt      = completed.length > 0
    ? Math.round(completed.reduce((a, s) => a + s.present_count, 0) / completed.length)
    : 0
  const rate        = total > 0 ? Math.round(completed.length / total * 100) : 0
  const bestSvc     = [...completed].sort((a, b) => b.present_count - a.present_count)[0]

  const avgEl  = shared.tabContent.querySelector('#svc-rep-avg-att')
  const bestEl = shared.tabContent.querySelector('#svc-rep-best')
  const totEl  = shared.tabContent.querySelector('#svc-rep-total')
  const rateEl = shared.tabContent.querySelector('#svc-rep-rate')

  if (avgEl)  avgEl.textContent  = String(avgAtt)
  if (bestEl) bestEl.textContent = bestSvc ? `${bestSvc.present_count} (${bestSvc.title.substring(0, 18)})` : '—'
  if (totEl)  totEl.textContent  = String(total)
  if (rateEl) rateEl.textContent = `${rate}%`

  // Attendance trend bar chart (CSS-only, no canvas library required)
  const trendEl = shared.tabContent.querySelector<HTMLElement>('#svc-chart-trend')
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
  const typeEl = shared.tabContent.querySelector<HTMLElement>('#svc-chart-type')
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
  const perfEl = shared.tabContent.querySelector<HTMLElement>('#svc-rep-perf-table')
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
  const absEl    = shared.tabContent.querySelector<HTMLElement>('#svc-rep-abs-list')
  const threshold = parseInt((shared.tabContent.querySelector<HTMLSelectElement>('#svc-rep-abs-threshold')?.value ?? '3'))
  if (absEl) _renderAbsenceList(absEl, threshold)

  shared.tabContent.querySelector('#svc-rep-abs-threshold')?.addEventListener('change', e => {
    const t  = parseInt((e.target as HTMLSelectElement).value)
    if (absEl) _renderAbsenceList(absEl, t)
  })
}

export function _renderAbsenceList(container: HTMLElement, threshold: number): void {
  const absentMap = new Map<string, { name: string; count: number }>()
  state.services.forEach(s => {
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

const _TAB_CSS = `
/* ── Reports chart placeholder ── */
.svc-chart-wrap {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: 18px; overflow: hidden;
}
.svc-chart-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 14px;
}
.svc-chart-canvas-wrap {
  position: relative; width: 100%; height: 200px;
}

@media (max-width: 640px) {
  .svc-rep-grid { grid-template-columns: 1fr !important; }
}

`;
export function injectReportsCSS() {
  if (document.getElementById('css-injectReportsCSS')) return;
  const s = document.createElement('style');
  s.id = 'css-injectReportsCSS';
  s.textContent = _TAB_CSS;
  document.head.appendChild(s);
}
