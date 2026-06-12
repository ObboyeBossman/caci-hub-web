// src/modules/communication/tabs/AnnouncementsTab.ts

import type { WorkspaceTab }  from '../workspace/CommunicationWorkspaceShell'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }                from '@core/authorization/authorization-service'
import { Toolbar, ContextMenu, openModal, showToast } from '../widgets/communicationWidgets'
import { CommunicationService } from '../services/communication.service'
import { on, off, emit }        from '@core/events'
import type { Announcement }    from '../schemas/communication'

// ─── CSS ─────────────────────────────────────────────────────────────────────

const ANN_CSS = /* css */`
.ann-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-lg);
  margin-bottom: var(--space-md); transition: border-color 0.18s;
  display: flex; flex-direction: column; gap: var(--space-sm);
}
.ann-card:hover { border-color: var(--border-strong); }
.ann-card.pinned {
  border-left: 3px solid var(--caci-blue-light);
}
.ann-card-top {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-md);
}
.ann-card-title {
  font-size: 15px; font-weight: 600; color: var(--text-primary);
  margin: 0; flex: 1;
}
.ann-pin-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 700;
  background: rgba(0,75,160,0.1); color: var(--caci-blue-light);
  flex-shrink: 0;
}
.ann-card-meta {
  font-size: 11px; color: var(--text-muted);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ann-card-body {
  font-size: 13px; color: var(--text-secondary); line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.ann-status-active   { color: #22c55e; }
.ann-status-expired  { color: var(--text-muted); }
.ann-status-upcoming { color: #e3b341; }
`

let _annCSSInjected = false
function _injectCSS(): void {
  if (_annCSSInjected) return; _annCSSInjected = true
  const s = document.createElement('style'); s.id = 'ann-tab-css'; s.textContent = ANN_CSS
  document.head.appendChild(s)
}

