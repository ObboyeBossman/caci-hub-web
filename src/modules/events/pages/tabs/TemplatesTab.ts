import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { can }                from '@core/authorization/authorization-service'
import { PERMISSIONS }        from '@core/authorization/permissions'
import { debounce }           from '@shared/utils/debounce'
import {
  listServicesDisplay, listServiceTemplates, getServiceDisplay, getServiceStats, listAttendanceDisplay,
  softDeleteService, createService, updateService, createServiceTemplate, updateServiceTemplate,
  softDeleteTemplate, bulkUpsertAttendance, createServiceFromTemplate,
  formatDate, formatDateShort, formatTime, isToday, isFuture, buildRecurrenceLabel
} from '../../repository'
import { RECURRENCE_LABELS, SERVICE_TYPES, DAYS_OF_WEEK } from '../../types'
import type { ServiceDisplay, TemplateDisplay } from '../../types'
import type { ServiceStatus, AttendanceStatus } from '../../../../types/service.types'
import { state, shared } from '../state'
import {
  avatarColor, initials, statusBadge, attBadge, serviceTypeColor,
  toast, closeCtx, openCtx, openDrawer, openModal, confirm
} from '../components'

// TAB: TEMPLATES
// ══════════════════════════════════════════════════════

export async function _loadTemplates(): Promise<void> {
  if (shared.destroyed) return
  try {
    state.templates = await listServiceTemplates({ includeInactive: true })
    state.tmplFiltered = state.templates.filter(t =>
      !state.tmplSearch || t.title.toLowerCase().includes(state.tmplSearch.toLowerCase())
    )
    _renderTemplatesContent()
  } catch (err) {
    console.error('[services] _loadTemplates', err)
  }
}

export function _renderTemplatesTab(): void {
  injectTemplatesCSS()
  if (!shared.tabContent) return
  const user      = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.SERVICES_TEMPLATES_MANAGE)

  shared.tabContent.innerHTML = /* html */`
    <!-- Stats -->
    <div class="svc-stats-row" id="svc-tmpl-stats"></div>

    <!-- Toolbar -->
    <div class="svc-toolbar" style="margin-bottom:var(--space-md);">
      <div class="svc-search-wrap">
        <i class="bi bi-search"></i>
        <input type="text" id="svc-tmpl-search" placeholder="Search templates…" autocomplete="off" aria-label="Search templates">
      </div>
      ${canManage ? `
      <div class="svc-toolbar-actions">
        <button class="svc-tbtn svc-tbtn-primary" id="svc-tmpl-create">
          <i class="bi bi-plus-lg"></i>
          <span class="svc-btn-label">New Template</span>
        </button>
      </div>` : ''}
    </div>

    <!-- Meta -->
    <div class="svc-meta" id="svc-tmpl-meta"></div>

    <!-- Template grid -->
    <div id="svc-tmpl-content" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-md);"></div>
  `

  _renderTemplatesStats()
  _renderTemplatesContent()

  const search = shared.tabContent.querySelector<HTMLInputElement>('#svc-tmpl-search')!
  const debouncedSearch = debounce((q: string) => {
    state.tmplSearch = q
    state.tmplFiltered = state.templates.filter(t =>
      !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.service_type.toLowerCase().includes(q.toLowerCase())
    )
    _renderTemplatesContent()
  }, 220)
  search.addEventListener('input', () => debouncedSearch(search.value))

  shared.tabContent.querySelector('#svc-tmpl-create')?.addEventListener('click', () => _openTemplateModal(null))

  _loadTemplates()
}

export function _renderTemplatesStats(): void {
  const el = shared.tabContent?.querySelector<HTMLElement>('#svc-tmpl-stats')
  if (!el) return
  const { templates } = state
  const active   = templates.filter(t => t.is_active).length
  const inactive = templates.filter(t => !t.is_active).length
  const total    = templates.length

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  el.innerHTML = `
  <div class="svc-stat" style="--stat-accent:var(--caci-blue);--stat-glow:rgba(0,75,160,0.2);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(0,75,160,0.12);">
        <i class="bi bi-arrow-repeat" style="color:var(--caci-blue-light);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Total Templates</span>
    </div>
    <div class="svc-stat-value">${total}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:linear-gradient(90deg,var(--caci-blue),var(--caci-blue-light));"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:#22c55e;--stat-glow:rgba(34,197,94,0.18);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(34,197,94,0.12);">
        <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Active</span>
    </div>
    <div class="svc-stat-value">${active}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:rgba(34,197,94,0.4);"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:#58a6ff;--stat-glow:rgba(88,166,255,0.18);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:rgba(88,166,255,0.12);">
        <i class="bi bi-lightning-fill" style="color:#58a6ff;font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Instances Total</span>
    </div>
    <div class="svc-stat-value">${templates.reduce((acc, t) => acc + t.instance_count, 0)}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:100%;background:rgba(88,166,255,0.4);"></div></div>
  </div>
  <div class="svc-stat" style="--stat-accent:var(--text-muted);">
    <div class="svc-stat-icon-row">
      <div class="svc-stat-icon" style="background:var(--bg-hover);">
        <i class="bi bi-slash-circle" style="color:var(--text-muted);font-size:15px;"></i>
      </div>
      <span class="svc-stat-label">Inactive</span>
    </div>
    <div class="svc-stat-value">${inactive}</div>
    <div class="svc-stat-bar"><div class="svc-stat-bar-fill" style="width:${total ? Math.round(inactive/total*100) : 0}%;background:var(--border-strong);"></div></div>
  </div>`
}

