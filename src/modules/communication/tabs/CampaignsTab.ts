// src/modules/communication/tabs/CampaignsTab.ts

import type { WorkspaceTab } from '@shell/WorkspaceShell'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }               from '@core/authorization/authorization-service'
import {
  StatsCardGroup, Toolbar, ContextMenu, openModal, showToast,
  type StatCardConfig,
} from '../widgets/communicationWidgets'
import { CommunicationService } from '../services/communication.service'
import { supabase }              from '@core/supabase'
import { on, off, emit }         from '@core/events'
import type { Campaign }         from '../schemas/communication'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: 'rgba(139,148,158,0.12)', color: 'var(--text-muted)',         label: 'Draft' },
  scheduled: { bg: 'rgba(227,179,65,0.12)',  color: '#d29922',                   label: 'Scheduled' },
  sending:   { bg: 'rgba(0,75,160,0.12)',    color: 'var(--caci-blue-light)',     label: 'Sending' },
  sent:      { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e',                   label: 'Sent' },
  failed:    { bg: 'rgba(198,0,38,0.12)',    color: 'var(--caci-red)',            label: 'Failed' },
  cancelled: { bg: 'rgba(139,148,158,0.1)', color: 'var(--text-muted)',          label: 'Cancelled' },
}
const CHANNEL_CFG: Record<string, { bg: string; color: string }> = {
  in_app:   { bg: 'rgba(139,148,158,0.1)', color: 'var(--text-secondary)' },
  email:    { bg: 'rgba(0,75,160,0.1)',    color: 'var(--caci-blue-light)' },
  sms:      { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  push:     { bg: 'rgba(124,58,237,0.1)', color: '#a78bfa' },
  audio:    { bg: 'rgba(198,0,38,0.1)',    color: 'var(--caci-red)' },
  whatsapp: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
}

function _badge(status: string): string {
  const { bg, color, label } = STATUS_CFG[status] ?? STATUS_CFG['draft']
  return `<span class="cw-badge" style="background:${bg};color:${color};">
            <span class="cw-badge-dot" style="background:${color};"></span>${label}
          </span>`
}
function _chPill(ch: string): string {
  const { bg, color } = CHANNEL_CFG[ch] ?? CHANNEL_CFG['in_app']
  return `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                        padding:2px 8px;border-radius:99px;background:${bg};color:${color};">${ch}</span>`
}
function _date(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CAMP_CSS = /* css */`
.camp-mob-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-md);
  margin-bottom: 8px; display: flex; align-items: center; gap: 12px;
  cursor: pointer; transition: border-color 0.15s;
}
.camp-mob-card:hover { border-color: var(--border-strong); }
.camp-mob-info { flex: 1; min-width: 0; }
.camp-mob-title { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.camp-mob-meta  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
`

let _campCSSInjected = false
function _injectCSS(): void {
  if (_campCSSInjected) return; _campCSSInjected = true
  const s = document.createElement('style'); s.id = 'camp-tab-css'; s.textContent = CAMP_CSS
  document.head.appendChild(s)
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class CampaignsTab implements WorkspaceTab {
  readonly id         = 'campaigns'
  readonly label      = 'Campaigns'
  readonly icon       = 'megaphone-fill'
  readonly permission = 'communications.broadcast.send'

  private _container:  HTMLElement | null = null
  private _campaigns:  Campaign[]         = []
  private _filtered:   Campaign[]         = []
  private _toolbar:    Toolbar | null     = null
  private _ctxMenu     = new ContextMenu()
  private _destroyed   = false
  private _mutateSub:  ((...args: any[]) => void) | null = null
  private _state       = { search: '', status: 'all' }

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
      <div id="camp-stats-wrap" style="margin-bottom:var(--space-xl);"></div>
      <div id="camp-toolbar-wrap" style="margin-bottom:var(--space-md);"></div>
      <div id="camp-list-wrap"></div>`

    await this._reload()

    this._mutateSub = () => this._reload()
    on('communication:campaign_mutated', this._mutateSub)
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  private async _reload(): Promise<void> {
    if (this._destroyed || !this._container) return
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return

    const listWrap = this._container.querySelector('#camp-list-wrap')
    if (listWrap) listWrap.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`

    try {
      this._campaigns = await CommunicationService.getCampaigns(assemblyId)
    } catch (err: any) {
      if (listWrap) listWrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--caci-red);">Failed to load campaigns. ${err?.message ?? ''}</div>`
      return
    }

    if (this._destroyed) return
    this._applyFilters()
    this._renderStats()
    this._renderToolbar()
    this._renderList()
  }

  private _applyFilters(): void {
    const q = this._state.search.toLowerCase()
    this._filtered = this._campaigns.filter(c => {
      const matchQ = !q || c.title.toLowerCase().includes(q)
      const matchS = this._state.status === 'all' || c.status === this._state.status
      return matchQ && matchS
    })
  }

  // ── Render pieces ─────────────────────────────────────────────────────────

  private _renderStats(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#camp-stats-wrap')
    if (!wrap) return
    wrap.innerHTML = ''

    const total     = this._campaigns.length
    const sent      = this._campaigns.filter(c => c.status === 'sent').length
    const scheduled = this._campaigns.filter(c => c.status === 'scheduled').length
    const drafts    = this._campaigns.filter(c => c.status === 'draft').length

    const cards: StatCardConfig[] = [
      { id: 'all',       label: 'Total Campaigns', icon: 'collection-fill',    accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)',   getValue: () => total },
      { id: 'sent',      label: 'Sent',            icon: 'check-circle-fill',  accentColor: '#22c55e',              glowColor: 'rgba(34,197,94,0.1)',   getValue: () => sent },
      { id: 'scheduled', label: 'Scheduled',       icon: 'calendar-check',     accentColor: '#e3b341',              glowColor: 'rgba(227,179,65,0.1)',  getValue: () => scheduled },
      { id: 'draft',     label: 'Drafts',          icon: 'pencil-square',      accentColor: '#a78bfa',              glowColor: 'rgba(124,58,237,0.1)',  getValue: () => drafts },
    ]

    new StatsCardGroup(wrap, cards, (filterId) => {
      this._state.status = filterId ?? 'all'
      this._applyFilters()
      this._renderList()
      const sel = this._container?.querySelector<HTMLSelectElement>('.cw-filter-select')
      if (sel) sel.value = this._state.status
    })
  }

  private _renderToolbar(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#camp-toolbar-wrap')
    if (!wrap) return
    wrap.innerHTML = ''

    const user      = getCurrentUser()
    const canCreate = user ? can(user, 'communications.broadcast.send' as any) : false

    this._toolbar = new Toolbar(wrap, {
      searchPlaceholder: 'Search campaigns…',
      filters: [
        {
          id: 'status', icon: 'funnel',
          options: [
            { value: 'all',       label: 'All Status' },
            { value: 'draft',     label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'sending',   label: 'Sending' },
            { value: 'sent',      label: 'Sent' },
            { value: 'failed',    label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
          onChange: (v) => { this._state.status = v; this._applyFilters(); this._renderList() },
        },
      ],
      actions: canCreate ? [
        { id: 'new', label: 'New Campaign', icon: 'plus-lg', variant: 'primary', onClick: () => this._openCreateModal() },
      ] : [],
      onSearch: (q) => { this._state.search = q; this._applyFilters(); this._renderList() },
    })
  }

  private _renderList(): void {
    const wrap = this._container?.querySelector<HTMLElement>('#camp-list-wrap')
    if (!wrap) return

    if (!this._filtered.length) {
      wrap.innerHTML = `
        <div class="cw-empty">
          <div class="cw-empty-icon-wrap"><i class="bi bi-megaphone"></i></div>
          <p class="cw-empty-title">No campaigns found</p>
          <p class="cw-empty-desc">${this._state.search || this._state.status !== 'all' ? 'Try adjusting your search or filters.' : 'Create your first campaign to get started.'}</p>
        </div>`
      return
    }

    const user      = getCurrentUser()
    const canAct    = user ? can(user, 'communications.broadcast.send' as any) : false
    const COLS      = 'minmax(180px,1fr) 90px 120px 110px 100px 44px'

    // Desktop table rows
    const rows = this._filtered.map(c => `
      <div class="cw-table-row" data-camp-id="${c.id}" style="grid-template-columns:${COLS};cursor:pointer;">
        <div class="cw-col-cell" style="flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${c.title}</span>
          <span style="font-size:11px;color:var(--text-muted);">${c.audience_type === 'assembly' ? 'Entire assembly' : c.audience_type} · ${c.total_recipients} recipients</span>
        </div>
        <div class="cw-col-cell">${_chPill(c.channel)}</div>
        <div class="cw-col-cell">${_badge(c.status)}</div>
        <div class="cw-col-cell" style="font-size:12px;color:var(--text-secondary);">${_date((c as any).scheduled_at ?? null)}</div>
        <div class="cw-col-cell" style="font-size:12px;color:var(--text-secondary);">${_date(c.created_at)}</div>
        <div class="cw-col-cell" style="justify-content:flex-end;">
          ${canAct ? `<button class="cw-tbtn" style="height:28px;padding:0 8px;border:none;" data-ctx="${c.id}">
            <i class="bi bi-three-dots-vertical" style="font-size:13px;"></i>
          </button>` : ''}
        </div>
      </div>`)

    // Mobile cards
    const mobs = this._filtered.map(c => `
      <div class="camp-mob-card" data-camp-id="${c.id}">
        <div class="camp-mob-info">
          <div class="camp-mob-title">${c.title}</div>
          <div class="camp-mob-meta">${_date(c.created_at)} · ${c.total_recipients} recipients</div>
        </div>
        ${_chPill(c.channel)}
        ${_badge(c.status)}
        ${canAct ? `<button class="cw-tbtn" style="height:28px;padding:0 8px;border:none;" data-ctx="${c.id}">
          <i class="bi bi-three-dots-vertical" style="font-size:13px;"></i>
        </button>` : ''}
      </div>`)

    wrap.innerHTML = `
      <div class="cw-table-wrap">
        <div class="cw-table-header" style="grid-template-columns:${COLS};">
          <div class="cw-col-hd">Campaign</div>
          <div class="cw-col-hd">Channel</div>
          <div class="cw-col-hd">Status</div>
          <div class="cw-col-hd">Scheduled</div>
          <div class="cw-col-hd">Created</div>
          <div class="cw-col-hd"></div>
        </div>
        <div class="cw-table-body">${rows.join('')}</div>
      </div>
      <div class="cw-mobile-rows">${mobs.join('')}</div>`

    // Row click → detail
    wrap.querySelectorAll<HTMLElement>('[data-camp-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-ctx]')) return
        const c = this._campaigns.find(x => x.id === row.dataset['campId'])
        if (c) this._showDetail(c)
      })
    })

    // Context menus
    wrap.querySelectorAll<HTMLButtonElement>('[data-ctx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const c = this._campaigns.find(x => x.id === btn.dataset['ctx'])
        if (c) this._showCtxMenu(btn, c)
      })
    })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private _showCtxMenu(btn: HTMLButtonElement, c: Campaign): void {
    this._ctxMenu.show(btn.getBoundingClientRect(), [
      { id: 'view',   label: 'View Details',  icon: 'bar-chart-fill',  onClick: () => this._showDetail(c) },
      ...(c.status === 'draft' ? [
        { id: 'send', label: 'Send Now', icon: 'send-fill', onClick: () => this._confirmSend(c) },
      ] : []),
      {
        id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger' as const, divider: true,
        onClick: () => this._confirmDelete(c),
      },
    ])
  }

  private _confirmSend(c: Campaign): void {
    const close = openModal({
      title:     'Send Campaign',
      subtitle:  `"${c.title}" will be dispatched immediately.`,
      icon:      'send-fill',
      iconBg:    'rgba(0,75,160,0.12)',
      iconColor: 'var(--caci-blue-light)',
      body: `<p style="font-size:13px;color:var(--text-secondary);margin:0;">
        This will send to the <strong style="color:var(--text-primary);">${c.audience_type === 'assembly' ? 'entire assembly' : c.audience_type}</strong>
        via <strong style="color:var(--text-primary);">${c.channel}</strong>. This cannot be undone.
      </p>`,
      footer: `
        <button class="cw-tbtn" id="csend-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="csend-confirm">
          <i class="bi bi-send-fill"></i>&nbsp;Send Now
        </button>`,
    })
    document.getElementById('csend-cancel')?.addEventListener('click', close)
    document.getElementById('csend-confirm')?.addEventListener('click', async () => {
      close()
      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comm-fanout`,
          {
            method:  'POST',
            headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ campaign_id: c.id }),
          },
        )
        if (!res.ok) throw new Error((await res.json()).error ?? 'Fanout failed')
        showToast('Campaign sent successfully!', 'success')
        emit('communication:campaign_mutated')
      } catch (err: any) {
        showToast(err?.message ?? 'Failed to send campaign', 'danger')
      }
    })
  }

  private _confirmDelete(c: Campaign): void {
    const close = openModal({
      title:     'Delete Campaign',
      subtitle:  'This action cannot be undone.',
      icon:      'trash-fill',
      iconBg:    'rgba(198,0,38,0.1)',
      iconColor: 'var(--caci-red)',
      body: `<p style="font-size:13px;color:var(--text-secondary);margin:0;">
        Delete <strong style="color:var(--text-primary);">${c.title}</strong>? Sent messages will not be recalled.
      </p>`,
      footer: `
        <button class="cw-tbtn" id="cdel-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-danger" id="cdel-confirm">
          <i class="bi bi-trash"></i>&nbsp;Delete
        </button>`,
    })
    document.getElementById('cdel-cancel')?.addEventListener('click', close)
    document.getElementById('cdel-confirm')?.addEventListener('click', async () => {
      close()
      try {
        await (supabase as any)
          .from('communication_campaigns')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', c.id)
        showToast('Campaign deleted', 'success')
        emit('communication:campaign_mutated')
      } catch {
        showToast('Failed to delete campaign', 'danger')
      }
    })
  }

  private _openCreateModal(): void {
    const close = openModal({
      title:    'New Campaign',
      subtitle: 'Compose a broadcast for your assembly',
      icon:     'megaphone-fill',
      iconBg:   'rgba(0,75,160,0.12)',
      iconColor: 'var(--caci-blue-light)',
      body: `
        <div class="cw-form-group">
          <label class="cw-form-label">Campaign Title *</label>
          <input type="text" class="cw-form-inp" id="cnew-title" placeholder="e.g. Sunday Service Reminder" maxlength="120" autocomplete="off">
          <span class="cw-form-error" id="cnew-title-err">Title is required</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="cw-form-group">
            <label class="cw-form-label">Channel *</label>
            <select class="cw-form-inp" id="cnew-channel" style="cursor:pointer;">
              <option value="in_app">In-App</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="push">Push Notification</option>
            </select>
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Audience *</label>
            <select class="cw-form-inp" id="cnew-audience" style="cursor:pointer;">
              <option value="assembly">Entire Assembly</option>
              <option value="group">Specific Group</option>
              <option value="member_list">Selected Members</option>
            </select>
          </div>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Message Body *</label>
          <textarea class="cw-form-inp" id="cnew-body" rows="4"
            placeholder="Write your broadcast message here…" style="resize:vertical;"></textarea>
          <span class="cw-form-error" id="cnew-body-err">Message body is required</span>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Schedule (optional)</label>
          <input type="datetime-local" class="cw-form-inp" id="cnew-schedule">
          <span style="font-size:11px;color:var(--text-muted);">Leave blank to save as draft.</span>
        </div>`,
      footer: `
        <button class="cw-tbtn" id="cnew-cancel">Cancel</button>
        <button class="cw-tbtn cw-tbtn-primary" id="cnew-submit">
          <i class="bi bi-send-fill"></i>&nbsp;Create Campaign
        </button>`,
    })

    document.getElementById('cnew-cancel')?.addEventListener('click', close)
    document.getElementById('cnew-submit')?.addEventListener('click', async () => {
      const title    = (document.getElementById('cnew-title')    as HTMLInputElement)?.value.trim()
      const body     = (document.getElementById('cnew-body')     as HTMLTextAreaElement)?.value.trim()
      const channel  = (document.getElementById('cnew-channel')  as HTMLSelectElement)?.value
      const audience = (document.getElementById('cnew-audience') as HTMLSelectElement)?.value
      const schedule = (document.getElementById('cnew-schedule') as HTMLInputElement)?.value

      let valid = true
      if (!title) { document.getElementById('cnew-title-err')?.classList.add('show'); valid = false }
      else          document.getElementById('cnew-title-err')?.classList.remove('show')
      if (!body)  { document.getElementById('cnew-body-err')?.classList.add('show');  valid = false }
      else          document.getElementById('cnew-body-err')?.classList.remove('show')
      if (!valid) return

      const btn = document.getElementById('cnew-submit') as HTMLButtonElement
      btn.disabled  = true
      btn.innerHTML = '<span class="cw-spinner"></span>&nbsp;Creating…'

      const assemblyId = getActiveAssemblyId()
      if (!assemblyId) { showToast('No assembly selected', 'danger'); return }

      try {
        await CommunicationService.createCampaign({
          assembly_id:   assemblyId,
          title,
          channel:       channel as any,
          audience_type: audience as any,
          audience_ids:  [],
          trigger_type:  'manual',
          status:        schedule ? 'scheduled' : 'draft',
          total_recipients: 0,
        } as any)
        showToast('Campaign created', 'success')
        emit('communication:campaign_mutated')
        close()
      } catch (err: any) {
        showToast(err?.message ?? 'Failed to create campaign', 'danger')
        btn.disabled  = false
        btn.innerHTML = '<i class="bi bi-send-fill"></i>&nbsp;Create Campaign'
      }
    })
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  private async _showDetail(c: Campaign): Promise<void> {
    if (!this._container) return

    this._container.innerHTML = `<div style="padding:60px;text-align:center;"><span class="cw-spinner"></span></div>`

    let stats: Awaited<ReturnType<typeof CommunicationService.getCampaignStats>> | null = null
    let messages: any[] = []

    try {
      ;[stats, messages] = await Promise.all([
        CommunicationService.getCampaignStats(c.id),
        CommunicationService.getCampaignMessages(c.id),
      ])
    } catch (e) { console.error('[CampaignsTab] detail load', e) }

    if (this._destroyed || !this._container) return

    this._container.innerHTML = `
      <button class="cw-tbtn" id="camp-back" style="margin-bottom:var(--space-lg);">
        <i class="bi bi-arrow-left"></i>&nbsp;All Campaigns
      </button>

      <!-- Campaign header -->
      <div style="background:var(--bg-card);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--space-lg);margin-bottom:var(--space-lg);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-md);">
          <div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0 0 6px;">${c.title}</h2>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${_chPill(c.channel)} ${_badge(c.status)}
              <span style="font-size:11px;color:var(--text-muted);">Created ${_date(c.created_at)}</span>
            </div>
          </div>
          ${c.status === 'draft' ? `
            <button class="cw-tbtn cw-tbtn-primary" id="camp-detail-send" style="flex-shrink:0;">
              <i class="bi bi-send-fill"></i>&nbsp;Send Now
            </button>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--space-md);">
          ${[
            ['Audience',    c.audience_type === 'assembly' ? 'Entire Assembly' : c.audience_type],
            ['Recipients',  c.total_recipients.toLocaleString()],
            ['Trigger',     (c as any).trigger_type ?? 'Manual'],
            ['Scheduled',   _date((c as any).scheduled_at ?? null)],
          ].map(([k, v]) => `
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:3px;">${k}</div>
              <div style="font-size:13px;color:var(--text-primary);font-weight:500;">${v}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Delivery stats -->
      <div id="camp-detail-stats" style="margin-bottom:var(--space-lg);"></div>

      <!-- Message log -->
      <div class="cw-table-wrap">
        <div class="cw-table-header" style="grid-template-columns:1fr 110px 115px 115px;">
          <div class="cw-col-hd">Recipient</div>
          <div class="cw-col-hd">Status</div>
          <div class="cw-col-hd">Delivered</div>
          <div class="cw-col-hd">Read</div>
        </div>
        <div class="cw-table-body">
          ${!messages.length
            ? `<div class="cw-empty" style="padding:40px;">
                <div class="cw-empty-icon-wrap"><i class="bi bi-inbox"></i></div>
                <p class="cw-empty-title">No messages yet</p>
                <p class="cw-empty-desc">Messages appear here after the campaign is sent.</p>
               </div>`
            : messages.slice(0, 100).map(m => `
                <div class="cw-table-row" style="grid-template-columns:1fr 110px 115px 115px;">
                  <div class="cw-col-cell" style="font-size:12px;font-family:monospace;color:var(--text-secondary);">
                    ${(m.member_id ?? m.recipient_id ?? '—').toString().slice(0, 8)}…
                  </div>
                  <div class="cw-col-cell">${_badge(m.status)}</div>
                  <div class="cw-col-cell" style="font-size:12px;color:var(--text-muted);">${_date(m.delivered_at)}</div>
                  <div class="cw-col-cell" style="font-size:12px;color:var(--text-muted);">${_date(m.read_at)}</div>
                </div>`).join('')}
        </div>
      </div>`

    // Stats
    if (stats) {
      new StatsCardGroup(
        this._container.querySelector('#camp-detail-stats') as HTMLElement,
        [
          { id: 'total',     label: 'Total',     icon: 'people-fill',       accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)',  getValue: () => stats!.total },
          { id: 'sent',      label: 'Sent',      icon: 'send-fill',         accentColor: '#22c55e',              glowColor: 'rgba(34,197,94,0.1)',  getValue: () => stats!.sent },
          { id: 'delivered', label: 'Delivered', icon: 'check-circle-fill', accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)',  getValue: () => stats!.delivered },
          { id: 'read',      label: 'Read',      icon: 'eye-fill',          accentColor: '#e3b341',              glowColor: 'rgba(227,179,65,0.1)', getValue: () => stats!.read },
          { id: 'failed',    label: 'Failed',    icon: 'x-circle-fill',     accentColor: 'var(--caci-red)',       glowColor: 'rgba(198,0,38,0.1)',  getValue: () => stats!.failed },
        ],
        () => {},
      )
    }

    this._container.querySelector('#camp-back')?.addEventListener('click', () => this.render(this._container!))
    this._container.querySelector('#camp-detail-send')?.addEventListener('click', () => this._confirmSend(c))
  }

  destroy(): void {
    this._destroyed = true
    if (this._mutateSub) off('communication:campaign_mutated', this._mutateSub)
    this._toolbar = null
    this._ctxMenu.close()
    document.getElementById('cw-shared-modal')?.remove()
    this._container = null
  }
}