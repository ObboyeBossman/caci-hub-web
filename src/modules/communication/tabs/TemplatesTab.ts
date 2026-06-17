// src/modules/communication/tabs/TemplatesTab.ts

import type { WorkspaceTab } from '@shell/WorkspaceShell'
import { getActiveAssemblyId }  from '@core/auth'
import { Toolbar, ContextMenu, openModal, showToast } from '../widgets/communicationWidgets'
import { CommunicationService }  from '../services/communication.service'
import { on, off, emit }         from '@core/events'
import type { Template }         from '../schemas/communication'

// ─── CSS ─────────────────────────────────────────────────────────────────────

const TMPL_CSS = /* css */`
.tmpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md);
}
.tmpl-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-lg);
  display: flex; flex-direction: column; gap: var(--space-sm);
  transition: all 0.15s;
}
.tmpl-card:hover { border-color: var(--border-strong); }
.tmpl-card-top {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-sm);
}
.tmpl-card-name   { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; flex: 1; }
.tmpl-ch-pill {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  padding: 2px 7px; border-radius: 99px; flex-shrink: 0;
}
.tmpl-card-preview {
  font-size: 12px; color: var(--text-secondary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden; flex: 1;
}
.tmpl-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-sm); padding-top: var(--space-sm);
  border-top: 1px solid var(--border-default);
}
.tmpl-card-vars { font-size: 10px; color: var(--text-muted); }
.tmpl-cat {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted); padding: 1px 6px; border-radius: 99px;
  background: var(--bg-page); border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
}
`

