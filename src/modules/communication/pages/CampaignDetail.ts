import type { PageModule } from '../../../types/module.types'
import { getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { CommunicationService } from '../services'
import type { Campaign } from '../schemas'

const CSS = /* css */`
.cd-page { padding: var(--space-xl) var(--space-2xl); max-width: 1000px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .cd-page { padding: var(--space-lg) var(--space-md); } }
.cd-hero { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: var(--space-lg); }
.cd-hero-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
.cd-hero-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: var(--space-md); }
.cd-info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-md); }
.cd-info-field { }
.cd-info-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px; }
.cd-info-value { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.cd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg); }
@media (max-width: 640px) { .cd-stats { grid-template-columns: repeat(2, 1fr); } }
.cd-stat { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-md); text-align: center; }
.cd-stat-value { font-size: 24px; font-weight: 700; color: var(--text-primary); }
.cd-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-top: 4px; }
.cd-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
.cd-msg-list { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); overflow: hidden; }
.cd-msg-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-default); }
.cd-msg-header span { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.cd-msg-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border-default); font-size: 12px; }
.cd-msg-row:last-child { border-bottom: none; }
.cd-msg-status { flex-shrink: 0; }
.cd-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; text-align: center; color: var(--text-secondary); }
.cd-empty i { font-size: 2rem; color: var(--border-strong); margin-bottom: var(--space-md); }
`

function _injectCSS(): void {
  if (document.getElementById('cd-css')) return
  const s = document.createElement('style')
  s.id = 'cd-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

function _fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

let _container: HTMLElement | null = null
let _campaign: Campaign | null = null
let _stats: { total: number; sent: number; delivered: number; read: number; failed: number } | null = null
let _messages: any[] = []
let _destroyed = false

const CampaignDetail: PageModule = {
  async render(container) {
    _container = container
    _destroyed = false
    const campaignId = container.dataset.id ?? ''
    if (!campaignId) {
      renderError(container, new Error('Campaign ID is required'))
      return
    }

    renderSkeleton(container, 'profile')
    _injectCSS()

    try {
      const [campaign, stats, messages] = await Promise.all([
        CommunicationService.getCampaign(campaignId),
        CommunicationService.getCampaignStats(campaignId),
        CommunicationService.getCampaignMessages(campaignId),
      ])
      if (_destroyed) return
      _campaign = campaign
      _stats = stats
      _messages = messages
    } catch (err) {
      if (_destroyed) return
      renderError(container, err, { retry: () => CampaignDetail.render(container) })
      return
    }

    _renderPage()
  },

  destroy() {
    _destroyed = true
    _container = null
    _campaign = null
    _stats = null
    _messages = []
  },
}

export default CampaignDetail

function _renderPage(): void {
  if (!_container || !_campaign || !_stats) return

  const c = _campaign
  const breadcrumbEl = document.createElement('div')
  breadcrumbEl.id = 'cd-breadcrumbs'
  _container.innerHTML = ''
  _container.appendChild(breadcrumbEl)

  const main = document.createElement('div')
  main.className = 'cd-page'
  main.innerHTML = `
<div class="cd-hero">
  <h1 class="cd-hero-title">${c.title}</h1>
  ${c.body ? `<p class="cd-hero-sub">${c.body}</p>` : ''}
  <div class="cd-info-grid">
    <div class="cd-info-field">
      <div class="cd-info-label">Channel</div>
      <div class="cd-info-value">${c.channel}</div>
    </div>
    <div class="cd-info-field">
      <div class="cd-info-label">Status</div>
      <div class="cd-info-value"><span class="cd-badge" style="background:${_statusBg(c.status)};border:1px solid ${_statusBorder(c.status)};color:${_statusColor(c.status)};">${c.status}</span></div>
    </div>
    <div class="cd-info-field">
      <div class="cd-info-label">Audience</div>
      <div class="cd-info-value">${c.audience_type}${c.total_recipients ? ` (${c.total_recipients} recipients)` : ''}</div>
    </div>
    <div class="cd-info-field">
      <div class="cd-info-label">Scheduled</div>
      <div class="cd-info-value">${c.scheduled_for ? _fmtDate(c.scheduled_for) : 'Immediately'}</div>
    </div>
    <div class="cd-info-field">
      <div class="cd-info-label">Created</div>
      <div class="cd-info-value">${_fmtDate(c.created_at)}</div>
    </div>
  </div>
</div>

<div class="cd-stats">
  <div class="cd-stat">
    <div class="cd-stat-value">${_stats.total}</div>
    <div class="cd-stat-label">Total</div>
  </div>
  <div class="cd-stat">
    <div class="cd-stat-value" style="color:var(--caci-blue-light);">${_stats.sent}</div>
    <div class="cd-stat-label">Sent</div>
  </div>
  <div class="cd-stat">
    <div class="cd-stat-value" style="color:#56d364;">${_stats.delivered}</div>
    <div class="cd-stat-label">Delivered</div>
  </div>
  <div class="cd-stat">
    <div class="cd-stat-value" style="color:#e3b341;">${_stats.read}</div>
    <div class="cd-stat-label">Read</div>
  </div>
</div>

${_messages.length ? `
<div class="cd-msg-list">
  <div class="cd-msg-header"><span>Messages (${_messages.length})</span></div>
  ${_messages.slice(0, 100).map(m => {
    const statusColors: Record<string, string> = {
      pending: 'var(--text-muted)', queued: 'var(--caci-blue-light)', sent: 'var(--caci-blue-light)',
      delivered: '#56d364', read: '#e3b341', failed: 'var(--caci-red)',
    }
    return `<div class="cd-msg-row">
      <span class="cd-msg-status" style="width:8px;height:8px;border-radius:50%;background:${statusColors[m.status] ?? 'var(--text-muted)'};display:inline-block;"></span>
      <span style="flex:1;color:var(--text-secondary);">Recipient ${m.recipient_id?.slice(0, 8)}…</span>
      <span class="cd-badge" style="font-size:10px;">${m.status}</span>
      ${m.delivered_at ? `<span style="color:var(--text-muted);font-size:11px;">${_fmtDate(m.delivered_at)}</span>` : ''}
      ${m.failed_reason ? `<span style="color:var(--caci-red);font-size:11px;" title="${m.failed_reason}">Failed</span>` : ''}
    </div>`
  }).join('')}
</div>` : `<div class="cd-empty"><i class="bi bi-inbox"></i><p>No messages yet for this campaign.</p></div>`}
`

  _container.appendChild(main)

  const backBtn = document.createElement('button')
  backBtn.className = 'gd-back'
  backBtn.innerHTML = '<i class="bi bi-arrow-left"></i> Back to Campaigns'
  backBtn.addEventListener('click', () => navigate('/communications/campaigns'))
  const breadcrumbEl2 = _container.querySelector('#cd-breadcrumbs')!
  breadcrumbEl2.appendChild(backBtn)
}

function _statusColor(status: string): string {
  switch (status) {
    case 'draft': return '#8b949e'
    case 'scheduled': return 'var(--caci-blue-light)'
    case 'sending': return '#e3b341'
    case 'sent': return '#56d364'
    case 'cancelled': return 'var(--caci-red)'
    default: return 'var(--text-muted)'
  }
}
function _statusBg(status: string): string {
  switch (status) {
    case 'draft': return 'rgba(139,148,158,0.1)'
    case 'scheduled': return 'rgba(0,75,160,0.08)'
    case 'sending': return 'rgba(227,179,65,0.1)'
    case 'sent': return 'rgba(34,197,94,0.08)'
    case 'cancelled': return 'rgba(198,0,38,0.06)'
    default: return 'var(--bg-hover)'
  }
}
function _statusBorder(status: string): string {
  switch (status) {
    case 'draft': return 'rgba(139,148,158,0.2)'
    case 'scheduled': return 'rgba(0,75,160,0.22)'
    case 'sending': return 'rgba(227,179,65,0.25)'
    case 'sent': return 'rgba(34,197,94,0.22)'
    case 'cancelled': return 'rgba(198,0,38,0.2)'
    default: return 'var(--border-default)'
  }
}
