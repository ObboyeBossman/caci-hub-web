// src/modules/communication/tabs/MessagesTab.ts

import type { WorkspaceTab } from '@shell/WorkspaceShell'
import { showToast, openModal } from '../widgets/communicationWidgets'
import { CommunicationService } from '../services/communication.service'
import type { MessageThread, ThreadMessage } from '../schemas/communication'

// ─── CSS ─────────────────────────────────────────────────────────────────────

const MSG_CSS = /* css */`
.msg-thread-list { display: flex; flex-direction: column; gap: 6px; }
.msg-thread-row {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-md);
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; gap: var(--space-md);
}
.msg-thread-row:hover { border-color: var(--border-strong); transform: translateX(2px); }
.msg-thread-avatar {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.msg-thread-avatar i { font-size: 20px; }
.msg-thread-body   { flex: 1; min-width: 0; }
.msg-thread-title  { font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-thread-sub    { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.msg-thread-date   { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.msg-sensitive-tag {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 1px 6px; border-radius: 99px;
  background: rgba(198,0,38,0.1); color: var(--caci-red);
}

/* Thread detail */
.msg-thread-detail { display: flex; flex-direction: column; height: calc(100vh - 280px); min-height: 400px; }
.msg-detail-header {
  display: flex; align-items: center; gap: var(--space-md);
  padding-bottom: var(--space-md); margin-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-default);
}
.msg-detail-msgs {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column;
  gap: 10px; padding-bottom: var(--space-md);
}
.msg-bubble {
  max-width: 70%; padding: 10px 14px;
  border-radius: var(--radius-lg); font-size: 13px; line-height: 1.5;
}
.msg-bubble-self {
  align-self: flex-end; background: var(--caci-blue);
  color: #fff; border-bottom-right-radius: 4px;
}
.msg-bubble-other {
  align-self: flex-start; background: var(--bg-card);
  border: 1px solid var(--border-default); color: var(--text-primary);
  border-bottom-left-radius: 4px;
}
.msg-bubble-time { font-size: 10px; opacity: 0.65; margin-top: 4px; }
.msg-compose {
  display: flex; gap: var(--space-sm);
  padding-top: var(--space-md); border-top: 1px solid var(--border-default);
}
.msg-compose-inp {
  flex: 1; background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 10px 14px;
  font-size: 13px; font-family: var(--font-sans); color: var(--text-primary);
  outline: none; resize: none; max-height: 120px; overflow-y: auto;
  transition: border-color 0.2s;
}
.msg-compose-inp:focus { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
`

let _msgCSSInjected = false
function _injectCSS(): void {
  if (_msgCSSInjected) return; _msgCSSInjected = true
  const s = document.createElement('style'); s.id = 'msg-tab-css'; s.textContent = MSG_CSS
  document.head.appendChild(s)
}