function _fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function _statusBadge(a: Announcement): string {
  const now  = Date.now()
  const from = new Date(a.visible_from).getTime()
  const until = a.visible_until ? new Date(a.visible_until).getTime() : null

  if (from > now)   return `<span class="ann-status-upcoming">● Upcoming</span>`
  if (until && until < now) return `<span class="ann-status-expired">● Expired</span>`
  return `<span class="ann-status-active">● Active</span>`
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class AnnouncementsTab implements WorkspaceTab {
  readonly id         = 'announcements'
  readonly label      = 'Announcements'
  readonly icon       = 'bullhorn-fill'
  readonly permission = 'communications.announcements.manage'

  private _container:    HTMLElement | null   = null
  private _announcements: Announcement[]      = []
  private _filtered:     Announcement[]       = []
  private _toolbar:      Toolbar | null       = null
  private _ctxMenu       = new ContextMenu()
  private _destroyed     = false
  private _mutateSub:    ((...args: any[]) => void) | null = null
  private _state         = { search: '' }

  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    this._container = container
    this._destroyed  = false

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">No assembly selected.</div>`
      return
    }

    container.innerHTML = `
      <div id="ann-toolbar-wrap" style="margin-bottom:var(--space-md);"></div>
      <div id="ann-list-wrap"><div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div></div>`

    await this._reload()

    this._mutateSub = () => this._reload()
    on('communication:announcement_mutated', this._mutateSub)
  }

  private async _reload(preserveScroll = false): Promise<void> {
    if (this._destroyed || !this._container) return
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return

    const scrollY = preserveScroll ? window.scrollY : 0
    const listWrap = this._container.querySelector('#ann-list-wrap')
    if (listWrap && !preserveScroll) {
      listWrap.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`
    }

    try {
      // Fetch ALL announcements for admin view (including expired)
      const { data, error } = await (await import('@core/supabase')).supabase
        .from('announcement_posts')
        .select('*')
        .eq('assembly_id', assemblyId)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      this._announcements = (data ?? []) as Announcement[]
    } catch (err: any) {
      if (listWrap) listWrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--caci-red);">Failed to load. ${err?.message ?? ''}</div>`
      return
    }

    if (this._destroyed) return
    this._applyFilters()
    this._renderToolbar()
    this._renderList()
    if (preserveScroll) requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }

  private _applyFilters(): void {
    const q = this._state.search.toLowerCase()
    this._filtered = this._announcements
      .filter(a => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
  }

  private _renderToolbar(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#ann-toolbar-wrap')
    if (!wrap) return
    wrap.innerHTML = ''

    const user      = getCurrentUser()
    const canManage = user ? can(user, 'communications.announcements.manage' as any) : false

    this._toolbar = new Toolbar(wrap, {
      searchPlaceholder: 'Search announcements…',
      filters: [],
      actions: canManage ? [
        { id: 'new', label: 'New Announcement', icon: 'plus-lg', variant: 'primary', onClick: () => this._openCreateModal() },
      ] : [],
      onSearch: (q) => { this._state.search = q; this._applyFilters(); this._renderList() },
    })
  }

  private _renderList(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#ann-list-wrap')
    if (!wrap) return

    const user      = getCurrentUser()
    const canManage = user ? can(user, 'communications.announcements.manage' as any) : false

    if (!this._filtered.length) {
      wrap.innerHTML = `
        <div class="cw-empty">
          <div class="cw-empty-icon-wrap"><i class="bi bi-bullhorn"></i></div>
          <p class="cw-empty-title">No announcements found</p>
          <p class="cw-empty-desc">${this._state.search ? 'Try adjusting your search.' : 'Create the first announcement for your assembly.'}</p>
        </div>`
      return
    }

    wrap.innerHTML = this._filtered.map(a => `
      <div class="ann-card ${a.is_pinned ? 'pinned' : ''}">
        <div class="ann-card-top">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;">
            <h3 class="ann-card-title">${a.title}</h3>
            ${a.is_pinned ? '<span class="ann-pin-badge"><i class="bi bi-pin-fill"></i> Pinned</span>' : ''}
          </div>
          ${canManage ? `<button class="cw-tbtn" style="height:28px;padding:0 8px;border:none;flex-shrink:0;" data-ann-ctx="${a.id}">
            <i class="bi bi-three-dots-vertical" style="font-size:13px;"></i>
          </button>` : ''}
        </div>
        <div class="ann-card-meta">
          ${_statusBadge(a)}
          <span>${_fmtDate(a.visible_from)}</span>
          ${a.visible_until ? `<span>→ ${_fmtDate(a.visible_until)}</span>` : '<span>No expiry</span>'}
          ${(a.target_group_ids ?? []).length ? `<span>· ${a.target_group_ids.length} group(s)</span>` : '<span>· All members</span>'}
        </div>
        <div class="ann-card-body">${a.body}</div>
      </div>`).join('')

    if (canManage) {
      wrap.querySelectorAll<HTMLButtonElement>('[data-ann-ctx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const a = this._announcements.find(x => x.id === btn.dataset['annCtx'])
          if (a) this._showCtxMenu(btn, a)
        })
      })
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  private _showCtxMenu(btn: HTMLButtonElement, a: Announcement): void {
    this._ctxMenu.show(btn.getBoundingClientRect(), [
      {
        id: 'edit', label: 'Edit', icon: 'pencil-square',
        onClick: () => this._openEditModal(a),
      },
      {
        id: 'pin', icon: a.is_pinned ? 'pin-angle' : 'pin-angle-fill',
        label: a.is_pinned ? 'Unpin' : 'Pin to Top',
        onClick: () => this._togglePin(a),
      },
      {
        id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger' as const, divider: true,
        onClick: () => this._confirmDelete(a),
      },
    ])
  }

  private async _togglePin(a: Announcement): Promise<void> {
    try {
      await CommunicationService.updateAnnouncement(a.id, { is_pinned: !a.is_pinned })
      showToast(a.is_pinned ? 'Announcement unpinned' : 'Announcement pinned to top', 'success')
      emit('communication:announcement_mutated')
    } catch (err: any) {
      showToast(err?.message ?? 'Update failed', 'danger')
    }
  }

  private _confirmDelete(a: Announcement): void {
    const close = openModal({
      title:     'Delete Announcement',
      subtitle:  'This cannot be undone.',
      icon:      'trash-fill',
      iconBg:    'rgba(198,0,38,0.1)',
      iconColor: 'var(--caci-red)',
      body: `<p style="font-size:13px;color:var(--text-secondary);margin:0;">
        Delete <strong style="color:var(--text-primary);">${a.title}</strong>?
        Members who haven't seen it yet will no longer see it.
      </p>`,
      footer: `
        <button class="cw-tbtn" id="adel-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-danger" id="adel-confirm">
          <i class="bi bi-trash"></i>&nbsp;Delete
        </button>`,
    })
    document.getElementById('adel-cancel')?.addEventListener('click', close)
    document.getElementById('adel-confirm')?.addEventListener('click', async () => {
      close()
      try {
        await CommunicationService.deleteAnnouncement(a.id)
        showToast('Announcement deleted', 'success')
        emit('communication:announcement_mutated')
      } catch (err: any) {
        showToast(err?.message ?? 'Delete failed', 'danger')
      }
    })
  }

  // ── Create modal ──────────────────────────────────────────────────────────

  private _openCreateModal(): void {
    const close = openModal({
      title:     'New Announcement',
      subtitle:  'Notify your assembly of important updates',
      icon:      'bullhorn-fill',
      iconBg:    'rgba(34,197,94,0.1)',
      iconColor: '#22c55e',
      body: `
        <div class="cw-form-group">
          <label class="cw-form-label">Title *</label>
          <input type="text" class="cw-form-inp" id="anew-title"
            placeholder="e.g. Mid-Week Service Change" maxlength="120" autocomplete="off">
          <span class="cw-form-error" id="anew-title-err">Title is required</span>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Message *</label>
          <textarea class="cw-form-inp" id="anew-body" rows="5"
            placeholder="Write the announcement details here…" style="resize:vertical;"></textarea>
          <span class="cw-form-error" id="anew-body-err">Message is required</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="cw-form-group">
            <label class="cw-form-label">Visible From</label>
            <input type="datetime-local" class="cw-form-inp" id="anew-from">
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Expires (optional)</label>
            <input type="datetime-local" class="cw-form-inp" id="anew-until">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="anew-pinned" class="cw-chk">
          <label for="anew-pinned" style="font-size:13px;color:var(--text-primary);cursor:pointer;user-select:none;">
            Pin this announcement to the top
          </label>
        </div>`,
      footer: `
        <button class="cw-tbtn" id="anew-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="anew-submit">
          <i class="bi bi-megaphone-fill"></i>&nbsp;Post Announcement
        </button>`,
      onClose: () => {},
    })

    // Set default visible_from to now
    const fromInput = document.getElementById('anew-from') as HTMLInputElement
    if (fromInput) fromInput.value = new Date().toISOString().slice(0, 16)

    document.getElementById('anew-cancel')?.addEventListener('click', close)
    document.getElementById('anew-submit')?.addEventListener('click', async () => {
      const title   = (document.getElementById('anew-title')  as HTMLInputElement)?.value.trim()
      const body    = (document.getElementById('anew-body')   as HTMLTextAreaElement)?.value.trim()
      const from    = (document.getElementById('anew-from')   as HTMLInputElement)?.value
      const until   = (document.getElementById('anew-until')  as HTMLInputElement)?.value
      const pinned  = (document.getElementById('anew-pinned') as HTMLInputElement)?.checked

      let valid = true
      if (!title) { document.getElementById('anew-title-err')?.classList.add('show'); valid = false }
      else          document.getElementById('anew-title-err')?.classList.remove('show')
      if (!body)  { document.getElementById('anew-body-err')?.classList.add('show');  valid = false }
      else          document.getElementById('anew-body-err')?.classList.remove('show')
      if (!valid) return

      const btn = document.getElementById('anew-submit') as HTMLButtonElement
      btn.disabled  = true
      btn.innerHTML = '<span class="cw-spinner"></span>&nbsp;Posting…'

      const assemblyId = getActiveAssemblyId()
      if (!assemblyId) { showToast('No assembly selected', 'danger'); return }

      try {
        await CommunicationService.createAnnouncement({
          assembly_id:   assemblyId,
          title,
          body,
          is_pinned:     pinned,
          visible_from:  from ? new Date(from).toISOString() : new Date().toISOString(),
          visible_until: until ? new Date(until).toISOString() : undefined,
          target_group_ids: [],
        } as any)
        showToast('Announcement posted', 'success')
        emit('communication:announcement_mutated')
        close()
      } catch (err: any) {
        showToast(err?.message ?? 'Failed to post announcement', 'danger')
        btn.disabled  = false
        btn.innerHTML = '<i class="bi bi-megaphone-fill"></i>&nbsp;Post Announcement'
      }
    })
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  private _openEditModal(a: Announcement): void {
    const close = openModal({
      title:     'Edit Announcement',
      subtitle:  'Update the announcement details',
      icon:      'pencil-square',
      iconBg:    'rgba(0,75,160,0.12)',
      iconColor: 'var(--caci-blue-light)',
      body: `
        <div class="cw-form-group">
          <label class="cw-form-label">Title *</label>
          <input type="text" class="cw-form-inp" id="aedit-title"
            value="${a.title.replace(/"/g, '&quot;')}" maxlength="120" autocomplete="off">
          <span class="cw-form-error" id="aedit-title-err">Title is required</span>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Message *</label>
          <textarea class="cw-form-inp" id="aedit-body" rows="5" style="resize:vertical;">${a.body}</textarea>
          <span class="cw-form-error" id="aedit-body-err">Message is required</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="cw-form-group">
            <label class="cw-form-label">Visible From</label>
            <input type="datetime-local" class="cw-form-inp" id="aedit-from"
              value="${a.visible_from.slice(0, 16)}">
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Expires (optional)</label>
            <input type="datetime-local" class="cw-form-inp" id="aedit-until"
              value="${a.visible_until?.slice(0, 16) ?? ''}">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="aedit-pinned" class="cw-chk" ${a.is_pinned ? 'checked' : ''}>
          <label for="aedit-pinned" style="font-size:13px;color:var(--text-primary);cursor:pointer;user-select:none;">
            Pin this announcement to the top
          </label>
        </div>`,
      footer: `
        <button class="cw-tbtn" id="aedit-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="aedit-submit">
          <i class="bi bi-check2-circle"></i>&nbsp;Save Changes
        </button>`,
    })

    document.getElementById('aedit-cancel')?.addEventListener('click', close)
    document.getElementById('aedit-submit')?.addEventListener('click', async () => {
      const title  = (document.getElementById('aedit-title')  as HTMLInputElement)?.value.trim()
      const body   = (document.getElementById('aedit-body')   as HTMLTextAreaElement)?.value.trim()
      const from   = (document.getElementById('aedit-from')   as HTMLInputElement)?.value
      const until  = (document.getElementById('aedit-until')  as HTMLInputElement)?.value
      const pinned = (document.getElementById('aedit-pinned') as HTMLInputElement)?.checked

      let valid = true
      if (!title) { document.getElementById('aedit-title-err')?.classList.add('show'); valid = false }
      else          document.getElementById('aedit-title-err')?.classList.remove('show')
      if (!body)  { document.getElementById('aedit-body-err')?.classList.add('show');  valid = false }
      else          document.getElementById('aedit-body-err')?.classList.remove('show')
      if (!valid) return

      const btn = document.getElementById('aedit-submit') as HTMLButtonElement
      btn.disabled  = true
      btn.innerHTML = '<span class="cw-spinner"></span>&nbsp;Saving…'

      try {
        await CommunicationService.updateAnnouncement(a.id, {
          title,
          body,
          is_pinned:     pinned,
          visible_from:  from ? new Date(from).toISOString() : a.visible_from,
          visible_until: until ? new Date(until).toISOString() : undefined,
        })
        showToast('Announcement updated', 'success')
        emit('communication:announcement_mutated')
        close()
      } catch (err: any) {
        showToast(err?.message ?? 'Update failed', 'danger')
        btn.disabled  = false
        btn.innerHTML = '<i class="bi bi-check2-circle"></i>&nbsp;Save Changes'
      }
    })
  }

  destroy(): void {
    this._destroyed = true
    if (this._mutateSub) off('communication:announcement_mutated', this._mutateSub)
    this._ctxMenu.close()
    document.getElementById('cw-shared-modal')?.remove()
    this._container = null
  }
}