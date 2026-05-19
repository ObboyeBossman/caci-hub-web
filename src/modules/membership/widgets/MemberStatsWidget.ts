// src/modules/membership/widgets/MemberStatsWidget.ts
// Dashboard widget — 4 stat cards from real member data.

import type { PageModule } from '../../../types/module.types'
import { listMembers } from '../repository'
import { injectMembershipCSS } from '../member-helpers'

const MemberStatsWidget: PageModule = {
  async render(container) {
    injectMembershipCSS()
    container.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;" class="mm-stats-widget">
  <div class="mm-stat-loading">—</div>
  <div class="mm-stat-loading">—</div>
  <div class="mm-stat-loading">—</div>
  <div class="mm-stat-loading">—</div>
</div>`

    try {
      const members = await listMembers({ includeDeleted: false }, { limit: 1000 })
      const total    = members.length
      const active   = members.filter(m => m.membership_status === 'active').length
      const visitors = members.filter(m => m.membership_status === 'visitor').length
      const cutoff   = new Date(); cutoff.setDate(cutoff.getDate() - 30)
      const newMonth = members.filter(m => new Date(m.join_date ?? m.created_at) >= cutoff).length

      const stat = (label: string, value: number, color: string, icon: string) => `
<div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:10px;padding:16px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <div style="width:32px;height:32px;border-radius:8px;background:${color}22;
      display:flex;align-items:center;justify-content:center;font-size:15px;">${icon}</div>
    <div style="font-size:12px;color:var(--mm-text-muted);font-weight:500;">${label}</div>
  </div>
  <div style="font-size:26px;font-weight:700;color:var(--mm-text-primary);line-height:1;">${value}</div>
</div>`

      container.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;" class="mm-stats-widget">
  ${stat('Total Members', total,    '#004BA0', '👥')}
  ${stat('Active',        active,   '#1a7f37', '✅')}
  ${stat('Visitors',      visitors, '#0969da', '👁️')}
  ${stat('New This Month',newMonth, '#9a6700', '⭐')}
</div>`
    } catch (err) {
      container.innerHTML = `<div style="font-size:12px;color:var(--mm-text-muted);padding:8px;">Could not load stats.</div>`
    }
  },
  destroy() {},
}

export default MemberStatsWidget
