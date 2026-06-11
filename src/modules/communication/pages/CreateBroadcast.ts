import type { PageModule } from '../../../types/module.types'
import { getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { renderSkeleton } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { CommunicationService } from '../services'
import type { Template } from '../schemas'

const CSS = /* css */`
.cb-page { padding: var(--space-xl) var(--space-2xl); max-width: 720px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .cb-page { padding: var(--space-lg) var(--space-md); } }
.cb-header { margin-bottom: var(--space-xl); }
.cb-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.cb-header p { font-size: var(--text-base); color: var(--text-secondary); margin-top: 4px; }
.cb-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-xl); margin-bottom: var(--space-lg); }
.cb-field { margin-bottom: var(--space-lg); }
.cb-field:last-child { margin-bottom: 0; }
.cb-field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 5px; }
.cb-field input, .cb-field select, .cb-field textarea { width: 100%; background: var(--bg-page); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px; font-family: var(--font-sans); color: var(--text-primary); outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
.cb-field input:focus, .cb-field select:focus, .cb-field textarea:focus { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
.cb-field textarea { resize: vertical; min-height: 120px; }
.cb-field select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
.cb-field-err { font-size: 11px; color: var(--caci-red); margin-top: 3px; display: none; }
.cb-field-err.show { display: block; }
.cb-actions { display: flex; gap: var(--space-sm); justify-content: flex-end; }
.cb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 16px; height: 36px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-secondary); font-family: var(--font-sans); transition: all 0.18s; white-space: nowrap; }
.cb-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.cb-btn-primary { background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light)); border-color: transparent; color: #fff; font-weight: 600; box-shadow: 0 2px 10px rgba(0,75,160,0.3); }
.cb-btn-primary:hover { color: #fff; box-shadow: 0 6px 20px rgba(0,75,160,0.4); }
.cb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
.cb-template-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-sm); margin-bottom: var(--space-lg); }
.cb-template-card { background: var(--bg-page); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; cursor: pointer; transition: all 0.15s; }
.cb-template-card:hover { border-color: var(--border-strong); }
.cb-template-card.selected { border-color: var(--caci-blue); background: rgba(0,75,160,0.06); }
.cb-template-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.cb-template-preview { font-size: 11px; color: var(--text-secondary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`

function _injectCSS(): void {
  if (document.getElementById('cb-css')) return
  const s = document.createElement('style')
  s.id = 'cb-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

let _container: HTMLElement | null = null
let _templates: Template[] = []
let _selectedTemplateId: string | null = null
let _submitting = false
let _destroyed = false

const CreateBroadcast: PageModule = {
  async render(container) {
    _container = container
    _destroyed = false
    _selectedTemplateId = null
    _submitting = false
    renderSkeleton(container, 'form')
    _injectCSS()

    const assemblyId = getActiveAssemblyId()

    if (assemblyId) {
      try {
        _templates = await CommunicationService.getTemplates(assemblyId)
      } catch (_) {
        _templates = []
      }
    }

    _renderForm()
    _bindEvents()
  },

  destroy() {
    _destroyed = true
    _container = null
    _templates = []
    _selectedTemplateId = null
  },
}

export default CreateBroadcast

function _renderForm(): void {
  if (!_container) return
  _container.innerHTML = `
<div class="cb-page">
  <div class="cb-header">
    <h2>New Broadcast</h2>
    <p>Compose and send a broadcast message to your assembly.</p>
  </div>

  <form id="cb-form" novalidate>
    ${_templates.length ? `
    <div class="cb-card">
      <div class="cb-field" style="margin-bottom:var(--space-md);">
        <label>Use a Template (optional)</label>
      </div>
      <div class="cb-template-pick">
        ${_templates.map(t => `
          <div class="cb-template-card" data-tpl-id="${t.id}">
            <div class="cb-template-name">${t.title}</div>
            <div class="cb-template-preview">${t.body?.slice(0, 60) ?? 'No preview'}${(t.body?.length ?? 0) > 60 ? '…' : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="cb-card">
      <div class="cb-field">
        <label for="cb-title">Broadcast Title *</label>
        <input type="text" id="cb-title" maxlength="120" placeholder="e.g. Sunday Service Reminder" autocomplete="off">
        <div class="cb-field-err" id="cb-title-err">Title is required</div>
      </div>

      <div class="cb-field">
        <label for="cb-channel">Channel *</label>
        <select id="cb-channel">
          <option value="in_app">In-App</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="push">Push Notification</option>
        </select>
      </div>

      <div class="cb-field">
        <label for="cb-audience">Audience *</label>
        <select id="cb-audience">
          <option value="assembly">Entire Assembly</option>
          <option value="group">Specific Group</option>
          <option value="member_list">Selected Members</option>
        </select>
      </div>

      <div class="cb-field">
        <label for="cb-body">Message Body *</label>
        <textarea id="cb-body" placeholder="Type your message here…"></textarea>
        <div class="cb-field-err" id="cb-body-err">Message body is required</div>
      </div>

      <div class="cb-field">
        <label for="cb-schedule">Schedule (optional)</label>
        <input type="datetime-local" id="cb-schedule">
      </div>
    </div>

    <div class="cb-actions">
      <button type="button" class="cb-btn" id="cb-cancelBtn">Cancel</button>
      <button type="submit" class="cb-btn cb-btn-primary" id="cb-submitBtn">
        <i class="bi bi-send-fill"></i> Send Broadcast
      </button>
    </div>
  </form>
</div>`
}

function _bindEvents(): void {
  if (!_container) return

  _container.querySelector('#cb-cancelBtn')?.addEventListener('click', () => navigate('/communications'))

  _container.querySelectorAll<HTMLElement>('[data-tpl-id]').forEach(card => {
    card.addEventListener('click', () => {
      const tplId = card.dataset['tplId']!
      _selectedTemplateId = _selectedTemplateId === tplId ? null : tplId
      _container!.querySelectorAll<HTMLElement>('[data-tpl-id]').forEach(c => c.classList.toggle('selected', c.dataset['tplId'] === _selectedTemplateId))
      if (_selectedTemplateId) {
        const tpl = _templates.find(t => t.id === _selectedTemplateId)
        if (tpl) {
          const titleInput = _container!.querySelector<HTMLInputElement>('#cb-title')
          const bodyInput = _container!.querySelector<HTMLTextAreaElement>('#cb-body')
          if (titleInput && !titleInput.value) titleInput.value = `[Template] ${tpl.title}`
          if (bodyInput) bodyInput.value = tpl.body
        }
      }
    })
  })

  _container.querySelector<HTMLFormElement>('#cb-form')?.addEventListener('submit', async e => {
    e.preventDefault()
    if (_submitting) return

    const title = _container!.querySelector<HTMLInputElement>('#cb-title')?.value.trim() ?? ''
    const channel = _container!.querySelector<HTMLSelectElement>('#cb-channel')?.value ?? 'in_app'
    const audience = _container!.querySelector<HTMLSelectElement>('#cb-audience')?.value ?? 'assembly'
    const body = _container!.querySelector<HTMLTextAreaElement>('#cb-body')?.value.trim() ?? ''
    const scheduleInput = _container!.querySelector<HTMLInputElement>('#cb-schedule')?.value ?? ''

    let valid = true
    const titleErr = _container!.querySelector('#cb-title-err')
    const bodyErr = _container!.querySelector('#cb-body-err')
    if (!title) { titleErr?.classList.add('show'); valid = false } else { titleErr?.classList.remove('show') }
    if (!body) { bodyErr?.classList.add('show'); valid = false } else { bodyErr?.classList.remove('show') }
    if (!valid) return

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      Toast.error('No assembly selected')
      return
    }

    _submitting = true
    const submitBtn = _container!.querySelector<HTMLButtonElement>('#cb-submitBtn')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="gd-spinner"></span> Sending…' }

    try {
      await CommunicationService.createCampaign({
        assembly_id: assemblyId,
        title,
        body,
        channel: channel as any,
        audience_type: audience as any,
        status: 'draft',
        scheduled_for: scheduleInput ? new Date(scheduleInput).toISOString() : null,
        total_recipients: 0,
        created_by: '',
      })
      Toast.success('Broadcast created successfully!')
      navigate('/communications/campaigns')
    } catch (err: any) {
      Toast.fromError(err)
      _submitting = false
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-send-fill"></i> Send Broadcast' }
    }
  })
}
