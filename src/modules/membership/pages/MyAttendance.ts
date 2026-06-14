// src/modules/membership/pages/MyAttendance.ts
// Member's personal attendance history across services.
// Route: /my-attendance  (auth only, no permission required)

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { renderSkeleton, renderError, renderEmpty } from '@shared/utils/pageHelpers'

// ── Cleanup ───────────────────────────────────────────────────────────────────
const _listeners: [EventTarget, string, EventListener][] = []
function _on<K extends keyof HTMLElementEventMap>(el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}
function _cleanup(): void {
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners.length = 0
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_ID = 'myatt-css'
const CSS = /* css */`
.mya-wrap { padding: 20px 0 64px; display: flex; flex-direction: column; gap: 20px; animation: mya-fade 0.3s ease both; }
@keyframes mya-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Stats */
.mya-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.mya-stat { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 5px; }
.mya-stat-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
.mya-stat-value { font-size: 1.6rem; font-weight: 700; color: var(--text-primary); line-height: 1.1; font-family: var(--font-mono); }
.mya-stat-sub { font-size: 11.5px; color: var(--text-muted); }

/* Rate bar */
.mya-rate-wrap { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.mya-rate-bar { flex: 1; height: 6px; background: var(--bg-page); border-radius: 99px; overflow: hidden; }
.mya-rate-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }

/* Toolbar */
.mya-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mya-search-wrap { position: relative; flex: 1; min-width: 180px; }
.mya-search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; pointer-events: none; }
.mya-search { width: 100%; padding: 8px 12px 8px 34px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; font-size: 13px; color: var(--text-primary); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.mya-search:focus { border-color: var(--caci-blue); }
.mya-select { padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; font-size: 12.5px; color: var(--text-primary); font-family: var(--font-sans); outline: none; cursor: pointer; }
.mya-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* Table */
.mya-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 14px; overflow: hidden; }
.mya-card-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid var(--border-default); background: rgba(0,0,0,0.015); }
[data-theme="dark"] .mya-card-head { background: rgba(255,255,255,0.015); }
.mya-card-title { font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin: 0; }
.mya-table { width: 100%; border-collapse: collapse; }
.mya-table th { padding: 10px 18px; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); border-bottom: 1px solid var(--border-default); white-space: nowrap; }
.mya-table td { padding: 13px 18px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border-default); }
.mya-table tr:last-child td { border-bottom: none; }
.mya-table tr:hover td { background: var(--bg-hover); }

/* Status chips */
.mya-status { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.mya-status.present { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
.mya-status.absent { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
.mya-status.excused { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
.mya-status.late { background: rgba(139,92,246,0.1); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.25); }
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function _fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function _statusIcon(s: string): string {
  if (s === 'present') return 'bi-check-circle-fill'
  if (s === 'absent')  return 'bi-x-circle-fill'
  if (s === 'excused') return 'bi-clock-fill'
  if (s === 'late')    return 'bi-hourglass-split'
  return 'bi-dash-circle'
}
function _rateColor(pct: number): string {
  if (pct >= 75) return '#22c55e'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function _renderRow(r: any): string {
  const status = r.status ?? 'absent'
  return `
    <tr>
      <td>${_fmtDate(r.service_date)}</td>
      <td>
        <div style="font-weight:600;">${r.service_title ?? 'Service'}</div>
        ${r.service_type ? `<div style="font-size:11.5px;color:var(--text-muted);">${r.service_type}</div>` : ''}
      </td>
      <td>${r.venue ?? '—'}</td>
      <td>
        <span class="mya-status ${status}">
          <i class="bi ${_statusIcon(status)}"></i>${status}
        </span>
      </td>
    </tr>
  `
}

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS
      document.head.appendChild(s)
    }

    renderSkeleton(container, 'table')

    try {
      const user = getCurrentUser()
      if (!user) return

      const { data: m, error: mErr } = await supabase
        .from('members_view')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (mErr) throw mErr
      if (!m) {
        return renderEmpty(container, {
          icon: 'person-exclamation',
          title: 'No member record',
          message: 'Your account is not linked to a member profile yet.',
        })
      }

      // Fetch attendance joined with services
      const { data: raw, error: attErr } = await supabase
        .from('service_attendance')
        .select(`
          id, status,
          service:services(id, title, service_date, service_type, venue)
        `)
        .eq('member_id', m.id!)
        .is('deleted_at', null)
        .order('marked_at', { ascending: false })
      if (attErr) throw attErr

      const all = (raw ?? [])
        .filter((r: any) => r.service)
        .map((r: any) => ({
          id:           r.id,
          status:       r.status,
          service_date: r.service.service_date,
          service_title:r.service.title,
          service_type: r.service.service_type,
          venue:        r.service.venue,
        }))
        .sort((a: any, b: any) => (b.service_date || '').localeCompare(a.service_date || ''))

      if (all.length === 0) {
        return renderEmpty(container, {
          icon: 'calendar-x',
          title: 'No attendance records',
          message: 'Your service attendance will appear here once it is recorded.',
        })
      }

      // Compute stats
      const total    = all.length
      const present  = all.filter((r: any) => r.status === 'present').length
      const rate     = Math.round((present / total) * 100)
      const rateCol  = _rateColor(rate)
      const thisYear = all.filter((r: any) => new Date(r.service_date).getFullYear() === new Date().getFullYear())
      const yearPresent = thisYear.filter((r: any) => r.status === 'present').length

      container.innerHTML = `
        <div class="mya-wrap">
          <!-- Stats -->
          <div class="mya-stats">
            <div class="mya-stat">
              <div class="mya-stat-label">Attendance Rate</div>
              <div class="mya-stat-value" style="color:${rateCol};">${rate}%</div>
              <div class="mya-rate-wrap">
                <div class="mya-rate-bar"><div class="mya-rate-fill" style="width:${rate}%;background:${rateCol};"></div></div>
                <span class="mya-stat-sub">${present}/${total}</span>
              </div>
            </div>
            <div class="mya-stat">
              <div class="mya-stat-label">Total Services</div>
              <div class="mya-stat-value">${total}</div>
              <div class="mya-stat-sub">all time</div>
            </div>
            <div class="mya-stat">
              <div class="mya-stat-label">This Year</div>
              <div class="mya-stat-value">${yearPresent}</div>
              <div class="mya-stat-sub">of ${thisYear.length} services</div>
            </div>
            <div class="mya-stat">
              <div class="mya-stat-label">Last Attended</div>
              <div class="mya-stat-value" style="font-size:1rem;">${all.find((r: any) => r.status === 'present') ? _fmtDate(all.find((r: any) => r.status === 'present')!.service_date) : '—'}</div>
              <div class="mya-stat-sub">${all.find((r: any) => r.status === 'present')?.service_type ?? ''}</div>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="mya-toolbar">
            <div class="mya-search-wrap">
              <i class="bi bi-search"></i>
              <input class="mya-search" id="mya-search" type="search" placeholder="Search service name…">
            </div>
            <select class="mya-select" id="mya-status-filter">
              <option value="">All statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
              <option value="late">Late</option>
            </select>
            <span class="mya-count" id="mya-count">${total} records</span>
          </div>

          <!-- Table -->
          <div class="mya-card">
            <div class="mya-card-head">
              <h2 class="mya-card-title">Attendance History</h2>
            </div>
            <div style="overflow-x:auto;">
              <table class="mya-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Venue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="mya-tbody">
                  ${all.map(_renderRow).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'My Attendance' }])
      _wireFilters(container, all)

    } catch (err) {
      console.error('[MyAttendance] load error:', err)
      renderError(container, err, { retry: () => this.render(container) })
    }
  },

  destroy() { _cleanup() },
} satisfies PageModule

function _wireFilters(container: HTMLElement, all: any[]): void {
  let q = '', status = ''

  function apply(): void {
    const tbody   = container.querySelector<HTMLElement>('#mya-tbody')
    const countEl = container.querySelector<HTMLElement>('#mya-count')
    if (!tbody) return
    const filtered = all.filter(r => {
      if (status && r.status !== status) return false
      if (q && !r.service_title?.toLowerCase().includes(q) && !r.service_type?.toLowerCase().includes(q)) return false
      return true
    })
    tbody.innerHTML = filtered.length > 0 ? filtered.map(_renderRow).join('') : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No matching records.</td></tr>`
    if (countEl) countEl.textContent = `${filtered.length} records`
  }

  const searchEl = container.querySelector<HTMLInputElement>('#mya-search')
  _on(searchEl, 'input', e => { q = (e.target as HTMLInputElement).value.toLowerCase().trim(); apply() })

  const statusEl = container.querySelector<HTMLSelectElement>('#mya-status-filter')
  _on(statusEl, 'change', e => { status = (e.target as HTMLSelectElement).value; apply() })
}
