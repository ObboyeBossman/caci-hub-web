// src/modules/communication/tabs/HubTab.ts

import type { WorkspaceTab }   from '../workspace/CommunicationWorkspaceShell'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }                 from '@core/authorization/authorization-service'
import { StatsCardGroup, type StatCardConfig } from '../widgets/communicationWidgets'
import { CommunicationService } from '../services/communication.service'
import type { Campaign }        from '../schemas/communication'

// ─── CSS ─────────────────────────────────────────────────────────────────────

const HUB_CSS = /* css */`
.chub-quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-xl);
}
.chub-qcard {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column; gap: 10px;
}
.chub-qcard:hover {
  border-color: var(--caci-blue);
  box-shadow: 0 4px 22px rgba(0,75,160,0.15);
  transform: translateY(-2px);
}
.chub-qcard-icon {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
}
.chub-qcard-icon i { font-size: 20px; }
.chub-qcard-title  { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.chub-qcard-desc   { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0; }
.chub-section-hd {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
  margin: var(--space-xl) 0 var(--space-md);
  display: flex; align-items: center; gap: 10px;
}
.chub-section-hd::after {
  content: ''; flex: 1; height: 1px; background: var(--border-default);
}
.chub-recent-row {
  display: flex; align-items: center; gap: var(--space-md);
  padding: 10px var(--space-md);
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); margin-bottom: 6px; cursor: pointer;
  transition: border-color 0.15s;
}
.chub-recent-row:hover { border-color: var(--border-strong); }
.chub-recent-title {
  flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary);
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chub-recent-ch {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 8px; border-radius: 99px;
  background: rgba(0,75,160,0.1); color: var(--caci-blue-light); flex-shrink: 0;
}
.chub-recent-date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.chub-status-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
`

let _hubCSSInjected = false
function _injectCSS(): void {
  if (_hubCSSInjected) return
  _hubCSSInjected = true
  const s = document.createElement('style')
  s.id = 'chub-tab-css'
  s.textContent = HUB_CSS
  document.head.appendChild(s)
}

