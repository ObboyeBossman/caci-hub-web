// src/modules/communication/tabs/HubTab.ts
import type { WorkspaceTab } from '../workspace/CommunicationWorkspaceShell'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { CommunicationService } from '../services/communication.service'
import { StatsCardGroup } from '../widgets/communicationWidgets'

const CSS = /* css */`
.ch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); margin-top: var(--space-xl); }
.ch-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); cursor: pointer; transition: all 0.2s; }
.ch-card:hover { border-color: var(--caci-blue); box-shadow: 0 4px 20px rgba(0,75,160,0.15); transform: translateY(-2px); }
.ch-card-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-md); }
.ch-card-icon i { font-size: 20px; }
.ch-card-title { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.ch-card-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
`

let _cssInjected = false
function _injectCSS() {
  if (_cssInjected) return
  _cssInjected = true
  const s = document.createElement('style')
  s.textContent = CSS
  document.head.appendChild(s)
}

export class HubTab implements WorkspaceTab {
  readonly id = 'hub'
  readonly label = 'Overview'
  readonly icon = 'grid-fill'
  readonly permission = 'communications.reports.view'

  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    const user = getCurrentUser()
    const assemblyId = getActiveAssemblyId()

    if (!user || !assemblyId) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">Please select an assembly.</div>`
      return
    }

    let campaigns: any[] = [], announcements: any[] = [], templates: any[] = []
    try {
      ;[campaigns, announcements, templates] = await Promise.all([
        CommunicationService.getCampaigns(assemblyId),
        CommunicationService.getAnnouncements(assemblyId),
        CommunicationService.getTemplates(assemblyId),
      ])
    } catch (e) {
      console.error('[HubTab] data load err', e)
    }

    const _campaignCount = campaigns.length
    const _sentCount = campaigns.filter(c => c.status === 'sent').length
    const _activeAnnouncements = announcements.length
    const _templateCount = templates.length

    container.innerHTML = `
      <div style="padding:var(--space-xl) 0;">
        <div id="hub-stats-wrap"></div>
        <div class="ch-grid" id="hub-cards-wrap"></div>
      </div>
    `

    const statsWrap = container.querySelector('#hub-stats-wrap')!
    new StatsCardGroup(statsWrap as HTMLElement, [
      { id: 'sent', label: 'Campaigns Sent', icon: 'megaphone-fill', accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)', getValue: () => _sentCount },
      { id: 'announcements', label: 'Active Announcements', icon: 'bullhorn-fill', accentColor: '#22c55e', glowColor: 'rgba(34,197,94,0.1)', getValue: () => _activeAnnouncements },
      { id: 'templates', label: 'Templates', icon: 'file-earmark-text-fill', accentColor: '#e3b341', glowColor: 'rgba(227,179,65,0.1)', getValue: () => _templateCount },
      { id: 'total', label: 'Total Campaigns', icon: 'megaphone-fill', accentColor: '#a78bfa', glowColor: 'rgba(124,58,237,0.1)', getValue: () => _campaignCount },
    ], () => {})

    const canBroadcast = can(user, PERMISSIONS.COMMS_BROADCAST_SEND)
    const canMessage = can(user, PERMISSIONS.COMMS_DIRECT_SEND)
    const canAnnounce = can(user, PERMISSIONS.COMMS_ANNOUNCEMENTS_MANAGE)
    const canTemplates = can(user, PERMISSIONS.COMMS_TEMPLATES_MANAGE)

    let cardsHtml = ''
    if (canBroadcast) {
      cardsHtml += `
        <div class="ch-card" data-nav-tab="campaigns">
          <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);"><i class="bi bi-megaphone-fill" style="color:var(--caci-blue-light);"></i></div>
          <div class="ch-card-title">Campaigns</div>
          <div class="ch-card-desc">Create and manage broadcast campaigns.</div>
        </div>
      `
    }
    if (canMessage) {
      cardsHtml += `
        <div class="ch-card" data-nav-tab="messages">
          <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);"><i class="bi bi-chat-dots-fill" style="color:var(--caci-blue-light);"></i></div>
          <div class="ch-card-title">Messages</div>
          <div class="ch-card-desc">View and manage direct message threads.</div>
        </div>
      `
    }
    if (canAnnounce) {
      cardsHtml += `
        <div class="ch-card" data-nav-tab="announcements">
          <div class="ch-card-icon" style="background:rgba(227,179,65,0.1);"><i class="bi bi-bullhorn-fill" style="color:#e3b341;"></i></div>
          <div class="ch-card-title">Announcements</div>
          <div class="ch-card-desc">Create and manage targeted announcements.</div>
        </div>
      `
    }
    if (canTemplates) {
      cardsHtml += `
        <div class="ch-card" data-nav-tab="templates">
          <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);"><i class="bi bi-file-earmark-text-fill" style="color:var(--caci-blue-light);"></i></div>
          <div class="ch-card-title">Templates</div>
          <div class="ch-card-desc">Design reusable messaging templates.</div>
        </div>
      `
    }

    container.querySelector('#hub-cards-wrap')!.innerHTML = cardsHtml

    container.querySelectorAll<HTMLElement>('[data-nav-tab]').forEach(card => {
      card.addEventListener('click', () => {
        const t = card.dataset['navTab']
        document.querySelector<HTMLButtonElement>(`button[data-tab-id="${t}"]`)?.click()
      })
    })
  }
}
