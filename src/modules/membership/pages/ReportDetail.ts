// src/modules/membership/pages/ReportDetail.ts
// Single report detail page — renders from container.dataset.type.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { listMembers } from '../repository'
import { fmtDate, injectMembershipCSS } from '../utils/member-helpers'

const REPORT_LABELS: Record<string, string> = {
  'new-members': 'New Members Report',
  'attendance':  'Attendance Summary',
  'gender':      'Gender Breakdown',
  'status':      'Status Summary',
  'households':  'Household Report',
}

const ReportDetail: PageModule = {
  async render(container) {
    renderSkeleton(container, 'table')
    injectMembershipCSS()

    const type  = container.dataset['type'] ?? 'new-members'
    const label = REPORT_LABELS[type] ?? type

    let members: Awaited<ReturnType<typeof listMembers>> = []
    try {
      members = await listMembers({ includeDeleted: false }, { limit: 1000 })
    } catch { /* show empty */ }

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)

    let tableHTML = ''
    if (type === 'new-members') {
      const filtered = members.filter(m => new Date(m.join_date ?? m.created_at) >= cutoff)
      tableHTML = `
<table class="mm-table">
  <thead><tr><th>Name</th><th>Status</th><th>Joined</th><th>Phone</th></tr></thead>
  <tbody>
    ${filtered.map(m => `<tr>
      <td>${m.first_name} ${m.last_name}</td>
      <td>${m.membership_status}</td>
      <td>${fmtDate(m.join_date)}</td>
      <td>${m.primary_phone ?? '—'}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--mm-text-muted)">No new members in the last 30 days.</td></tr>'}
  </tbody>
</table>`
    } else if (type === 'gender') {
      const male = members.filter(m => m.gender === 'male').length
      const female = members.filter(m => m.gender === 'female').length
      tableHTML = `
<table class="mm-table">
  <thead><tr><th>Gender</th><th>Count</th><th>Percentage</th></tr></thead>
  <tbody>
    <tr><td>Male</td><td>${male}</td><td>${members.length ? Math.round(male/members.length*100) : 0}%</td></tr>
    <tr><td>Female</td><td>${female}</td><td>${members.length ? Math.round(female/members.length*100) : 0}%</td></tr>
  </tbody>
</table>`
    } else if (type === 'status') {
      const statuses = ['active','visitor','prospect','inactive','transfer','deceased']
      tableHTML = `
<table class="mm-table">
  <thead><tr><th>Status</th><th>Count</th><th>Percentage</th></tr></thead>
  <tbody>
    ${statuses.map(s => {
      const count = members.filter(m => m.membership_status === s).length
      return `<tr>
        <td style="text-transform:capitalize;">${s}</td>
        <td>${count}</td>
        <td>${members.length ? Math.round(count/members.length*100) : 0}%</td>
      </tr>`
    }).join('')}
  </tbody>
</table>`
    } else {
      tableHTML = `<div style="padding:40px;text-align:center;color:var(--mm-text-secondary);font-size:13px;">
        This report is not yet available.
      </div>`
    }

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <button style="display:inline-flex;align-items:center;gap:6px;
        color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
        cursor:pointer;font-family:inherit;margin-bottom:6px;"
        onclick="history.back()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Reports
      </button>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">${label}</h2>
    </div>
    <button class="mm-btn-outline" id="rd-exportBtn">Export CSV</button>
  </div>
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    ${tableHTML}
  </div>
</div>`

    container.querySelector('#rd-exportBtn')?.addEventListener('click', () =>
      Toast.info(`Exporting ${label}…`)
    )
  },

  destroy() {},
}

export default ReportDetail
