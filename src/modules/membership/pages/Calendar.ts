// src/modules/membership/pages/Calendar.ts
// Member's view of upcoming services and events for their assembly
// Route: /calendar  (auth only, no permission required)

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
const CSS_ID = 'cal-css'
const CSS = /* css */`
.cal-wrap { padding: 20px 0 64px; display: flex; flex-direction: column; gap: 20px; animation: cal-fade 0.3s ease both; }
@keyframes cal-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Toolbar */
.cal-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cal-search-wrap { position: relative; flex: 1; min-width: 180px; }
.cal-search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; pointer-events: none; }
.cal-search { width: 100%; padding: 8px 12px 8px 34px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; font-size: 13px; color: var(--text-primary); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.cal-search:focus { border-color: var(--caci-blue); }
.cal-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* Timeline List */
.cal-list { display: flex; flex-direction: column; gap: 12px; }

.cal-item {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 14px; overflow: hidden; padding: 16px;
  display: flex; gap: 16px; transition: box-shadow 0.18s;
}
.cal-item:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-color: var(--border-strong); }

.cal-date-block {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,75,160,0.08); color: var(--caci-blue);
  width: 60px; height: 60px; border-radius: 12px; flex-shrink: 0;
}
.cal-date-mon { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; line-height: 1; }
.cal-date-day { font-size: 24px; font-weight: 700; line-height: 1.1; margin-top: 2px; }

.cal-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.cal-item-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cal-meta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.cal-meta { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-secondary); }
.cal-meta i { font-size: 13px; color: var(--text-muted); }

/* Badges */
.cal-today-badge { margin-left: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: rgba(34,197,94,0.1); color: #22c55e; padding: 2px 8px; border-radius: 99px; }
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function _fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function _renderItem(s: any): string {
  const d = new Date(s.service_date + 'T00:00:00')
  const mon = d.toLocaleDateString('en-GB', { month: 'short' })
  const day = d.getDate()
  const today = new Date().toISOString().split('T')[0]
  const isToday = s.service_date === today

  return `
    <div class="cal-item">
      <div class="cal-date-block">
        <div class="cal-date-mon">${mon}</div>
        <div class="cal-date-day">${day}</div>
      </div>
      <div class="cal-item-main">
        <h3 class="cal-item-title">${s.title} ${isToday ? '<span class="cal-today-badge">Today</span>' : ''}</h3>
        <div class="cal-meta-row">
          ${s.start_time ? `<span class="cal-meta"><i class="bi bi-clock"></i>${_fmtTime(s.start_time)}</span>` : ''}
          ${s.venue ? `<span class="cal-meta"><i class="bi bi-geo-alt"></i>${s.venue}</span>` : ''}
          ${s.service_type ? `<span class="cal-meta"><i class="bi bi-tag"></i>${s.service_type}</span>` : ''}
        </div>
      </div>
    </div>
  `
}

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS
      document.head.appendChild(s)
    }

    renderSkeleton(container, 'card')

    try {
      const user = getCurrentUser()
      if (!user) return

      const { data: m, error: mErr } = await supabase
        .from('members_view')
        .select('assembly_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (mErr) throw mErr

      if (!m?.assembly_id) {
        return renderEmpty(container, {
          icon: 'person-exclamation',
          title: 'No member record',
          message: 'Your account is not linked to a member profile yet.',
        })
      }

      // Fetch upcoming services (today onwards)
      const today = new Date().toISOString().split('T')[0]
      const { data: raw, error: svcErr } = await supabase
        .from('services')
        .select('id, title, service_date, start_time, venue, service_type')
        .eq('assembly_id', m.assembly_id)
        .is('deleted_at', null)
        .gte('service_date', today)
        .order('service_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(30)

      if (svcErr) throw svcErr

      const all = raw ?? []

      if (all.length === 0) {
        container.innerHTML = `<div class="cal-wrap">${_toolbar(0)}<div class="cal-list" id="cal-list"></div></div>`
        renderBreadcrumbs(container, [{ label: 'Church Calendar' }])
        _wire(container, [])
        return
      }

      container.innerHTML = `
        <div class="cal-wrap">
          ${_toolbar(all.length)}
          <div class="cal-list" id="cal-list">
            ${all.map(_renderItem).join('')}
          </div>
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'Church Calendar' }])
      _wire(container, all)

    } catch (err) {
      console.error('[Calendar] load error:', err)
      renderError(container, err, { retry: () => this.render(container) })
    }
  },

  destroy() { _cleanup() },
} satisfies PageModule

function _toolbar(count: number): string {
  return `
    <div class="cal-toolbar">
      <div class="cal-search-wrap">
        <i class="bi bi-search"></i>
        <input class="cal-search" id="cal-search" type="search" placeholder="Search events…">
      </div>
      <span class="cal-count" id="cal-count">${count} upcoming event${count !== 1 ? 's' : ''}</span>
    </div>
  `
}

function _wire(container: HTMLElement, all: any[]): void {
  function apply(q: string): void {
    const list = container.querySelector<HTMLElement>('#cal-list')
    const countEl = container.querySelector<HTMLElement>('#cal-count')
    if (!list) return
    const filtered = all.filter(s => !q || s.title.toLowerCase().includes(q) || s.service_type?.toLowerCase().includes(q))
    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:13px;background:var(--bg-card);border:1px dashed var(--border-default);border-radius:14px;">
          <i class="bi bi-calendar-x" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.4;"></i>
          ${all.length === 0 ? 'No upcoming events scheduled.' : 'No events match your search.'}
        </div>`
    } else {
      list.innerHTML = filtered.map(_renderItem).join('')
    }
    if (countEl) countEl.textContent = `${filtered.length} upcoming event${filtered.length !== 1 ? 's' : ''}`
  }

  const searchEl = container.querySelector<HTMLInputElement>('#cal-search')
  _on(searchEl, 'input', e => apply((e.target as HTMLInputElement).value.toLowerCase().trim()))
  if (all.length === 0) apply('')
}
