import type { PageModule } from '../../../types/module.types'
import { getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { CommunicationService } from '../services'
import type { Template } from '../schemas'

const CSS = /* css */`
.tl-page { padding: var(--space-xl) var(--space-2xl); max-width: 900px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .tl-page { padding: var(--space-lg) var(--space-md); } }
.tl-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.tl-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.tl-header-sub { font-size: var(--text-base); color: var(--text-secondary); margin-top: 2px; }
.tl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
.tl-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); transition: all 0.15s; }
.tl-card:hover { border-color: var(--border-strong); }
.tl-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-sm); }
.tl-card-name { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.tl-card-channel { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 99px; }
.tl-card-preview { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-md); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tl-card-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
.tl-card-vars { font-size: 10px; color: var(--text-muted); }
.tl-card-actions { display: flex; gap: 4px; }
.tl-btn { display: inline-flex; align-items: center; gap: 4px; padding: 0 10px; height: 28px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-secondary); font-family: var(--font-sans); transition: all 0.12s; }
.tl-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.tl-btn-primary { background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light)); border-color: transparent; color: #fff; font-weight: 600; }
.tl-btn-primary:hover { color: #fff; }
.tl-btn-danger { color: var(--caci-red); }
.tl-btn-danger:hover { background: rgba(198,0,38,0.06); border-color: rgba(198,0,38,0.3); }
.tl-empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; text-align: center; color: var(--text-secondary); }
.tl-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
`

function _injectCSS(): void {
  if (document.getElementById('tl-css')) return
  const s = document.createElement('style')
  s.id = 'tl-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

let _container: HTMLElement | null = null
let _templates: Template[] = []

const TemplatesList: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'card')
    _injectCSS()

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      renderError(container, new Error('No assembly selected'))
      return
    }

    try {
      _templates = await CommunicationService.getTemplates(assemblyId)
    } catch (err) {
      renderError(container, err, { retry: () => TemplatesList.render(container) })
      return
    }

    _renderPage()
    _bindEvents()
  },

  destroy() {
    _container = null
    _templates = []
  },
}

export default TemplatesList

function _channelColor(channel: string): string {
  switch (channel) {
    case 'email': return 'rgba(0,75,160,0.12)'
    case 'sms': return 'rgba(34,197,94,0.12)'
    case 'push': return 'rgba(124,58,237,0.12)'
    default: return 'rgba(139,148,158,0.12)'
  }
}
function _channelTextColor(channel: string): string {
  switch (channel) {
    case 'email': return 'var(--caci-blue-light)'
    case 'sms': return '#56d364'
    case 'push': return '#a78bfa'
    default: return 'var(--text-secondary)'
  }
}

function _renderPage(): void {
  if (!_container) return

  _container.innerHTML = `
<div class="tl-page">
  <div class="tl-header">
    <div>
      <h2>Templates</h2>
      <div class="tl-header-sub">Reusable message templates for broadcasts</div>
    </div>
    <button class="tl-btn tl-btn-primary" id="tl-newBtn"><i class="bi bi-plus-lg"></i> New Template</button>
  </div>
  ${_templates.length ? `
  <div class="tl-grid">
    ${_templates.map(t => `
      <div class="tl-card">
        <div class="tl-card-header">
          <h3 class="tl-card-name">${t.title}</h3>
          <span class="tl-card-channel" style="background:${_channelColor(t.channel)};color:${_channelTextColor(t.channel)};">${t.channel}</span>
        </div>
        <div class="tl-card-preview">${t.body}</div>
        <div class="tl-card-footer">
          <span class="tl-card-vars">${t.variables ? Object.keys(t.variables).length + ' variable(s)' : 'No variables'}</span>
          <div class="tl-card-actions">
            <button class="tl-btn" data-tpl-use="${t.id}"><i class="bi bi-send"></i> Use</button>
            <button class="tl-btn tl-btn-danger" data-tpl-delete="${t.id}"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('')}
  </div>` : `
  <div class="tl-empty">
    <i class="bi bi-file-earmark-text"></i>
    <p>No templates yet. Create your first reusable template.</p>
    <button class="tl-btn tl-btn-primary" id="tl-emptyNewBtn"><i class="bi bi-plus-lg"></i> Create Template</button>
  </div>`}
</div>`
}

function _bindEvents(): void {
  if (!_container) return

  _container.querySelector('#tl-newBtn')?.addEventListener('click', _openCreateModal)
  _container.querySelector('#tl-emptyNewBtn')?.addEventListener('click', _openCreateModal)

  _container.querySelectorAll<HTMLElement>('[data-tpl-use]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      navigate('/communications/broadcast')
    })
  })

  _container.querySelectorAll<HTMLElement>('[data-tpl-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const id = btn.dataset['tplDelete']!
      if (!confirm('Delete this template?')) return
      try {
        await CommunicationService.deleteTemplate(id)
        Toast.success('Template deleted')
        _templates = _templates.filter(t => t.id !== id)
        _renderPage()
        _bindEvents()
      } catch (err) {
        Toast.fromError(err)
      }
    })
  })
}

function _openCreateModal(): void {
  const name = prompt('Template name:')
  if (!name) return
  const body = prompt('Template body (use {{variable}} for placeholders):')
  if (!body) return

  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return

  CommunicationService.createTemplate({
    assembly_id: assemblyId,
    name,
    body,
    variables: {},
    channel: 'in_app',
    is_active: true,
  }).then(() => {
    Toast.success('Template created')
    TemplatesList.render(_container!)
  }).catch(err => Toast.fromError(err))
}
