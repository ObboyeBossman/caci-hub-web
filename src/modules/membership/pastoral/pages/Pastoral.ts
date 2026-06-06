// src/modules/pastoral/pages/Pastoral.ts
// Pastoral Care overview dashboard.
import type { PageModule }     from '../../../types/module.types'
import { listCases }           from '../repository'
import { listPrayerRequests }  from '../repository'

const Pastoral: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1100px;margin:0 auto;">
  <h2 style="margin:0 0 4px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Pastoral Care</h2>
  <p style="color:var(--mm-text-secondary);margin:0 0 24px;">Manage pastoral cases, visits, and prayer requests</p>

  <div id="pastoral-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:28px;">
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Loading…</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Open Cases</div>
      <div id="pastoral-open-cases" style="color:var(--mm-text-secondary);font-size:var(--text-sm);">Loading…</div>
    </div>
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Active Prayer Requests</div>
      <div id="pastoral-prayers" style="color:var(--mm-text-secondary);font-size:var(--text-sm);">Loading…</div>
    </div>
  </div>

  <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
    <a href="#/pastoral/cases" style="text-decoration:none;">
      <button class="mm-btn-primary">All Cases</button>
    </a>
    <a href="#/pastoral/cases/new" style="text-decoration:none;">
      <button class="mm-btn-outline">+ New Case</button>
    </a>
    <a href="#/pastoral/prayer-requests" style="text-decoration:none;">
      <button class="mm-btn-outline">Prayer Requests</button>
    </a>
  </div>
</div>`

    try {
      const [cases, prayers] = await Promise.all([
        listCases({ status: 'open' }),
        listPrayerRequests({ status: 'active' }),
      ])

      const urgent = cases.filter(c => c.priority === 'urgent').length
      container.querySelector('#pastoral-summary')!.innerHTML = `
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Open Cases</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">${cases.length}</div>
        </div>
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Urgent Cases</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:${urgent > 0 ? '#b91c1c' : 'var(--mm-text-primary)'};">${urgent}</div>
        </div>
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Prayer Requests</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">${prayers.length}</div>
        </div>`

      const priorityColor = (p: string) =>
        p === 'urgent' ? '#b91c1c' : p === 'high' ? '#d97706' : 'var(--mm-text-secondary)'

      container.querySelector('#pastoral-open-cases')!.innerHTML = cases.length === 0
        ? '<div>No open cases.</div>'
        : cases.slice(0, 5).map(c => `
          <div style="padding:8px 0;border-bottom:1px solid var(--mm-border);">
            <div style="font-weight:600;font-size:var(--text-sm);">${c.title}</div>
            <div style="display:flex;gap:8px;color:var(--mm-text-secondary);font-size:var(--text-xs);">
              <span>${c.case_type.replace('_', ' ')}</span>
              <span style="color:${priorityColor(c.priority)};">${c.priority}</span>
            </div>
          </div>`).join('')

      container.querySelector('#pastoral-prayers')!.innerHTML = prayers.length === 0
        ? '<div>No active prayer requests.</div>'
        : prayers.slice(0, 5).map(p => `
          <div style="padding:8px 0;border-bottom:1px solid var(--mm-border);">
            <div style="font-weight:600;font-size:var(--text-sm);">${p.is_anonymous ? '(Anonymous)' : p.title}</div>
            <div style="color:var(--mm-text-secondary);font-size:var(--text-xs);">${p.status}</div>
          </div>`).join('')

    } catch (err: any) {
      container.querySelector('#pastoral-summary')!.innerHTML =
        `<div style="color:#b91c1c;">${err.message}</div>`
    }
  },
  destroy() {},
}

export default Pastoral