function _threadIcon(t: MessageThread): string {
  if (t.thread_type === 'pastoral') return 'heart-fill'
  if (t.thread_type === 'support') return 'question-circle-fill'
  return 'chat-dots-fill'
}
function _threadColor(t: MessageThread): { bg: string; color: string } {
  if (t.thread_type === 'pastoral') return { bg: 'rgba(227,179,65,0.12)', color: '#e3b341' }
  if (t.thread_type === 'support') return { bg: 'rgba(124,58,237,0.1)', color: '#a78bfa' }
  return { bg: 'rgba(0,75,160,0.1)', color: 'var(--caci-blue-light)' }
}
function _fmtTime(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d); const now = new Date()
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class MessagesTab implements WorkspaceTab {
  readonly id = 'messages'
  readonly label = 'Messages'
  readonly icon = 'chat-dots-fill'
  readonly permission = 'communications.direct.send'

  private _container: HTMLElement | null = null
  private _threads: MessageThread[] = []
  private _memberId: string | null = null
  private _destroyed = false

  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    this._container = container
    this._destroyed = false

    container.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`

    try {
      this._memberId = await CommunicationService.getMemberId()

      if (!this._memberId) {
        console.warn('[MessagesTab] No member profile found for current user.')
        container.innerHTML = `
          <div class="cw-empty">
            <div class="cw-empty-icon-wrap"><i class="bi bi-person-x"></i></div>
            <p class="cw-empty-title">Feature Unavailable</p>
            <p class="cw-empty-desc">You need a linked member profile to use direct messaging.</p>
          </div>`
        return
      }

      this._threads = await CommunicationService.getThreads(this._memberId)
    } catch (err: any) {
      console.error('[MessagesTab] Error loading messages:', err)
      container.innerHTML = `
        <div class="cw-empty">
          <div class="cw-empty-icon-wrap"><i class="bi bi-exclamation-triangle"></i></div>
          <p class="cw-empty-title">Could not load messages</p>
          <p class="cw-empty-desc">${err?.message ?? 'An unexpected error occurred.'}</p>
        </div>`
      return
    }

    if (this._destroyed) return
    this._renderList()
  }

  private _renderList(): void {
    if (!this._container) return

    if (!this._threads.length) {
      this._container.innerHTML = `
        <div class="cw-empty">
          <div class="cw-empty-icon-wrap"><i class="bi bi-chat-dots"></i></div>
          <p class="cw-empty-title">No message threads yet</p>
          <p class="cw-empty-desc">Direct messages from pastors or admins will appear here.</p>
        </div>`
      return
    }

    this._container.innerHTML = `
      <div class="msg-thread-list">
        ${this._threads.map(t => {
      const { bg, color } = _threadColor(t)
      const label = t.thread_type === 'pastoral' ? 'Pastoral' : t.thread_type === 'support' ? 'Support' : 'Direct'
      return `
            <div class="msg-thread-row" data-thread-id="${t.id}">
              <div class="msg-thread-avatar" style="background:${bg};">
                <i class="bi bi-${_threadIcon(t)}" style="color:${color};"></i>
              </div>
              <div class="msg-thread-body">
                <div class="msg-thread-title">${t.title || t.id.slice(0, 8)}</div>
                <div class="msg-thread-sub">
                  ${label} thread
                  ${t.is_sensitive ? '<span class="msg-sensitive-tag">Sensitive</span>' : ''}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <span class="msg-thread-date">${_fmtTime(t.updated_at ?? t.created_at)}</span>
              </div>
            </div>`
    }).join('')}
      </div>`

    this._container.querySelectorAll<HTMLElement>('[data-thread-id]').forEach(row => {
      row.addEventListener('click', () => {
        const t = this._threads.find(x => x.id === row.dataset['threadId'])
        if (t) this._showThread(t)
      })
    })
  }

  private async _showThread(t: MessageThread): Promise<void> {
    if (!this._container) return
    this._container.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`

    let messages: ThreadMessage[] = []
    try {
      messages = await CommunicationService.getThreadMessages(t.id)
    } catch (err: any) {
      showToast('Failed to load messages', 'danger')
      this._renderList()
      return
    }

    if (this._destroyed || !this._container) return

    const { bg, color } = _threadColor(t)

    this._container.innerHTML = `
      <button class="cw-tbtn" id="msg-back" style="margin-bottom:var(--space-lg);">
        <i class="bi bi-arrow-left"></i>&nbsp;All Threads
      </button>
      <div class="msg-thread-detail">
        <div class="msg-detail-header">
          <div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;">
            <i class="bi bi-${_threadIcon(t)}" style="color:${color};font-size:16px;"></i>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${t.title || 'Thread'}</div>
            <div style="font-size:11px;color:var(--text-muted);">
              ${t.thread_type === 'pastoral' ? 'Pastoral' : t.thread_type === 'support' ? 'Support' : 'Direct'} thread
              ${t.is_sensitive ? '· <span style="color:var(--caci-red);">Sensitive</span>' : ''}
            </div>
          </div>
        </div>
        <div class="msg-detail-msgs" id="msg-msgs">
          ${!messages.length
        ? `<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">
                <i class="bi bi-chat" style="font-size:2rem;display:block;margin-bottom:12px;"></i>
                No messages yet. Start the conversation below.
               </div>`
        : messages.map(m => {
          const isSelf = m.sender_id === this._memberId
          return `
                  <div style="display:flex;flex-direction:column;align-items:${isSelf ? 'flex-end' : 'flex-start'};">
                    <div class="msg-bubble msg-bubble-${isSelf ? 'self' : 'other'}">
                      ${m.message_type === 'audio'
              ? `<div style="display:flex;align-items:center;gap:8px;font-size:12px;">
                             <i class="bi bi-mic-fill"></i> Audio message
                           </div>`
              : (m.body ?? '')}
                      <div class="msg-bubble-time">${_fmtTime(m.created_at)}</div>
                    </div>
                  </div>`
        }).join('')}
        </div>
        <div class="msg-compose">
          <textarea class="msg-compose-inp" id="msg-inp" rows="1"
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"></textarea>
          <button class="cw-tbtn cw-tbtn-primary" id="msg-send" style="flex-shrink:0;height:44px;padding:0 16px;">
            <i class="bi bi-send-fill"></i>
          </button>
        </div>
      </div>`

    // Scroll to bottom
    const msgsEl = this._container.querySelector('#msg-msgs')!
    msgsEl.scrollTop = msgsEl.scrollHeight

    this._container.querySelector('#msg-back')?.addEventListener('click', () => this._renderList())

    const inp = this._container.querySelector<HTMLTextAreaElement>('#msg-inp')!
    const sendBtn = this._container.querySelector<HTMLButtonElement>('#msg-send')!

    const _send = async () => {
      const body = inp.value.trim()
      if (!body || !this._memberId) return
      inp.value = ''
      sendBtn.disabled = true
      try {
        await CommunicationService.sendThreadMessage({
          thread_id: t.id,
          sender_id: this._memberId,
          body,
          message_type: 'text',
        })
        // Reload thread messages
        await this._showThread(t)
      } catch (err: any) {
        showToast(err?.message ?? 'Failed to send message', 'danger')
        inp.value = body
        sendBtn.disabled = false
      }
    }

    sendBtn.addEventListener('click', _send)
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send() }
    })
    // Auto-grow textarea
    inp.addEventListener('input', () => {
      inp.style.height = 'auto'
      inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'
    })
    inp.focus()
  }

  destroy(): void {
    this._destroyed = true
    this._container = null
    this._threads = []
    this._memberId = null
  }
}