// src/modules/pastoral/pages/PrayerRequests.ts
// Prayer requests list page.
import type { PageModule }   from '../../../types/module.types'
import { listPrayerRequests, updatePrayerRequestStatus } from '../repository'

const PrayerRequests: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1100px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="margin:0 0 4px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Prayer Requests</h2>
      <p style="color:var(--mm-text-secondary);margin:0;">Active assembly prayer requests</p>
    </div>
    <div style="display:flex;gap:10px;">
      <a href="#/pastoral/prayer-requests/new" style="text-decoration:none;">
        <button class="mm-btn-primary">+ New Request</button>
      </a>
      <label style="display:flex;align-items:center;gap:6px;font-size:var(--text-sm);color:var(--mm-text-secondary);">
        <input type="checkbox" id="show-answered"> Show answered
      </label>
    </div>
  </div>
  <div id="pr-list">Loading…</div>
</div>`

    const renderList = async (includeAnswered: boolean) => {
      const el = container.querySelector('#pr-list') as HTMLElement
      el.innerHTML = 'Loading…'
      try {
        const reqs = await listPrayerRequests({ includeAnswered })
        if (reqs.length === 0) {
          el.innerHTML = '<div style="color:var(--mm-text-secondary);padding:20px 0;">No prayer requests found.</div>'
          return
        }
        el.innerHTML = `
          <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
            ${reqs.map(r => `
              <div style="padding:14px 18px;border-bottom:1px solid var(--mm-border);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                <div>
                  <div style="font-weight:600;color:var(--mm-text-primary);margin-bottom:4px;">
                    ${r.is_anonymous ? '<em style="color:var(--mm-text-secondary);">Anonymous</em>' : r.title}
                  </div>
                  ${r.description ? `<div style="font-size:var(--text-sm);color:var(--mm-text-secondary);">${r.description}</div>` : ''}
                  <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);margin-top:4px;">${new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                  <span style="font-size:var(--text-xs);padding:2px 8px;border-radius:9999px;background:${r.is_answered ? '#1a7f3720' : '#2563eb20'};color:${r.is_answered ? '#1a7f37' : '#2563eb'};">
                    ${r.status}
                  </span>
                  ${!r.is_answered ? `<button data-id="${r.id}" class="pr-mark-answered mm-btn-outline" style="font-size:var(--text-xs);padding:4px 10px;">Mark Answered</button>` : ''}
                </div>
              </div>`).join('')}
          </div>`

        el.querySelectorAll('.pr-mark-answered').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = (btn as HTMLElement).dataset.id!
            try {
              await updatePrayerRequestStatus(id, 'answered')
              await renderList(includeAnswered)
            } catch (err: any) {
              alert(err.message)
            }
          })
        })
      } catch (err: any) {
        el.innerHTML = `<div style="color:#b91c1c;">${err.message}</div>`
      }
    }

    await renderList(false)

    container.querySelector('#show-answered')!.addEventListener('change', (e) => {
      renderList((e.target as HTMLInputElement).checked)
    })
  },
  destroy() {},
}

export default PrayerRequests
