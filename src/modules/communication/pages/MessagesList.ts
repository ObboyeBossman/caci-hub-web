import type { PageModule } from '../../../types/module.types'
import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { CommunicationService } from '../services'
import type { MessageThread } from '../schemas'

const CSS = /* css */`
.ml-page { padding: var(--space-xl) var(--space-2xl); max-width: 900px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .ml-page { padding: var(--space-lg) var(--space-md); } }
.ml-header { margin-bottom: var(--space-lg); }
.ml-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.ml-header p { font-size: var(--text-base); color: var(--text-secondary); margin-top: 4px; }
.ml-list { display: flex; flex-direction: column; gap: 6px; }
.ml-thread { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-md); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: var(--space-md); }
.ml-thread:hover { border-color: var(--border-strong); transform: translateX(4px); }
.ml-thread-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ml-thread-icon i { font-size: 18px; }
.ml-thread-info { flex: 1; min-width: 0; }
.ml-thread-title { font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-thread-type { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }
.ml-thread-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.ml-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; text-align: center; color: var(--text-secondary); }
.ml-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
`

function _injectCSS(): void {
  if (document.getElementById('ml-css')) return
  const s = document.createElement('style')
  s.id = 'ml-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

function _fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  const now = new Date()
  const isToday = dt.toDateString() === now.toDateString()
  if (isToday) return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function _threadIcon(type: string): string {
  switch (type) {
    case 'pastoral': return 'bi-heart-fill'
    case 'support': return 'bi-question-circle-fill'
    default: return 'bi-chat-dots-fill'
  }
}

function _threadColor(type: string): string {
  switch (type) {
    case 'pastoral': return '#e3b341'
    case 'support': return '#a78bfa'
    default: return 'var(--caci-blue-light)'
  }
}

function _threadBg(type: string): string {
  switch (type) {
    case 'pastoral': return 'rgba(227,179,65,0.1)'
    case 'support': return 'rgba(124,58,237,0.1)'
    default: return 'rgba(0,75,160,0.1)'
  }
}

let _container: HTMLElement | null = null
let _threads: MessageThread[] = []

const MessagesList: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'table')
    _injectCSS()

    try {
      const memberId = await CommunicationService.getMemberId()
      if (!memberId) {
        renderError(container, new Error('Could not identify your member profile'))
        return
      }
      _threads = await CommunicationService.getThreads(memberId)
    } catch (err) {
      renderError(container, err, { retry: () => MessagesList.render(container) })
      return
    }

    container.innerHTML = `
<div class="ml-page">
  <div class="ml-header">
    <h2>Messages</h2>
    <p>Your direct message conversations.</p>
  </div>
  ${_threads.length ? `
  <div class="ml-list">
    ${_threads.map(t => `
      <div class="ml-thread" data-thread-id="${t.id}">
        <div class="ml-thread-icon" style="background:${_threadBg(t.thread_type)};">
          <i class="bi ${_threadIcon(t.thread_type)}" style="color:${_threadColor(t.thread_type)};"></i>
        </div>
        <div class="ml-thread-info">
          <div class="ml-thread-title">${t.title}</div>
          <div class="ml-thread-type">${t.thread_type} ${t.is_sensitive ? '· Sensitive' : ''}</div>
        </div>
        <div class="ml-thread-meta">${_fmtDate(t.updated_at || t.created_at)}</div>
      </div>
    `).join('')}
  </div>` : `
  <div class="ml-empty">
    <i class="bi bi-chat-dots"></i>
    <p>No message threads yet. Direct messages will appear here.</p>
  </div>`}
</div>`

    container.querySelectorAll<HTMLElement>('[data-thread-id]').forEach(el => {
      el.addEventListener('click', () => navigate(`/communications/messages?id=${el.dataset['threadId']}`))
    })
  },

  destroy() {
    _container = null
    _threads = []
  },
}

export default MessagesList
