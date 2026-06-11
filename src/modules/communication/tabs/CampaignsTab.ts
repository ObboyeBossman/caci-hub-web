// src/modules/communication/tabs/CampaignsTab.ts
import type { WorkspaceTab } from '../workspace/CommunicationWorkspaceShell'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { CommunicationService } from '../services/communication.service'
import type { Campaign } from '../schemas/communication'
import { Toolbar, ContextMenu } from '../widgets/communicationWidgets'

const CSS = /* css */`
.cw-campaign-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.cw-campaign-subj { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
`

let _cssInjected = false
function _injectCSS() {
  if (_cssInjected) return
  _cssInjected = true
  const s = document.createElement('style')
  s.textContent = CSS
  document.head.appendChild(s)
}

function _statusCfg(status: string) {
  switch (status) {
    case 'draft':     return { cls: 'aw-badge-inactive', label: 'Draft' }
    case 'scheduled': return { cls: 'aw-badge-pending', label: 'Scheduled' }
    case 'sending':   return { cls: 'aw-badge-pending', label: 'Sending' }
    case 'sent':      return { cls: 'aw-badge-active', label: 'Sent' }
    case 'cancelled': return { cls: 'aw-badge-locked', label: 'Cancelled' }
    default:          return { cls: 'aw-badge-inactive', label: 'Unknown' }
  }
}

function _fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB')
}

export class CampaignsTab implements WorkspaceTab {
  readonly id = 'campaigns'
  readonly label = 'Campaigns'
  readonly icon = 'megaphone-fill'
  readonly permission = 'communications.broadcast.send'

  private _container: HTMLElement | null = null
  private _campaigns: Campaign[] = []
  private _filtered: Campaign[] = []
  private _toolbar: Toolbar | null = null
  private _ctxMenu = new ContextMenu()
  private _state = {
    search: '',
    statusFilter: 'all'
  }

  async render(container: HTMLElement): Promise<void> {
    this._container = container
    _injectCSS()
    const assemblyId = getActiveAssemblyId()

    if (!assemblyId) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">No assembly selected</div>`
      return
    }

    try {
      this._campaigns = await CommunicationService.getCampaigns(assemblyId)
      this._applyFilters()
    } catch (e) {
      console.error(e)
    }

    container.innerHTML = `
      <div style="padding:var(--space-md) 0;">
        <div id="camp-toolbar-wrap" style="margin-bottom: var(--space-md);"></div>
        <div id="camp-list-wrap"></div>
      </div>
    `

    const user = getCurrentUser()
    const canCreate = user ? can(user, PERMISSIONS.COMMS_BROADCAST_SEND) : false

    this._toolbar = new Toolbar(container.querySelector('#camp-toolbar-wrap')!, {
      searchPlaceholder: 'Search campaigns...',
      filters: [
        {
          id: 'status',
          icon: 'funnel',
          options: [
            { value: 'all', label: 'All Status' },
            { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'sending', label: 'Sending' },
            { value: 'sent', label: 'Sent' },
            { value: 'cancelled', label: 'Cancelled' }
          ],
          onChange: (v) => {
            this._state.statusFilter = v
            this._applyFilters()
            this._renderList()
          }
        }
      ],
      actions: canCreate ? [
        {
          id: 'create',
          label: 'New Campaign',
          icon: 'plus-lg',
          variant: 'primary',
          onClick: () => {
            // openCreateCampaignModal()
          }
        }
      ] : [],
      onSearch: (q) => {
        this._state.search = q
        this._applyFilters()
        this._renderList()
      }
    })

