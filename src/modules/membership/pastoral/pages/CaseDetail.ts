// src/modules/pastoral/pages/CaseDetail.ts
// View a pastoral case and its visits.
import type { PageModule }  from '../../../../types/module.types'
import { getCase, listVisits, updateCaseStatus } from '../repository'
import type { PastoralCaseStatus } from '../../../../types/pastoral.types'

const CaseDetail: PageModule = {
  async render(container) {
    const id = location.hash.split('/').pop() ?? ''

    container.innerHTML = `
<div style="padding:24px;max-width:860px;margin:0 auto;">
  <a href="#/pastoral/cases" style="font-size:var(--text-sm);color:var(--mm-text-secondary);text-decoration:none;margin-bottom:16px;display:inline-block;">← Back to Cases</a>
  <div id="case-detail-body">Loading…</div>
</div>`

    const body = container.querySelector('#case-detail-body') as HTMLElement

    try {
      const [c, visits] = await Promise.all([getCase(id), listVisits(id)])

      const priorityColor = (p: string) =>
        p === 'urgent' ? '#b91c1c' : p === 'high' ? '#d97706' : 'var(--mm-text-secondary)'

      body.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 4px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">${c.title}</h2>
            <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);">
              ${c.case_type.replace('_', ' ')} ·
              <span style="color:${priorityColor(c.priority)};">${c.priority}</span> ·
              ${c.status.replace('_', ' ')}
            </div>
          </div>
          <select id="status-picker" class="mm-input" style="width:160px;">
            <option value="open" ${c.status === 'open' ? 'selected' : ''}>Open</option>
            <option value="in_progress" ${c.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            <option value="closed" ${c.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>

        ${c.description ? `<p style="color:var(--mm-text-secondary);margin-bottom:20px;">${c.description}</p>` : ''}

        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Visits (${visits.length})</div>
          ${visits.length === 0
            ? '<div style="color:var(--mm-text-secondary);font-size:var(--text-sm);">No visits recorded yet.</div>'
            : visits.map(v => `
              <div style="padding:10px 0;border-bottom:1px solid var(--mm-border);">
                <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);">
                  <span style="font-weight:600;">${v.visit_type.replace('_', ' ')}</span>
                  <span style="color:var(--mm-text-secondary);">${v.visit_date}</span>
                </div>
                <div style="color:var(--mm-text-secondary);font-size:var(--text-xs);margin-top:4px;">
                  Outcome: ${v.outcome.replace('_', ' ')}
                  ${v.next_visit_date ? ` · Next: ${v.next_visit_date}` : ''}
                </div>
                ${v.notes ? `<div style="font-size:var(--text-xs);color:var(--mm-text-secondary);margin-top:4px;">${v.notes}</div>` : ''}
              </div>`).join('')}
        </div>
        <div id="status-msg" style="margin-top:12px;"></div>`

      const picker = body.querySelector('#status-picker') as HTMLSelectElement
      const statusMsg = body.querySelector('#status-msg') as HTMLElement
      picker.addEventListener('change', async () => {
        try {
          await updateCaseStatus(id, picker.value as PastoralCaseStatus)
          statusMsg.innerHTML = '<div style="color:#1a7f37;font-size:var(--text-sm);">Status updated.</div>'
        } catch (err: any) {
          statusMsg.innerHTML = `<div style="color:#b91c1c;font-size:var(--text-sm);">${err.message}</div>`
        }
      })
    } catch (err: any) {
      body.innerHTML = `<div style="color:#b91c1c;">${err.message}</div>`
    }
  },
  destroy() {},
}

export default CaseDetail
