// src/modules/membership/pages/Announcements.ts
// Member-facing announcements board for the assembly.
// Route: /announcements  (auth only, no permission required)

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { renderSkeleton, renderError, renderEmpty } from '@shared/utils/pageHelpers'

// ─── Listener cleanup ──────────────────────────────────────────────────────────
import '../../communication/widgets/AudioPlayer'

const _listeners: [EventTarget, string, EventListener][] = []

function _on<K extends keyof HTMLElementEventMap>(
  el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}

function _cleanup(): void {
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners.length = 0
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_ID = 'ann-page-css'
const CSS = /* css */`
.ann-wrap {
  padding: 20px 0 64px;
  display: flex; flex-direction: column; gap: 20px;
  animation: ann-fade 0.3s ease both;
}
@keyframes ann-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ann-toolbar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.ann-search-wrap {
  position: relative; flex: 1; min-width: 200px;
}
.ann-search-wrap i {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); font-size: 14px; pointer-events: none;
}
.ann-search {
  width: 100%; padding: 9px 12px 9px 36px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 10px; font-size: 13.5px; color: var(--text-primary);
  font-family: var(--font-sans); outline: none; transition: border-color 0.15s;
  box-sizing: border-box;
}
.ann-search:focus { border-color: var(--caci-blue); }

.ann-filter-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 38px; border-radius: 10px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  font-family: var(--font-sans); transition: all 0.15s; white-space: nowrap;
}
.ann-filter-btn:hover,
.ann-filter-btn.active { border-color: var(--caci-blue); color: var(--caci-blue); background: var(--bg-info); }

.ann-count {
  font-size: 12px; color: var(--text-muted); white-space: nowrap;
  align-self: center;
}

/* List */
.ann-list { display: flex; flex-direction: column; gap: 12px; }

.ann-item {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 14px; overflow: hidden; cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.ann-item:hover { border-color: var(--border-strong); box-shadow: 0 4px 14px rgba(0,0,0,0.07); }
.ann-item.pinned { border-left: 3px solid #ef4444; }

.ann-item-head {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 16px 18px;
}
.ann-item-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.ann-item-main { flex: 1; min-width: 0; }
.ann-item-title {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin: 0 0 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ann-item-body {
  font-size: 13px; color: var(--text-secondary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}
.ann-item-body.expanded {
  display: block; -webkit-line-clamp: unset;
}
.ann-item-meta {
  display: flex; align-items: center; gap: 14px; margin-top: 8px; flex-wrap: wrap;
}
.ann-meta-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--text-muted);
}
.ann-item-chevron {
  color: var(--text-muted); font-size: 14px; flex-shrink: 0;
  transition: transform 0.2s; align-self: center;
}
.ann-item.open .ann-item-chevron { transform: rotate(180deg); }

/* Badges */
.ann-pin-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  background: rgba(239,68,68,0.1); color: #ef4444;
  border: 1px solid rgba(239,68,68,0.25);
}
.ann-new-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  background: rgba(34,197,94,0.1); color: #22c55e;
  border: 1px solid rgba(34,197,94,0.25);
}
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function _fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function _isNew(createdAt: string): boolean {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return new Date(createdAt).getTime() > sevenDaysAgo
}

function _isVisible(a: any): boolean {
  const now = new Date()
  if (a.visible_from && new Date(a.visible_from) > now) return false
  if (a.visible_until && new Date(a.visible_until) < now) return false
  return true
}

function _renderItem(a: any): string {
  if (a.type === 'audio') {
    const attachment = a.attachment && a.attachment.length > 0 ? a.attachment[0] : null
    
    if (!attachment) {
       return `<div class="ann-item" data-id="${a.id}">
                 <div class="ann-item-head">
                   <div class="ann-item-icon" style="background:rgba(198,0,38,0.1);"><i class="bi bi-mic-fill" style="color:var(--caci-red);"></i></div>
                   <div class="ann-item-main">
                     <div class="ann-item-title">${a.title ?? 'Audio Broadcast'}</div>
                     <p class="ann-item-body"><i class="bi bi-exclamation-circle text-orange-500"></i> Audio attachment not found</p>
                   </div>
                 </div>
               </div>`
    }

    return `
      <div class="ann-item" data-id="${a.id}">
        <div class="ann-item-head" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div class="ann-item-icon" style="background:rgba(198,0,38,0.1);">
              <i class="bi bi-mic-fill" style="color:var(--caci-red);"></i>
            </div>
            <div class="ann-item-main">
              <div class="ann-item-title">
                ${a.title ?? 'Audio Broadcast'}
                <span class="ann-new-badge" style="background:rgba(198,0,38,0.1);color:var(--caci-red);border-color:rgba(198,0,38,0.25);">
                  <i class="bi bi-broadcast"></i>Broadcast
                </span>
              </div>
              <div class="ann-item-meta" style="margin-top:2px;">
                <span class="ann-meta-chip"><i class="bi bi-calendar3"></i>${_fmtDate(a.created_at ?? '')}</span>
              </div>
            </div>
          </div>
          <div class="ann-item-audio-wrap" style="margin-top:12px;" onclick="event.stopPropagation()">
            <audio-player
              attachment-id="${attachment.id}"
              duration-seconds="${attachment.duration_seconds}"
              waveform-data="${(attachment.waveform_data ? JSON.stringify(attachment.waveform_data) : '[]').replace(/"/g, '&quot;')}"
            ></audio-player>
          </div>
        </div>
      </div>
    `
  }

  const pinned = !!a.is_pinned
  const isNew  = _isNew(a.created_at ?? '')
  const iconBg = pinned ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)'
  const iconColor = pinned ? '#ef4444' : '#8b5cf6'
  const icon  = pinned ? 'bi-pin-angle-fill' : 'bi-megaphone-fill'

  return `
    <div class="ann-item${pinned ? ' pinned' : ''}" data-id="${a.id}">
      <div class="ann-item-head">
        <div class="ann-item-icon" style="background:${iconBg};">
          <i class="bi ${icon}" style="color:${iconColor};"></i>
        </div>
        <div class="ann-item-main">
          <div class="ann-item-title">
            ${a.title}
            ${pinned ? '<span class="ann-pin-badge"><i class="bi bi-pin-angle-fill"></i>Pinned</span>' : ''}
            ${isNew  ? '<span class="ann-new-badge"><i class="bi bi-stars"></i>New</span>' : ''}
          </div>
          <p class="ann-item-body">${a.body ?? ''}</p>
          <div class="ann-item-meta">
            <span class="ann-meta-chip"><i class="bi bi-calendar3"></i>${_fmtDate(a.created_at ?? '')}</span>
            ${a.visible_until ? `<span class="ann-meta-chip"><i class="bi bi-clock"></i>Expires ${_fmtDate(a.visible_until)}</span>` : ''}
          </div>
        </div>
        <i class="bi bi-chevron-down ann-item-chevron"></i>
      </div>
    </div>
  `
}

// ── Module ────────────────────────────────────────────────────────────────────

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style')
      s.id = CSS_ID; s.textContent = CSS
      document.head.appendChild(s)
    }

    renderSkeleton(container, 'card')

    try {
      const user = getCurrentUser()
      if (!user) return

      // Get member's assembly
      const { data: m, error: mErr } = await supabase
        .from('members_view')
        .select('assembly_id, id')
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

      // Fetch active announcements AND audio broadcasts concurrently
      const [annRes, audioRes] = await Promise.all([
        supabase
          .from('announcement_posts')
          .select('id, title, body, created_at, is_pinned, visible_from, visible_until')
          .eq('assembly_id', m.assembly_id)
          .is('deleted_at', null)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('communication_campaigns')
          .select('id, title, created_at, attachments:communication_attachments(id, duration_seconds, waveform_data)')
          .eq('assembly_id', m.assembly_id)
          .eq('channel', 'audio')
          .is('deleted_at', null)
      ])

      if (annRes.error) throw annRes.error
      if (audioRes.error) throw audioRes.error

      const announcements = (annRes.data ?? []).filter(_isVisible).map(a => ({ ...a, type: 'announcement' }))
      
      // Remap the nested attachments to the top level for rendering
      const broadcasts = (audioRes.data ?? []).map((b: any) => ({ 
        ...b, 
        type: 'audio', 
        is_pinned: false,
        attachment: b.attachments 
      }))
      
      // Merge and sort: pinned first, then by date descending
      const all = [...announcements, ...broadcasts].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      if (all.length === 0) {
        container.innerHTML = `<div class="ann-wrap">${_toolbar(0)}</div>`
        renderBreadcrumbs(container, [{ label: 'Announcements' }])
        // wire search regardless (shows empty msg via filter below)
        _wire(container, all)
        return
      }

      container.innerHTML = `
        <div class="ann-wrap">
          ${_toolbar(all.length)}
          <div class="ann-list" id="ann-list">
            ${all.map(_renderItem).join('')}
          </div>
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'Announcements' }])
      _wire(container, all)

    } catch (err) {
      console.error('[Announcements] load error:', err)
      renderError(container, err, { retry: () => this.render(container) })
    }
  },

  destroy() { _cleanup() },
} satisfies PageModule

