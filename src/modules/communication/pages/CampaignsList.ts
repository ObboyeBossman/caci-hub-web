import type { PageModule } from '../../../types/module.types'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { CommunicationService } from '../services'
import type { Campaign } from '../schemas'

const CSS = /* css */`
.cl-page { padding: var(--space-xl) var(--space-2xl); max-width: 1200px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .cl-page { padding: var(--space-lg) var(--space-md); } }
.cl-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.cl-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.cl-header-sub { font-size: var(--text-base); color: var(--text-secondary); margin-top: 2px; }
.cl-toolbar { display: flex; align-items: center; gap: var(--space-sm); background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 10px var(--space-md); margin-bottom: var(--space-md); flex-wrap: wrap; }
.cl-search-wrap { display: flex; align-items: center; gap: 8px; background: var(--bg-page); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0 12px; height: 36px; flex: 1; min-width: 180px; max-width: 300px; transition: border-color 0.2s; }
.cl-search-wrap:focus-within { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
.cl-search-wrap i { font-size: 14px; color: var(--text-muted); flex-shrink: 0; }
.cl-search-wrap input { background: transparent; border: none; outline: none; font-size: 13px; color: var(--text-primary); font-family: var(--font-sans); width: 100%; }
.cl-filter-select { appearance: none; height: 36px; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-primary); font-size: 12px; font-family: var(--font-sans); font-weight: 500; cursor: pointer; outline: none; padding: 0 28px 0 10px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
.cl-table { width: 100%; border-collapse: collapse; }
.cl-table th { text-align: left; padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); border-bottom: 1px solid var(--border-default); }
.cl-table td { padding: 12px 14px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border-default); }
.cl-table tr { cursor: pointer; transition: background 0.12s; }
.cl-table tr:hover { background: var(--bg-hover); }
.cl-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
.cl-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; text-align: center; color: var(--text-secondary); }
.cl-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
.cl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; height: 36px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-secondary); font-family: var(--font-sans); white-space: nowrap; transition: all 0.18s; }
.cl-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.cl-btn-primary { background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light)); border-color: transparent; color: #fff; font-weight: 600; box-shadow: 0 2px 10px rgba(0,75,160,0.3); }
.cl-btn-primary:hover { color: #fff; box-shadow: 0 6px 20px rgba(0,75,160,0.4); }
`

