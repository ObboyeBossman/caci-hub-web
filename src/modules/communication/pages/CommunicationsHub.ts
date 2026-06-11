import type { PageModule } from '../../../types/module.types'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { navigate } from '@core/router'
import { renderSkeleton } from '@shared/utils/pageHelpers'
import { CommunicationService } from '../services'

const CSS = /* css */`
.ch-page { padding: var(--space-xl) var(--space-2xl); max-width: 1200px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .ch-page { padding: var(--space-lg) var(--space-md); } }
.ch-header { margin-bottom: var(--space-xl); }
.ch-header h1 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.ch-header p { font-size: var(--text-base); color: var(--text-secondary); margin-top: 4px; }
.ch-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl); }
.ch-stat-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-md); transition: border-color 0.2s, transform 0.2s; }
.ch-stat-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
.ch-stat-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.ch-stat-icon i { font-size: 16px; }
.ch-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 4px; }
.ch-stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
.ch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); }
.ch-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); cursor: pointer; transition: all 0.2s; }
.ch-card:hover { border-color: var(--caci-blue); box-shadow: 0 4px 20px rgba(0,75,160,0.15); transform: translateY(-2px); }
.ch-card-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-md); }
.ch-card-icon i { font-size: 20px; }
.ch-card-title { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.ch-card-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
`

function _injectCSS(): void {
  if (document.getElementById('ch-css')) return
  const s = document.createElement('style')
  s.id = 'ch-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

let _container: HTMLElement | null = null
let _campaignCount = 0
let _sentCount = 0
let _activeAnnouncements = 0
let _templateCount = 0

const CommunicationsHub: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'card')
    _injectCSS()

    const user = getCurrentUser()
    const assemblyId = getActiveAssemblyId()
    if (!user || !assemblyId) {
      container.innerHTML = `<div class="ch-page"><p>Please select an assembly.</p></div>`
      return
    }

    try {
      const [campaigns, announcements, templates] = await Promise.all([
        CommunicationService.getCampaigns(assemblyId),
        CommunicationService.getAnnouncements(assemblyId),
        CommunicationService.getTemplates(assemblyId),
      ])
      _campaignCount = campaigns.length
      _sentCount = campaigns.filter(c => c.status === 'sent').length
      _activeAnnouncements = announcements.length
      _templateCount = templates.length
    } catch (err) {
      _campaignCount = 0; _sentCount = 0; _activeAnnouncements = 0; _templateCount = 0
    }

    const canBroadcast = can(user, PERMISSIONS.COMMS_BROADCAST_SEND)
    const canAudio = can(user, PERMISSIONS.COMMS_AUDIO_BROADCAST)
    const canMessage = can(user, PERMISSIONS.COMMS_DIRECT_SEND)
    const canAnnounce = can(user, PERMISSIONS.COMMS_ANNOUNCEMENTS_MANAGE)
    const canTemplates = can(user, PERMISSIONS.COMMS_TEMPLATES_MANAGE)

    container.innerHTML = `
<div class="ch-page">
  <div class="ch-header">
    <h1>Communications</h1>
    <p>Send broadcasts, manage announcements, and connect with your assembly.</p>
  </div>

  <div class="ch-stats">
    <div class="ch-stat-card">
      <div class="ch-stat-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-megaphone-fill" style="color:var(--caci-blue-light);"></i>
      </div>
      <div class="ch-stat-label">Campaigns Sent</div>
      <div class="ch-stat-value">${_sentCount}</div>
    </div>
    <div class="ch-stat-card">
      <div class="ch-stat-icon" style="background:rgba(34,197,94,0.1);">
        <i class="bi bi-bullhorn-fill" style="color:#56d364;"></i>
      </div>
      <div class="ch-stat-label">Active Announcements</div>
      <div class="ch-stat-value">${_activeAnnouncements}</div>
    </div>
    <div class="ch-stat-card">
      <div class="ch-stat-icon" style="background:rgba(227,179,65,0.1);">
        <i class="bi bi-file-earmark-text-fill" style="color:#e3b341;"></i>
      </div>
      <div class="ch-stat-label">Templates</div>
      <div class="ch-stat-value">${_templateCount}</div>
    </div>
    <div class="ch-stat-card">
      <div class="ch-stat-icon" style="background:rgba(124,58,237,0.1);">
        <i class="bi bi-megaphone-fill" style="color:#a78bfa;"></i>
      </div>
      <div class="ch-stat-label">Total Campaigns</div>
      <div class="ch-stat-value">${_campaignCount}</div>
    </div>
  </div>

  <div class="ch-grid">
    ${canBroadcast ? `
    <div class="ch-card" data-nav="/communications/campaigns">
      <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-megaphone-fill" style="color:var(--caci-blue-light);"></i>
      </div>
      <div class="ch-card-title">Campaigns</div>
      <div class="ch-card-desc">Create and manage broadcast campaigns to reach your assembly.</div>
    </div>` : ''}
    ${canBroadcast ? `
    <div class="ch-card" data-nav="/communications/broadcast">
      <div class="ch-card-icon" style="background:rgba(34,197,94,0.1);">
        <i class="bi bi-send-fill" style="color:#56d364;"></i>
      </div>
      <div class="ch-card-title">New Broadcast</div>
      <div class="ch-card-desc">Compose and send a new broadcast message to your assembly.</div>
    </div>` : ''}
    ${canAudio ? `
    <div class="ch-card" data-nav="/communications/audio-broadcast">
      <div class="ch-card-icon" style="background:rgba(124,58,237,0.1);">
        <i class="bi bi-mic-fill" style="color:#a78bfa;"></i>
      </div>
      <div class="ch-card-title">Audio Broadcast</div>
      <div class="ch-card-desc">Record and broadcast audio messages to your assembly.</div>
    </div>` : ''}
    ${canMessage ? `
    <div class="ch-card" data-nav="/communications/messages">
      <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-chat-dots-fill" style="color:var(--caci-blue-light);"></i>
      </div>
      <div class="ch-card-title">Messages</div>
      <div class="ch-card-desc">View and manage direct message conversations.</div>
    </div>` : ''}
    ${canAnnounce ? `
    <div class="ch-card" data-nav="/communications/announcements">
      <div class="ch-card-icon" style="background:rgba(227,179,65,0.1);">
        <i class="bi bi-bullhorn-fill" style="color:#e3b341;"></i>
      </div>
      <div class="ch-card-title">Announcements</div>
      <div class="ch-card-desc">Create and manage assembly announcements.</div>
    </div>` : ''}
    ${canTemplates ? `
    <div class="ch-card" data-nav="/communications/templates">
      <div class="ch-card-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-file-earmark-text-fill" style="color:var(--caci-blue-light);"></i>
      </div>
      <div class="ch-card-title">Templates</div>
      <div class="ch-card-desc">Create reusable message templates for broadcasts.</div>
    </div>` : ''}
  </div>
</div>`

    container.querySelectorAll<HTMLElement>('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset['nav']!))
    })
  },

  destroy() {
    _container = null
  },
}

export default CommunicationsHub