function _toolbar(count: number): string {
  return `
    <div class="ann-toolbar">
      <div class="ann-search-wrap">
        <i class="bi bi-search"></i>
        <input class="ann-search" id="ann-search" type="search" placeholder="Search announcements…">
      </div>
      <button class="ann-filter-btn active" id="ann-filter-all">All</button>
      <button class="ann-filter-btn" id="ann-filter-pinned"><i class="bi bi-pin-angle-fill"></i> Pinned</button>
      <span class="ann-count" id="ann-count">${count} announcement${count !== 1 ? 's' : ''}</span>
    </div>
  `
}

function _wire(container: HTMLElement, all: any[]): void {
  let showPinnedOnly = false
  let searchQuery = ''

  function _apply(): void {
    const list = container.querySelector<HTMLElement>('#ann-list')
    const countEl = container.querySelector<HTMLElement>('#ann-count')
    if (!list) return

    const filtered = all.filter(a => {
      if (showPinnedOnly && !a.is_pinned) return false
      if (searchQuery) {
        const q = searchQuery
        if (a.type === 'audio') {
          return a.campaign?.title?.toLowerCase().includes(q)
        } else {
          return a.title?.toLowerCase().includes(q) || a.body?.toLowerCase().includes(q)
        }
      }
      return true
    })

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:13px;">
          <i class="bi bi-search" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.4;"></i>
          No announcements match your search.
        </div>`
    } else {
      list.innerHTML = filtered.map(_renderItem).join('')
      _wireItems(list, all)
    }
    if (countEl) countEl.textContent = `${filtered.length} announcement${filtered.length !== 1 ? 's' : ''}`
  }

  function _wireItems(list: HTMLElement, _rows: any[]): void {
    list.querySelectorAll<HTMLElement>('.ann-item').forEach(item => {
      _on(item, 'click', () => {
        const body = item.querySelector<HTMLElement>('.ann-item-body')
        if (body) body.classList.toggle('expanded')
        item.classList.toggle('open')
      })
    })
  }

  // Wire search
  const searchEl = container.querySelector<HTMLInputElement>('#ann-search')
  _on(searchEl, 'input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim()
    _apply()
  })

  // Wire filter buttons
  const btnAll    = container.querySelector<HTMLElement>('#ann-filter-all')
  const btnPinned = container.querySelector<HTMLElement>('#ann-filter-pinned')
  _on(btnAll, 'click', () => {
    showPinnedOnly = false
    btnAll?.classList.add('active')
    btnPinned?.classList.remove('active')
    _apply()
  })
  _on(btnPinned, 'click', () => {
    showPinnedOnly = true
    btnPinned?.classList.add('active')
    btnAll?.classList.remove('active')
    _apply()
  })

  // Wire initial items
  const list = container.querySelector<HTMLElement>('#ann-list')
  if (list) _wireItems(list, all)
}