function _fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class HubTab implements WorkspaceTab {
  readonly id    = 'hub'
  readonly label = 'Overview'
  readonly icon  = 'grid-fill'
  // No permission — always shown; inner cards filter themselves

  private _container: HTMLElement | null = null
  private _destroyed  = false

  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    this._container = container
    this._destroyed  = false

    const user       = getCurrentUser()
    const assemblyId = getActiveAssemblyId()

    if (!user || !assemblyId) {
      container.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-secondary);">Please sign in to continue.</div>`
      return
    }

    // Skeleton
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-md);margin-bottom:var(--space-xl);">
        ${[1,2,3,4].map(() => `<div style="height:100px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-default);animation:awsFadeIn 0.3s both;"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:var(--space-md);">
        ${[1,2,3,4].map(() => `<div style="height:120px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-default);"></div>`).join('')}
      </div>`

    let campaigns:     Campaign[] = []
    let announcements: any[]      = []
    let templates:     any[]      = []

    try {
      ;[campaigns, announcements, templates] = await Promise.all([
        CommunicationService.getCampaigns(assemblyId),
        CommunicationService.getAnnouncements(assemblyId),
        CommunicationService.getTemplates(assemblyId),
      ])
    } catch (err) {
      console.error('[HubTab] load error', err)
    }

    if (this._destroyed) return

    const sentCount   = campaigns.filter(c => c.status === 'sent').length
    const draftCount  = campaigns.filter(c => c.status === 'draft').length
    const recent      = campaigns.slice(0, 5)

    const canBroadcast  = can(user, 'communications.broadcast.send'      as any)
    const canMessage    = can(user, 'communications.direct.send'          as any)
    const canAnnounce   = can(user, 'communications.announcements.manage' as any)
    const canTemplates  = can(user, 'communications.templates.manage'     as any)
    const canAudio      = can(user, 'communications.audio.broadcast'      as any)

    container.innerHTML = `
      <div id="chub-stats"></div>
      <div class="chub-quick-grid" id="chub-cards"></div>
      ${recent.length ? `
        <div class="chub-section-hd">Recent Campaigns</div>
        <div id="chub-recent"></div>` : ''}`

    // ── Stats ──────────────────────────────────────────────────────────────
    const stats: StatCardConfig[] = [
      {
        id: 'sent', label: 'Campaigns Sent', icon: 'megaphone-fill',
        accentColor: 'var(--caci-blue-light)', glowColor: 'rgba(0,75,160,0.1)',
        getValue: () => sentCount,
      },
      {
        id: 'announcements', label: 'Announcements', icon: 'bullhorn-fill',
        accentColor: '#22c55e', glowColor: 'rgba(34,197,94,0.1)',
        getValue: () => announcements.length,
      },
      {
        id: 'templates', label: 'Templates', icon: 'file-earmark-text-fill',
        accentColor: '#e3b341', glowColor: 'rgba(227,179,65,0.1)',
        getValue: () => templates.length,
      },
      {
        id: 'drafts', label: 'Draft Campaigns', icon: 'pencil-square',
        accentColor: '#a78bfa', glowColor: 'rgba(124,58,237,0.1)',
        getValue: () => draftCount,
      },
    ]
    new StatsCardGroup(
      container.querySelector('#chub-stats') as HTMLElement,
      stats,
      (filterId) => {
        if (filterId === 'sent' || filterId === 'drafts') {
          document.querySelector<HTMLButtonElement>('button[data-tab-id="campaigns"]')?.click()
        }
      },
    )

    // ── Quick cards ────────────────────────────────────────────────────────
    type Card = { tab: string; icon: string; iconBg: string; iconColor: string; title: string; desc: string }
    const cards: Card[] = []

    if (canBroadcast)  cards.push({ tab: 'campaigns',     icon: 'megaphone-fill',        iconBg: 'rgba(0,75,160,0.1)',    iconColor: 'var(--caci-blue-light)', title: 'Campaigns',       desc: 'Create and manage broadcast campaigns across all channels.' })
    if (canMessage)    cards.push({ tab: 'messages',      icon: 'chat-dots-fill',         iconBg: 'rgba(0,75,160,0.1)',    iconColor: 'var(--caci-blue-light)', title: 'Messages',        desc: 'View and reply to your direct message threads.' })
    if (canAnnounce)   cards.push({ tab: 'announcements', icon: 'bullhorn-fill',           iconBg: 'rgba(34,197,94,0.1)',   iconColor: '#22c55e',               title: 'Announcements',   desc: 'Post notices and announcements to your assembly.' })
    if (canTemplates)  cards.push({ tab: 'templates',     icon: 'file-earmark-text-fill', iconBg: 'rgba(227,179,65,0.1)', iconColor: '#e3b341',               title: 'Templates',       desc: 'Design reusable message templates for broadcasts.' })
    if (canAudio)      cards.push({ tab: 'audio',         icon: 'mic-fill',               iconBg: 'rgba(198,0,38,0.1)',    iconColor: 'var(--caci-red)',        title: 'Audio Broadcast', desc: 'Record and broadcast audio messages to your assembly.' })

    const cardsEl = container.querySelector('#chub-cards')!
    cardsEl.innerHTML = cards.map(c => `
      <div class="chub-qcard" data-nav="${c.tab}">
        <div class="chub-qcard-icon" style="background:${c.iconBg};">
          <i class="bi bi-${c.icon}" style="color:${c.iconColor};"></i>
        </div>
        <p class="chub-qcard-title">${c.title}</p>
        <p class="chub-qcard-desc">${c.desc}</p>
      </div>`).join('')

    cardsEl.querySelectorAll<HTMLElement>('[data-nav]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelector<HTMLButtonElement>(`button[data-tab-id="${card.dataset['nav']}"]`)?.click()
      })
    })

    // ── Recent campaigns ───────────────────────────────────────────────────
    const recentEl = container.querySelector('#chub-recent')
    if (recentEl && recent.length) {
      const statusColor: Record<string, string> = {
        sent: '#22c55e', failed: 'var(--caci-red)', scheduled: '#e3b341',
        sending: 'var(--caci-blue-light)', draft: 'var(--text-muted)', cancelled: 'var(--text-muted)',
      }
      recentEl.innerHTML = recent.map(c => `
        <div class="chub-recent-row" data-camp-nav>
          <div class="chub-status-dot" style="background:${statusColor[c.status] ?? 'var(--text-muted)'}"></div>
          <span class="chub-recent-ch">${c.channel}</span>
          <span class="chub-recent-title">${c.title}</span>
          <span style="font-size:11px;font-weight:600;color:${statusColor[c.status] ?? 'var(--text-muted)'};">${c.status}</span>
          <span class="chub-recent-date">${_fmtDate(c.created_at)}</span>
        </div>`).join('')

      recentEl.querySelectorAll('[data-camp-nav]').forEach(row => {
        row.addEventListener('click', () => {
          document.querySelector<HTMLButtonElement>('button[data-tab-id="campaigns"]')?.click()
        })
      })
    }
  }

  destroy(): void {
    this._destroyed = true
    this._container = null
  }
}