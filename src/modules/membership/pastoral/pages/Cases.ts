// src/modules/pastoral/pages/Cases.ts
// Pastoral cases list page.
import type { PageModule } from '../../../../types/module.types'
import { listCases }       from '../repository'

const Cases: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1100px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="margin:0 0 4px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Pastoral Cases</h2>
      <p style="color:var(--mm-text-secondary);margin:0;">All assembly pastoral cases</p>
    </div>
    <a href="#/pastoral/cases/new" style="text-decoration:none;">
      <button class="mm-btn-primary">+ New Case</button>
    </a>
  </div>
  <div id="cases-list">Loading…</div>
</div>`

    try {
      const cases = await listCases()
      const el = container.querySelector('#cases-list')!
      if (cases.length === 0) {
        el.innerHTML = '<div style="color:var(--mm-text-secondary);padding:20px 0;">No pastoral cases found.</div>'
        return
      }
      const priorityColor = (p: string) =>
        p === 'urgent' ? '#b91c1c' : p === 'high' ? '#d97706' : p === 'medium' ? '#2563eb' : '#6b7280'
      const statusBadge = (s: string) => {
        const colours: Record<string, string> = {
          open: '#1a7f37', in_progress: '#2563eb', resolved: '#6b7280', closed: '#374151'
        }
        return `<span style="background:${colours[s] ?? '#6b7280'}20;color:${colours[s] ?? '#6b7280'};padding:2px 8px;border-radius:9999px;font-size:var(--text-xs);font-weight:500;">${s.replace('_', ' ')}</span>`
      }
      el.innerHTML = `
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
          ${cases.map(c => `
            <div style="padding:14px 18px;border-bottom:1px solid var(--mm-border);display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:600;color:var(--mm-text-primary);margin-bottom:4px;">${c.title}</div>
                <div style="display:flex;gap:10px;font-size:var(--text-xs);color:var(--mm-text-secondary);">
                  <span>${c.case_type.replace('_', ' ')}</span>
                  <span style="color:${priorityColor(c.priority)};">● ${c.priority}</span>
                  <span>${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              ${statusBadge(c.status)}
            </div>`).join('')}
        </div>`
    } catch (err: any) {
      container.querySelector('#cases-list')!.innerHTML =
        `<div style="color:#b91c1c;">${err.message}</div>`
    }
  },
  destroy() {},
}

export default Cases
