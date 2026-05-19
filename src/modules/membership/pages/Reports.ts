// src/modules/membership/pages/Reports.ts
// Reports overview page — charts and export.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { listMembers } from '../repository'
import { injectMembershipCSS } from '../member-helpers'

const Reports: PageModule = {
  async render(container) {
    injectMembershipCSS()

    // Load fresh data for charts
    let total = 0, active = 0, visitors = 0, male = 0, female = 0, newMonth = 0
    try {
      const members = await listMembers({ includeDeleted: false }, { limit: 1000 })
      total    = members.length
      active   = members.filter(m => m.membership_status === 'active').length
      visitors = members.filter(m => m.membership_status === 'visitor').length
      male     = members.filter(m => m.gender === 'male').length
      female   = members.filter(m => m.gender === 'female').length
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
      newMonth = members.filter(m => new Date(m.join_date ?? m.created_at) >= cutoff).length
    } catch { /* non-fatal — charts will show zero */ }

    const bar = (label: string, value: number, max: number, color: string) =>
      `<div class="mm-chart-bar-row">
         <div class="mm-chart-bar-label">${label}</div>
         <div class="mm-chart-bar-track"><div class="mm-chart-bar-fill" style="width:${max ? Math.round(value/max*100) : 0}%;background:${color}"></div></div>
         <div class="mm-chart-bar-val">${value}</div>
       </div>`

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:1000px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Reports</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);">Membership statistics and insights</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="rpt-exportBtn">Export CSV</button>
      <button class="mm-btn-outline" onclick="history.back()">← Back</button>
    </div>
  </div>

  <!-- Stat cards -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
    ${[['Total Members', total, 'var(--mm-blue)'],['Active', active, 'var(--mm-green)'],['Visitors', visitors, '#0969da'],['New (30d)', newMonth, 'var(--mm-gold)']].map(([label, val, color]) =>
      `<div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:18px;">
         <div style="font-size:26px;font-weight:700;color:${color};">${val}</div>
         <div style="font-size:12px;color:var(--mm-text-secondary);margin-top:4px;">${label}</div>
       </div>`
    ).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
    <!-- Gender chart -->
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-size:14px;font-weight:600;color:var(--mm-text-primary);margin-bottom:14px;">By Gender</div>
      ${bar('Male', male, total, '#004BA0')}
      ${bar('Female', female, total, '#C60026')}
    </div>

    <!-- Status chart -->
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-size:14px;font-weight:600;color:var(--mm-text-primary);margin-bottom:14px;">By Status</div>
      ${bar('Active', active, total, 'var(--mm-green)')}
      ${bar('Visitors', visitors, total, '#0969da')}
      ${bar('Other', total - active - visitors, total, 'var(--mm-text-muted)')}
    </div>
  </div>

  <!-- Quick report links -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
    <div style="font-size:14px;font-weight:600;color:var(--mm-text-primary);margin-bottom:14px;">Available Reports</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
      ${[
        ['New Members Report', 'new-members'],
        ['Attendance Summary', 'attendance'],
        ['Gender Breakdown',   'gender'],
        ['Status Summary',     'status'],
        ['Household Report',   'households'],
      ].map(([name, type]) => `
      <div class="mm-report-card" data-rpt-type="${type}"
        style="border:1px solid var(--mm-border);border-radius:8px;padding:14px;cursor:pointer;
          transition:border-color 0.15s,background 0.15s;">
        <div style="font-size:13px;font-weight:600;color:var(--mm-text-primary);" class="mm-report-name">${name}</div>
        <div style="font-size:11px;color:var(--mm-text-muted);margin-top:4px;">Click to generate</div>
      </div>`).join('')}
    </div>
  </div>
</div>`

    container.querySelector('#rpt-exportBtn')?.addEventListener('click', async () => {
      Toast.info('Generating CSV export…')
      // Fallback export from current members data
      try {
        const { exportMembersCsv, downloadCsv } = await import('../services/memberService')
        const csv = await exportMembersCsv()
        downloadCsv(csv, 'caci_members.csv')
        Toast.success('CSV exported.')
      } catch {
        Toast.error('Export failed. Please try again.')
      }
    })

    container.querySelectorAll<HTMLElement>('[data-rpt-type]').forEach(card => {
      card.addEventListener('click', () => {
        navigate(`/reports/${card.dataset['rptType']}`)
      })
    })
  },

  destroy() {},
}

export default Reports