function _injectCSS(): void {
  if (document.getElementById('cl-css')) return
  const s = document.createElement('style')
  s.id = 'cl-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

function _statusCfg(status: string) {
  switch (status) {
    case 'draft':     return { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', border: 'rgba(139,148,158,0.2)', icon: 'bi-pencil-fill' }
    case 'scheduled': return { color: 'var(--caci-blue-light)', bg: 'rgba(0,75,160,0.08)', border: 'rgba(0,75,160,0.22)', icon: 'bi-clock-fill' }
    case 'sending':   return { color: '#e3b341', bg: 'rgba(227,179,65,0.1)', border: 'rgba(227,179,65,0.25)', icon: 'bi-send-fill' }
    case 'sent':      return { color: '#56d364', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', icon: 'bi-check-circle-fill' }
    case 'cancelled': return { color: 'var(--caci-red)', bg: 'rgba(198,0,38,0.06)', border: 'rgba(198,0,38,0.2)', icon: 'bi-x-circle-fill' }
    default:          return { color: 'var(--text-muted)', bg: 'var(--bg-hover)', border: 'var(--border-default)', icon: 'bi-question-circle' }
  }
}

function _channelBadge(channel: string) {
  const icons: Record<string, string> = {
    in_app: 'bi-phone-fill',
    email: 'bi-envelope-fill',
    sms: 'bi-chat-dots-fill',
    push: 'bi-bell-fill',
    audio: 'bi-mic-fill',
  }
  const labels: Record<string, string> = {
    in_app: 'In-App',
    email: 'Email',
    sms: 'SMS',
    push: 'Push',
    audio: 'Audio',
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary);">
    <i class="bi ${icons[channel] ?? 'bi-question-circle'}"></i> ${labels[channel] ?? channel}
  </span>`
}

function _fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

let _container: HTMLElement | null = null
let _campaigns: Campaign[] = []
let _filtered: Campaign[] = []
let _searchDebounce: ReturnType<typeof setTimeout> | null = null

const CampaignsList: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'table')
    _injectCSS()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      renderError(container, new Error('No assembly selected'))
      return
    }

    try {
      _campaigns = await CommunicationService.getCampaigns(assemblyId)
      _filtered = _campaigns
    } catch (err) {
      renderError(container, err, { retry: () => CampaignsList.render(container) })
      return
    }

    const user = getCurrentUser()
    const canCreate = user ? can(user, PERMISSIONS.COMMS_BROADCAST_SEND) : false

    container.innerHTML = `
<div class="cl-page">
  <div class="cl-header">
    <div>
      <h2>Campaigns</h2>
      <div class="cl-header-sub">Manage broadcast campaigns</div>
    </div>
    ${canCreate ? `<button class="cl-btn cl-btn-primary" id="cl-newBtn"><i class="bi bi-plus-lg"></i> New Campaign</button>` : ''}
  </div>

  <div class="cl-toolbar">
    <div class="cl-search-wrap">
      <i class="bi bi-search"></i>
      <input type="text" id="cl-search" placeholder="Search campaigns…" autocomplete="off">
    </div>
    <select class="cl-filter-select" id="cl-status-filter">
      <option value="all">All statuses</option>
      <option value="draft">Draft</option>
      <option value="scheduled">Scheduled</option>
      <option value="sending">Sending</option>
      <option value="sent">Sent</option>
      <option value="cancelled">Cancelled</option>
    </select>
    <span style="font-size:12px;color:var(--text-muted);margin-left:auto;"><span id="cl-count">${_filtered.length}</span> campaigns</span>
  </div>

  <div id="cl-list">
    ${_renderTable()}
  </div>
</div>`

    _bindEvents()
  },

  destroy() {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _container = null
    _campaigns = []
    _filtered = []
  },
}

export default CampaignsList

function _renderTable(): string {
  if (!_filtered.length) {
    return `<div class="cl-empty"><i class="bi bi-megaphone"></i><p>No campaigns found. Create your first broadcast to get started.</p></div>`
  }

  return `
<div style="background:var(--bg-card);border:1px solid var(--border-default);border-radius:var(--radius-lg);overflow:hidden;">
  <table class="cl-table">
    <thead>
      <tr>
        <th>Title</th>
        <th>Channel</th>
        <th>Status</th>
        <th>Recipients</th>
        <th>Scheduled</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${_filtered.map(c => {
        const sc = _statusCfg(c.status)
        return `<tr data-camp-id="${c.id}">
          <td style="font-weight:600;">${c.title}</td>
          <td>${_channelBadge(c.channel)}</td>
          <td><span class="cl-badge" style="background:${sc.bg};border:1px solid ${sc.border};color:${sc.color};"><i class="bi ${sc.icon}" style="font-size:10px;"></i> ${c.status}</span></td>
          <td>${c.total_recipients}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${c.scheduled_for ? _fmtDate(c.scheduled_for) : '—'}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${_fmtDate(c.created_at)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>
</div>`
}

function _applyFilters(): void {
  const searchVal = _container?.querySelector<HTMLInputElement>('#cl-search')?.value.trim().toLowerCase() ?? ''
  const statusVal = _container?.querySelector<HTMLSelectElement>('#cl-status-filter')?.value ?? 'all'

  _filtered = _campaigns.filter(c => {
    if (statusVal !== 'all' && c.status !== statusVal) return false
    if (searchVal && !c.title.toLowerCase().includes(searchVal)) return false
    return true
  })

  const listEl = _container?.querySelector('#cl-list')
  if (listEl) listEl.innerHTML = _renderTable()
  const countEl = _container?.querySelector('#cl-count')
  if (countEl) countEl.textContent = String(_filtered.length)
  _bindRowClicks()
}

function _bindRowClicks(): void {
  if (!_container) return
  _container.querySelectorAll<HTMLElement>('[data-camp-id]').forEach(row => {
    row.addEventListener('click', () => navigate(`/communications/campaigns/${row.dataset['campId']}`))
  })
}

function _bindEvents(): void {
  if (!_container) return
  _bindRowClicks()

  _container.querySelector('#cl-newBtn')?.addEventListener('click', () => navigate('/communications/broadcast'))

  _container.querySelector<HTMLInputElement>('#cl-search')?.addEventListener('input', () => {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _searchDebounce = setTimeout(_applyFilters, 200)
  })

  _container.querySelector<HTMLSelectElement>('#cl-status-filter')?.addEventListener('change', _applyFilters)
}