export function _renderTemplatesContent(): void {
  const content = shared.tabContent?.querySelector<HTMLElement>('#svc-tmpl-content')
  const meta    = shared.tabContent?.querySelector<HTMLElement>('#svc-tmpl-meta')
  if (!content || !meta) return

  const list = state.tmplFiltered.length ? state.tmplFiltered : state.templates

  const user      = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.SERVICES_TEMPLATES_MANAGE)

  meta.innerHTML = `<span>Showing <strong>${list.length}</strong> template${list.length !== 1 ? 's' : ''}</span>`

  if (!list.length) {
    content.innerHTML = `<div class="svc-empty" style="grid-column:1/-1;">
      <i class="bi bi-arrow-repeat"></i>
      <div class="svc-empty-title">No templates found</div>
      <div class="svc-empty-sub">${canManage ? 'Create a template to start generating recurring services.' : 'No templates have been created yet.'}</div>
    </div>`
    return
  }

  content.innerHTML = list.map((t, i) => {
    const tc    = serviceTypeColor(t.service_type)
    const delay = Math.min(i * 35, 420)
    return `
    <div class="svc-tmpl-card" style="animation-delay:${delay}ms;" data-tmpl-id="${t.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <div style="width:40px;height:40px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-arrow-repeat" style="font-size:17px;color:${tc.color};"></i>
          </div>
          <div style="min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${t.service_type}</div>
          </div>
        </div>
        <span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;
          background:${t.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)'};
          border:1px solid ${t.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'};
          color:${t.is_active ? '#56d364' : 'var(--text-muted)'};flex-shrink:0;">
          ${t.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span class="svc-recur-chip"><i class="bi bi-arrow-repeat" style="font-size:10px;"></i>${t.recurrence_label}</span>
        ${t.group_name ? `<span style="font-size:11px;color:var(--text-muted);">· ${t.group_name}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border-subtle);">
        <span style="font-size:11px;color:var(--text-muted);"><strong style="color:var(--text-secondary);">${t.instance_count}</strong> instance${t.instance_count !== 1 ? 's' : ''} generated</span>
        ${canManage ? `
        <div style="display:flex;gap:6px;">
          <button class="svc-tbtn" data-tmpl-edit="${t.id}" style="height:30px;padding:0 8px;font-size:12px;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="svc-tbtn" data-tmpl-del="${t.id}" style="height:30px;padding:0 8px;font-size:12px;color:var(--caci-red);border-color:rgba(198,0,38,0.25);">
            <i class="bi bi-trash3"></i>
          </button>
        </div>` : ''}
      </div>
    </div>`
  }).join('')

  if (canManage) {
    content.querySelectorAll<HTMLElement>('[data-tmpl-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id = btn.dataset['tmplEdit']!
        const tmpl = state.templates.find(t => t.id === id)
        if (tmpl) _openTemplateModal(tmpl)
      })
    })
    content.querySelectorAll<HTMLElement>('[data-tmpl-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id   = btn.dataset['tmplDel']!
        const tmpl = state.templates.find(t => t.id === id)
        if (!tmpl) return
        confirm(
          `Delete "${tmpl.title}"?`,
          'This template will be deactivated and hidden. Existing service instances are preserved.',
          'Delete Template',
          async () => {
            await softDeleteTemplate(id)
            await _loadTemplates()
            toast('Template deleted.')
          }
        )
      })
    })
  }
}

export function _openTemplateModal(tmpl: TemplateDisplay | null): void {
  const isEdit = !!tmpl
  const { el, close } = openModal(
    isEdit ? 'Edit Template' : 'Create Template',
    `<div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-title">Template Name *</label>
        <input id="svc-tf-title" type="text" placeholder="e.g. Sunday Service" maxlength="100"
          value="${isEdit ? tmpl!.title.replace(/"/g, '&quot;') : ''}">
        <div class="svc-field-error" id="svc-tf-title-err">Title is required.</div>
      </div>
      <div class="svc-field">
        <label for="svc-tf-type">Service Type</label>
        <select id="svc-tf-type">
          ${SERVICE_TYPES.map(t => `<option value="${t}"${isEdit && tmpl!.service_type === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-recur">Recurrence</label>
        <select id="svc-tf-recur">
          ${Object.entries(RECURRENCE_LABELS).map(([k, v]) =>
            `<option value="${k}"${isEdit && tmpl!.recurrence === k ? ' selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="svc-field">
        <label for="svc-tf-day">Day of Week</label>
        <select id="svc-tf-day">
          <option value="">— Any —</option>
          ${DAYS_OF_WEEK.map(d => `<option value="${d}"${isEdit && tmpl!.day_of_week === d ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="svc-field-row">
      <div class="svc-field">
        <label for="svc-tf-time">Start Time</label>
        <input id="svc-tf-time" type="time" value="${isEdit && tmpl!.start_time ? tmpl!.start_time.substring(0,5) : ''}">
      </div>
      <div class="svc-field">
        <label for="svc-tf-venue">Venue</label>
        <input id="svc-tf-venue" type="text" placeholder="e.g. Main Auditorium"
          value="${isEdit && tmpl!.venue ? tmpl!.venue.replace(/"/g, '&quot;') : ''}">
      </div>
    </div>
    <div id="svc-tf-preview" style="padding:10px 12px;background:rgba(0,75,160,0.06);border:1px solid rgba(0,75,160,0.2);border-radius:var(--radius-sm);font-size:12px;color:var(--caci-blue-light);display:flex;align-items:center;gap:8px;">
      <i class="bi bi-arrow-repeat"></i>
      <span id="svc-tf-preview-text">—</span>
    </div>`,
    `<button class="btn btn-outline" id="svc-tf-cancel">Cancel</button>
     <button class="btn btn-primary" id="svc-tf-save">
       <i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Template'}
     </button>`,
    { large: false }
  )

  const updatePreview = () => {
    const recur = el.querySelector<HTMLSelectElement>('#svc-tf-recur')!.value
    const day   = el.querySelector<HTMLSelectElement>('#svc-tf-day')!.value
    const time  = el.querySelector<HTMLInputElement>('#svc-tf-time')!.value
    const preview = buildRecurrenceLabel({ recurrence: recur, day_of_week: day || null, start_time: time || null })
    const previewEl = el.querySelector<HTMLElement>('#svc-tf-preview-text')!
    previewEl.textContent = preview
  }
  el.querySelector('#svc-tf-recur')?.addEventListener('change', updatePreview)
  el.querySelector('#svc-tf-day')?.addEventListener('change', updatePreview)
  el.querySelector('#svc-tf-time')?.addEventListener('input', updatePreview)
  updatePreview()

  el.querySelector('#svc-tf-cancel')?.addEventListener('click', close)

  el.querySelector('#svc-tf-save')?.addEventListener('click', async () => {
    const title = el.querySelector<HTMLInputElement>('#svc-tf-title')!.value.trim()
    const titleErr = el.querySelector<HTMLElement>('#svc-tf-title-err')!
    if (!title) { titleErr.classList.add('show'); return }
    titleErr.classList.remove('show')

    const btn = el.querySelector<HTMLButtonElement>('#svc-tf-save')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`

    const payload = {
      title,
      service_type:  el.querySelector<HTMLSelectElement>('#svc-tf-type')!.value,
      recurrence:    el.querySelector<HTMLSelectElement>('#svc-tf-recur')!.value as any,
      day_of_week:   el.querySelector<HTMLSelectElement>('#svc-tf-day')!.value || null,
      start_time:    el.querySelector<HTMLInputElement>('#svc-tf-time')!.value || null,
      venue:         el.querySelector<HTMLInputElement>('#svc-tf-venue')!.value.trim() || null,
      is_active:     true,
    }

    try {
      if (isEdit) {
        await updateServiceTemplate(tmpl!.id, payload)
        toast('Template updated.')
      } else {
        await createServiceTemplate(payload as any)
        toast('Template created.')
      }
      close()
      await _loadTemplates()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-${isEdit ? 'check-lg' : 'plus-lg'}"></i> ${isEdit ? 'Save Changes' : 'Create Template'}`
      toast(err?.message ?? 'Failed to save.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}

// ══════════════════════════════════════════════════════

const _TAB_CSS = `
/* ── Template card ── */
.svc-tmpl-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: 16px;
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, box-shadow 0.2s;
  cursor: pointer; animation: svcFadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  position: relative;
}
.svc-tmpl-card:hover {
  transform: translateY(-3px); border-color: rgba(0,75,160,0.3);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

/* ── Recurrence chip ── */
.svc-recur-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.25);
  font-size: 11px; font-weight: 500; color: #58a6ff;
}

`;
export function injectTemplatesCSS() {
  if (document.getElementById('css-injectTemplatesCSS')) return;
  const s = document.createElement('style');
  s.id = 'css-injectTemplatesCSS';
  s.textContent = _TAB_CSS;
  document.head.appendChild(s);
}