const CH_CFG: Record<string, { bg: string; color: string }> = {
  in_app:   { bg: 'rgba(139,148,158,0.1)', color: 'var(--text-secondary)' },
  email:    { bg: 'rgba(0,75,160,0.1)',    color: 'var(--caci-blue-light)' },
  sms:      { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  push:     { bg: 'rgba(124,58,237,0.1)', color: '#a78bfa' },
  whatsapp: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
}

let _tmplCSSInjected = false
function _injectCSS(): void {
  if (_tmplCSSInjected) return; _tmplCSSInjected = true
  const s = document.createElement('style'); s.id = 'tmpl-tab-css'; s.textContent = TMPL_CSS
  document.head.appendChild(s)
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class TemplatesTab implements WorkspaceTab {
  readonly id         = 'templates'
  readonly label      = 'Templates'
  readonly icon       = 'file-earmark-text-fill'
  readonly permission = 'communications.templates.manage'

  private _container:  HTMLElement | null = null
  private _templates:  Template[]         = []
  private _filtered:   Template[]         = []
  private _toolbar:    Toolbar | null     = null
  private _ctxMenu     = new ContextMenu()
  private _destroyed   = false
  private _mutateSub:  ((...args: any[]) => void) | null = null
  private _state       = { search: '', channel: 'all' }

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
      <div id="tmpl-toolbar-wrap" style="margin-bottom:var(--space-md);"></div>
      <div id="tmpl-grid-wrap"><div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div></div>`

    await this._reload()
    this._mutateSub = () => this._reload()
    on('communication:template_mutated', this._mutateSub)
  }

  private async _reload(): Promise<void> {
    if (this._destroyed || !this._container) return
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return

    const wrap = this._container.querySelector('#tmpl-grid-wrap')
    if (wrap) wrap.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`

    try {
      this._templates = await CommunicationService.getTemplates(assemblyId)
    } catch (err: any) {
      if (wrap) wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--caci-red);">Failed to load templates. ${err?.message ?? ''}</div>`
      return
    }

    if (this._destroyed) return
    this._applyFilters()
    this._renderToolbar()
    this._renderGrid()
  }

  private _applyFilters(): void {
    const q = this._state.search.toLowerCase()
    this._filtered = this._templates.filter(t => {
      const matchQ  = !q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
      const matchCh = this._state.channel === 'all' || t.channel === this._state.channel
      return matchQ && matchCh
    })
  }

  private _renderToolbar(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#tmpl-toolbar-wrap')
    if (!wrap) return
    wrap.innerHTML = ''

    this._toolbar = new Toolbar(wrap, {
      searchPlaceholder: 'Search templates…',
      filters: [
        {
          id: 'channel', icon: 'broadcast',
          options: [
            { value: 'all',    label: 'All Channels' },
            { value: 'in_app', label: 'In-App' },
            { value: 'email',  label: 'Email' },
            { value: 'sms',    label: 'SMS' },
            { value: 'push',   label: 'Push' },
          ],
          onChange: (v) => { this._state.channel = v; this._applyFilters(); this._renderGrid() },
        },
      ],
      actions: [
        { id: 'new', label: 'New Template', icon: 'plus-lg', variant: 'primary', onClick: () => this._openCreateModal() },
      ],
      onSearch: (q) => { this._state.search = q; this._applyFilters(); this._renderGrid() },
    })
  }

  private _renderGrid(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#tmpl-grid-wrap')
    if (!wrap) return

    if (!this._filtered.length) {
      wrap.innerHTML = `
        <div class="cw-empty">
          <div class="cw-empty-icon-wrap"><i class="bi bi-file-earmark-text"></i></div>
          <p class="cw-empty-title">No templates found</p>
          <p class="cw-empty-desc">${this._state.search || this._state.channel !== 'all' ? 'Try adjusting your filters.' : 'Create your first reusable template.'}</p>
        </div>`
      return
    }

    wrap.innerHTML = `<div class="tmpl-grid">${this._filtered.map(t => {
      const { bg, color } = CH_CFG[t.channel] ?? CH_CFG['in_app']
      const varCount = Array.isArray(t.variables)
        ? t.variables.length
        : (typeof t.variables === 'object' ? Object.keys(t.variables ?? {}).length : 0)
      return `
        <div class="tmpl-card">
          <div class="tmpl-card-top">
            <h3 class="tmpl-card-name">${t.title}</h3>
            <button class="cw-tbtn" style="height:28px;padding:0 8px;border:none;flex-shrink:0;" data-tmpl-ctx="${t.id}">
              <i class="bi bi-three-dots-vertical" style="font-size:13px;"></i>
            </button>
          </div>
          <span class="tmpl-ch-pill" style="background:${bg};color:${color};width:fit-content;">${t.channel}</span>
          <div class="tmpl-card-preview">${t.body}</div>
          <div class="tmpl-card-footer">
            <span class="tmpl-cat">${t.category}</span>
            <span class="tmpl-card-vars">${varCount} variable${varCount !== 1 ? 's' : ''}</span>
          </div>
        </div>`
    }).join('')}</div>`

    wrap.querySelectorAll<HTMLButtonElement>('[data-tmpl-ctx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const t = this._templates.find(x => x.id === btn.dataset['tmplCtx'])
        if (t) this._showCtxMenu(btn, t)
      })
    })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private _showCtxMenu(btn: HTMLButtonElement, t: Template): void {
    this._ctxMenu.show(btn.getBoundingClientRect(), [
      { id: 'edit',  label: 'Edit Template',      icon: 'pencil-square', onClick: () => this._openEditModal(t) },
      { id: 'use',   label: 'Use in Campaign',    icon: 'megaphone-fill', onClick: () => this._useInCampaign(t) },
      {
        id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger' as const, divider: true,
        onClick: () => this._confirmDelete(t),
      },
    ])
  }

  private _useInCampaign(t: Template): void {
    // Switch to campaigns tab and pre-fill
    document.querySelector<HTMLButtonElement>('button[data-tab-id="campaigns"]')?.click()
    // Small delay to let campaigns tab render, then trigger new campaign modal
    setTimeout(() => {
      showToast(`Template "${t.title}" ready — create a campaign to use it.`, 'info')
    }, 300)
  }

  private _confirmDelete(t: Template): void {
    const close = openModal({
      title:     'Delete Template',
      subtitle:  'This cannot be undone.',
      icon:      'trash-fill',
      iconBg:    'rgba(198,0,38,0.1)',
      iconColor: 'var(--caci-red)',
      body: `<p style="font-size:13px;color:var(--text-secondary);margin:0;">
        Delete template <strong style="color:var(--text-primary);">${t.title}</strong>?
        Campaigns using this template will not be affected.
      </p>`,
      footer: `
        <button class="cw-tbtn" id="tdel-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-danger" id="tdel-confirm">
          <i class="bi bi-trash"></i>&nbsp;Delete
        </button>`,
    })
    document.getElementById('tdel-cancel')?.addEventListener('click', close)
    document.getElementById('tdel-confirm')?.addEventListener('click', async () => {
      close()
      try {
        await CommunicationService.deleteTemplate(t.id)
        showToast('Template deleted', 'success')
        emit('communication:template_mutated')
      } catch (err: any) {
        showToast(err?.message ?? 'Delete failed', 'danger')
      }
    })
  }

  // ── Create modal ──────────────────────────────────────────────────────────

  private _openCreateModal(): void {
    const close = openModal({
      title:     'New Template',
      subtitle:  'Create a reusable message template',
      icon:      'file-earmark-plus-fill',
      iconBg:    'rgba(0,75,160,0.12)',
      iconColor: 'var(--caci-blue-light)',
      body: `
        <div class="cw-form-group">
          <label class="cw-form-label">Template Name *</label>
          <input type="text" class="cw-form-inp" id="tnew-name"
            placeholder="e.g. Birthday Greeting" maxlength="100" autocomplete="off">
          <span class="cw-form-error" id="tnew-name-err">Name is required</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="cw-form-group">
            <label class="cw-form-label">Channel *</label>
            <select class="cw-form-inp" id="tnew-channel" style="cursor:pointer;">
              <option value="in_app">In-App</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="push">Push Notification</option>
            </select>
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Category *</label>
            <select class="cw-form-inp" id="tnew-category" style="cursor:pointer;">
              <option value="broadcast">Broadcast</option>
              <option value="automated">Automated</option>
              <option value="direct">Direct</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Message Body *</label>
          <textarea class="cw-form-inp" id="tnew-body" rows="5" style="resize:vertical;"
            placeholder="Write your template here… Use {{first_name}}, {{last_name}} as variables."></textarea>
          <span class="cw-form-error" id="tnew-body-err">Body is required</span>
          <span style="font-size:11px;color:var(--text-muted);margin-top:4px;display:block;">
            Use <code style="background:var(--bg-page);padding:1px 4px;border-radius:3px;">{{variable_name}}</code> for dynamic values.
          </span>
        </div>`,
      footer: `
        <button class="cw-tbtn" id="tnew-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="tnew-submit">
          <i class="bi bi-check2-circle"></i>&nbsp;Create Template
        </button>`,
    })

    document.getElementById('tnew-cancel')?.addEventListener('click', close)
    document.getElementById('tnew-submit')?.addEventListener('click', async () => {
      const name     = (document.getElementById('tnew-name')     as HTMLInputElement)?.value.trim()
      const body     = (document.getElementById('tnew-body')     as HTMLTextAreaElement)?.value.trim()
      const channel  = (document.getElementById('tnew-channel')  as HTMLSelectElement)?.value
      const category = (document.getElementById('tnew-category') as HTMLSelectElement)?.value

      let valid = true
      if (!name) { document.getElementById('tnew-name-err')?.classList.add('show'); valid = false }
      else          document.getElementById('tnew-name-err')?.classList.remove('show')
      if (!body) { document.getElementById('tnew-body-err')?.classList.add('show');  valid = false }
      else          document.getElementById('tnew-body-err')?.classList.remove('show')
      if (!valid) return

      const btn = document.getElementById('tnew-submit') as HTMLButtonElement
      btn.disabled  = true
      btn.innerHTML = '<span class="cw-spinner"></span>&nbsp;Creating…'

      const assemblyId = getActiveAssemblyId()
      if (!assemblyId) { showToast('No assembly selected', 'danger'); return }

      // Extract {{variable}} names from body
      const vars = [...body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])

      try {
        await CommunicationService.createTemplate({
          assembly_id: assemblyId,
          title:       name,
          body,
          channel:     channel as any,
          category:    category as any,
          variables:   vars as any,
          is_active:   true,
        })
        showToast('Template created', 'success')
        emit('communication:template_mutated')
        close()
      } catch (err: any) {
        showToast(err?.message ?? 'Failed to create template', 'danger')
        btn.disabled  = false
        btn.innerHTML = '<i class="bi bi-check2-circle"></i>&nbsp;Create Template'
      }
    })
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  private _openEditModal(t: Template): void {
    const close = openModal({
      title:     'Edit Template',
      subtitle:  `Editing "${t.title}"`,
      icon:      'pencil-square',
      iconBg:    'rgba(0,75,160,0.12)',
      iconColor: 'var(--caci-blue-light)',
      body: `
        <div class="cw-form-group">
          <label class="cw-form-label">Template Name *</label>
          <input type="text" class="cw-form-inp" id="tedit-name"
            value="${t.title.replace(/"/g, '&quot;')}" maxlength="100" autocomplete="off">
          <span class="cw-form-error" id="tedit-name-err">Name is required</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="cw-form-group">
            <label class="cw-form-label">Channel</label>
            <select class="cw-form-inp" id="tedit-channel" style="cursor:pointer;">
              ${['in_app','sms','email','push'].map(ch =>
                `<option value="${ch}" ${t.channel === ch ? 'selected' : ''}>${ch}</option>`).join('')}
            </select>
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Category</label>
            <select class="cw-form-inp" id="tedit-category" style="cursor:pointer;">
              ${['broadcast','automated','direct','announcement'].map(cat =>
                `<option value="${cat}" ${t.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Message Body *</label>
          <textarea class="cw-form-inp" id="tedit-body" rows="6" style="resize:vertical;">${t.body}</textarea>
          <span class="cw-form-error" id="tedit-body-err">Body is required</span>
        </div>`,
      footer: `
        <button class="cw-tbtn" id="tedit-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="tedit-submit">
          <i class="bi bi-check2-circle"></i>&nbsp;Save Changes
        </button>`,
    })

    document.getElementById('tedit-cancel')?.addEventListener('click', close)
    document.getElementById('tedit-submit')?.addEventListener('click', async () => {
      const name     = (document.getElementById('tedit-name')     as HTMLInputElement)?.value.trim()
      const body     = (document.getElementById('tedit-body')     as HTMLTextAreaElement)?.value.trim()
      const channel  = (document.getElementById('tedit-channel')  as HTMLSelectElement)?.value
      const category = (document.getElementById('tedit-category') as HTMLSelectElement)?.value

      let valid = true
      if (!name) { document.getElementById('tedit-name-err')?.classList.add('show'); valid = false }
      else          document.getElementById('tedit-name-err')?.classList.remove('show')
      if (!body) { document.getElementById('tedit-body-err')?.classList.add('show');  valid = false }
      else          document.getElementById('tedit-body-err')?.classList.remove('show')
      if (!valid) return

      const btn = document.getElementById('tedit-submit') as HTMLButtonElement
      btn.disabled  = true
      btn.innerHTML = '<span class="cw-spinner"></span>&nbsp;Saving…'

      const vars = [...body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])

      try {
        await CommunicationService.updateTemplate(t.id, {
          title:     name,
          body,
          channel:   channel as any,
          category:  category as any,
          variables: vars as any,
        })
        showToast('Template updated', 'success')
        emit('communication:template_mutated')
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
    if (this._mutateSub) off('communication:template_mutated', this._mutateSub)
    this._ctxMenu.close()
    document.getElementById('cw-shared-modal')?.remove()
    this._container = null
  }
}