    this._renderList()
  }

  private _applyFilters() {
    const q = this._state.search.toLowerCase()
    this._filtered = this._campaigns.filter(c => {
      const matchSearch = !q || c.title.toLowerCase().includes(q) || (c.body && c.body.toLowerCase().includes(q))
      const matchStatus = this._state.statusFilter === 'all' || c.status === this._state.statusFilter
      return matchSearch && matchStatus
    })
  }

  private _renderList() {
    const wrap = this._container?.querySelector('#camp-list-wrap')
    if (!wrap) return

    if (this._filtered.length === 0) {
      wrap.innerHTML = `
        <div class="aw-table-wrap">
          <div class="aw-empty" style="padding:64px 20px;">
            <div class="aw-empty-icon-wrap"><i class="bi bi-search"></i></div>
            <p class="aw-empty-title">No campaigns found</p>
            <p class="aw-empty-desc">Try adjusting your filters.</p>
          </div>
        </div>
      `
      return
    }

    const rowsHTML = this._filtered.map(c => {
      const st = _statusCfg(c.status)
      return `
        <div class="aw-table-row" style="grid-template-columns: 2fr 1fr 1fr 1fr 50px;" data-id="${c.id}">
          <div class="aw-col-cell" style="flex-direction:column;align-items:flex-start;justify-content:center;">
            <div class="cw-campaign-title">${c.title}</div>
            <div class="cw-campaign-subj">${c.body || 'No summary'}</div>
          </div>
          <div class="aw-col-cell">
            <span class="aw-badge ${st.cls}"><span class="aw-badge-dot"></span>${st.label}</span>
          </div>
          <div class="aw-col-cell" style="font-size:12px;color:var(--text-secondary);">
            ${_fmtDate(c.scheduled_for || c.created_at)}
          </div>
          <div class="aw-col-cell" style="font-size:12px;color:var(--text-secondary);">
            ${c.status === 'sent' ? _fmtDate(c.updated_at) : '—'}
          </div>
          <div class="aw-col-cell" style="justify-content:flex-end;">
            <button class="aw-tbtn" style="border:none;background:transparent;padding:4px;" data-ctx="${c.id}">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
          </div>
        </div>
      `
    }).join('')

    wrap.innerHTML = `
      <div class="aw-table-wrap">
        <div class="aw-table-header" style="grid-template-columns: 2fr 1fr 1fr 1fr 50px;">
          <div class="aw-col-hd">Campaign</div>
          <div class="aw-col-hd">Status</div>
          <div class="aw-col-hd">Scheduled</div>
          <div class="aw-col-hd">Sent</div>
          <div class="aw-col-hd"></div>
        </div>
        <div class="aw-table-body">${rowsHTML}</div>
      </div>
    `

    wrap.querySelectorAll<HTMLButtonElement>('[data-ctx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = btn.dataset['ctx']!
        const c = this._campaigns.find(x => x.id === id)
        if (!c) return
        this._ctxMenu.show(btn.getBoundingClientRect(), [
          { id: 'view', label: 'View Details', icon: 'eye', onClick: () => this._viewDetails(c) },
          { id: 'duplicate', label: 'Duplicate', icon: 'files', onClick: () => {} },
          c.status === 'draft' ? { id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => {} } : { id: 'archive', label: 'Archive', icon: 'archive', onClick: () => {} }
        ])
      })
    })

    wrap.querySelectorAll<HTMLElement>('.aw-table-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return
        const id = row.dataset['id']
        const c = this._campaigns.find(x => x.id === id)
        if (c) this._viewDetails(c)
      })
    })
  }

  private async _viewDetails(c: Campaign) {
    if (!this._container) return
    this._container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <span class="aw-spinner"></span>
        <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">Loading campaign details...</div>
      </div>
    `
    
    let stats: any = null
    let messages: any[] = []
    try {
      ;[stats, messages] = await Promise.all([
        CommunicationService.getCampaignStats(c.id),
        CommunicationService.getCampaignMessages(c.id)
      ])
    } catch (e) {
      console.error(e)
    }

    const main = document.createElement('div')
    main.className = 'cw-page' // Using simple layout
    main.innerHTML = `
      <button class="aw-tbtn" id="cw-camp-back-btn" style="margin-bottom: var(--space-md);">
        <i class="bi bi-arrow-left"></i> Back to Campaigns
      </button>

      <div class="aw-table-wrap" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
        <h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px;">${c.title}</h2>
        ${c.body ? `<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: var(--space-md);">${c.body}</p>` : ''}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-md);">
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Channel</div>
            <div style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${c.channel}</div>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Status</div>
            <div><span class="aw-badge ${_statusCfg(c.status).cls}"><span class="aw-badge-dot"></span>${_statusCfg(c.status).label}</span></div>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Scheduled</div>
            <div style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${c.scheduled_for ? _fmtDate(c.scheduled_for) : 'Immediately'}</div>
          </div>
        </div>
      </div>

      <div class="aw-stats-row" style="margin-bottom: var(--space-lg);">
        <div class="aw-stat" style="--stat-accent: var(--caci-blue-light); --stat-glow: rgba(0,75,160,0.1);">
          <div class="aw-stat-label">Total Recipients</div>
          <div class="aw-stat-value">${stats?.total || 0}</div>
        </div>
        <div class="aw-stat" style="--stat-accent: #22c55e; --stat-glow: rgba(34,197,94,0.1);">
          <div class="aw-stat-label">Delivered</div>
          <div class="aw-stat-value">${stats?.delivered || 0}</div>
        </div>
        <div class="aw-stat" style="--stat-accent: #e3b341; --stat-glow: rgba(227,179,65,0.1);">
          <div class="aw-stat-label">Read</div>
          <div class="aw-stat-value">${stats?.read || 0}</div>
        </div>
        <div class="aw-stat" style="--stat-accent: var(--caci-red); --stat-glow: rgba(198,0,38,0.1);">
          <div class="aw-stat-label">Failed</div>
          <div class="aw-stat-value">${stats?.failed || 0}</div>
        </div>
      </div>

      ${messages.length ? `
      <div class="aw-table-wrap">
        <div class="aw-table-header" style="grid-template-columns: 1fr 100px 100px;">
          <div class="aw-col-hd">Recipient ID</div>
          <div class="aw-col-hd">Status</div>
          <div class="aw-col-hd">Delivered</div>
        </div>
        <div class="aw-table-body">
          ${messages.slice(0, 100).map(m => `
            <div class="aw-table-row" style="grid-template-columns: 1fr 100px 100px;">
              <div class="aw-col-cell">Recipient ${m.recipient_id?.slice(0,8)}...</div>
              <div class="aw-col-cell"><span class="aw-badge ${['delivered', 'read'].includes(m.status) ? 'aw-badge-active' : m.status === 'failed' ? 'aw-badge-locked' : 'aw-badge-inactive'}">${m.status}</span></div>
              <div class="aw-col-cell" style="font-size:12px;color:var(--text-secondary);">${_fmtDate(m.delivered_at)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : `
      <div class="aw-table-wrap">
        <div class="aw-empty" style="padding:40px 16px;">
          <div class="aw-empty-icon-wrap"><i class="bi bi-inbox"></i></div>
          <p class="aw-empty-title">No messages yet</p>
        </div>
      </div>`}
    `

    this._container.innerHTML = ''
    this._container.appendChild(main)
    this._container.querySelector('#cw-camp-back-btn')?.addEventListener('click', () => {
      this.render(this._container!)
    })
  }
}
