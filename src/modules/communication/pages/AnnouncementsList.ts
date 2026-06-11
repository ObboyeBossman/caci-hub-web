import type { PageModule } from '../../../types/module.types'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { PERMISSIONS } from '@core/authorization/permissions'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { CommunicationService } from '../services'
import type { Announcement } from '../schemas'

const CSS = /* css */`
.al-page { padding: var(--space-xl) var(--space-2xl); max-width: 860px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .al-page { padding: var(--space-lg) var(--space-md); } }
.al-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.al-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.al-header-sub { font-size: var(--text-base); color: var(--text-secondary); margin-top: 2px; }
.al-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: var(--space-md); transition: border-color 0.2s; }
.al-card:hover { border-color: var(--border-strong); }
.al-card.pinned { border-left: 3px solid var(--caci-blue-light); }
.al-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); margin-bottom: var(--space-sm); }
.al-card-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
.al-card-meta { display: flex; align-items: center; gap: var(--space-sm); font-size: 11px; color: var(--text-muted); margin-bottom: var(--space-sm); flex-wrap: wrap; }
.al-card-body { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.al-card-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-md); }
.al-pin-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px; font-size: 10px; font-weight: 600; background: rgba(0,75,160,0.1); color: var(--caci-blue-light); }
.al-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; text-align: center; color: var(--text-secondary); }
.al-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
.al-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; height: 36px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-secondary); font-family: var(--font-sans); white-space: nowrap; transition: all 0.18s; }
.al-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.al-btn-primary { background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light)); border-color: transparent; color: #fff; font-weight: 600; box-shadow: 0 2px 10px rgba(0,75,160,0.3); }
.al-btn-primary:hover { color: #fff; }
.al-btn-sm { height: 28px; font-size: 11px; padding: 0 10px; }
.al-btn-danger { color: var(--caci-red); }
.al-btn-danger:hover { background: rgba(198,0,38,0.06); border-color: rgba(198,0,38,0.3); }
`

function _injectCSS(): void {
  if (document.getElementById('al-css')) return
  const s = document.createElement('style')
  s.id = 'al-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

function _fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

let _container: HTMLElement | null = null
let _announcements: Announcement[] = []
let _destroyed = false

const AnnouncementsList: PageModule = {
  async render(container) {
    _container = container
    _destroyed = false
    renderSkeleton(container, 'card')
    _injectCSS()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      renderError(container, new Error('No assembly selected'))
      return
    }

    try {
      _announcements = await CommunicationService.getAnnouncements(assemblyId)
    } catch (err) {
      renderError(container, err, { retry: () => AnnouncementsList.render(container) })
      return
    }

    if (_destroyed) return
    _renderPage()
    _bindEvents()
  },

  destroy() {
    _destroyed = true
    _container = null
    _announcements = []
  },
}

export default AnnouncementsList

function _renderPage(): void {
  if (!_container) return
  const user = getCurrentUser()
  const canManage = user ? can(user, PERMISSIONS.COMMS_ANNOUNCEMENTS_MANAGE) : false

  _container.innerHTML = `
<div class="al-page">
  <div class="al-header">
    <div>
      <h2>Announcements</h2>
      <div class="al-header-sub">Current assembly announcements and notices</div>
    </div>
    ${canManage ? `<button class="al-btn al-btn-primary" id="al-newBtn"><i class="bi bi-plus-lg"></i> New Announcement</button>` : ''}
  </div>
  ${_announcements.length ? `
  <div id="al-list">
    ${_announcements.map(a => `
      <div class="al-card ${a.is_pinned ? 'pinned' : ''}" data-ann-id="${a.id}">
        <div class="al-card-header">
          <h3 class="al-card-title">${a.title}</h3>
          ${a.is_pinned ? '<span class="al-pin-badge"><i class="bi bi-pin-fill"></i> Pinned</span>' : ''}
        </div>
        <div class="al-card-meta">
          <span>${_fmtDate(a.visible_from)}</span>
          ${a.visible_until ? `<span>→ ${_fmtDate(a.visible_until)}</span>` : ''}
        </div>
        <div class="al-card-body">${a.body}</div>
        ${canManage ? `
        <div class="al-card-actions">
          <button class="al-btn al-btn-sm" data-ann-edit="${a.id}"><i class="bi bi-pencil"></i> Edit</button>
          <button class="al-btn al-btn-sm al-btn-danger" data-ann-delete="${a.id}"><i class="bi bi-trash"></i> Delete</button>
        </div>` : ''}
      </div>
    `).join('')}
  </div>` : `
  <div class="al-empty">
    <i class="bi bi-bullhorn"></i>
    <p>No announcements right now. Check back later!</p>
    ${canManage ? `<button class="al-btn al-btn-primary" id="al-emptyNewBtn"><i class="bi bi-plus-lg"></i> Create Announcement</button>` : ''}
  </div>`}
</div>`
}

function _bindEvents(): void {
  if (!_container) return
  _container.querySelector('#al-newBtn')?.addEventListener('click', () => _openCreateModal())
  _container.querySelector('#al-emptyNewBtn')?.addEventListener('click', () => _openCreateModal())

  _container.querySelectorAll<HTMLElement>('[data-ann-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _openEditModal(btn.dataset['annEdit']!) })
  })

  _container.querySelectorAll<HTMLElement>('[data-ann-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const id = btn.dataset['annDelete']!
      if (!confirm('Delete this announcement?')) return
      try {
        await CommunicationService.deleteAnnouncement(id)
        Toast.success('Announcement deleted')
        _announcements = _announcements.filter(a => a.id !== id)
        _renderPage()
        _bindEvents()
      } catch (err) {
        Toast.fromError(err)
      }
    })
  })
}

function _openCreateModal(): void {
  const title = prompt('Announcement title:')
  if (!title) return
  const body = prompt('Announcement body:')
  if (!body) return

  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return

  CommunicationService.createAnnouncement({
    assembly_id: assemblyId,
    title,
    body,
    visibility_type: 'all',
    is_pinned: false,
    visible_from: new Date().toISOString(),
    visible_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).then(() => {
    Toast.success('Announcement created')
    AnnouncementsList.render(_container!)
  }).catch(err => Toast.fromError(err))
}

function _openEditModal(id: string): void {
  const ann = _announcements.find(a => a.id === id)
  if (!ann) return
  const title = prompt('Announcement title:', ann.title)
  if (!title) return
  const body = prompt('Announcement body:', ann.body)
  if (!body) return

  CommunicationService.updateAnnouncement(id, { title, body })
    .then(() => {
      Toast.success('Announcement updated')
      AnnouncementsList.render(_container!)
    }).catch(err => Toast.fromError(err))
}
