// src/modules/membership/widgets/NewMembersWidget.ts
// Dashboard widget — 5 most recently joined members.

import type { PageModule } from '../../../types/module.types'
import { listMembers } from '../repository'
import { avatarColor, initials, fmtDate, injectMembershipCSS } from '../utils/member-helpers'
import { navigate } from '@core/router'

const NewMembersWidget: PageModule = {
  async render(container) {
    injectMembershipCSS()
    container.innerHTML = `<div style="font-size:12px;color:var(--mm-text-muted);padding:8px;">Loading…</div>`

    try {
      const members = await listMembers(
        { includeDeleted: false },
        { limit: 5, sortBy: 'created_at', ascending: false }
      )

      if (!members.length) {
        container.innerHTML = `<div style="font-size:12px;color:var(--mm-text-muted);padding:8px;">No members yet.</div>`
        return
      }

      container.innerHTML = `
<div style="display:flex;flex-direction:column;gap:10px;">
  ${members.map(m => {
    const bg  = avatarColor(`${m.first_name} ${m.last_name}`)
    const ini = initials(m.first_name, m.last_name)
    return `
<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;
  cursor:pointer;transition:background 0.1s;" data-nm-member="${m.id}"
  onmouseenter="this.style.background='var(--mm-bg-hover)'"
  onmouseleave="this.style.background=''">
  <div style="width:36px;height:36px;border-radius:50%;background:${bg};
    display:flex;align-items:center;justify-content:center;color:#fff;
    font-size:13px;font-weight:700;flex-shrink:0;">${ini}</div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:13px;font-weight:600;color:var(--mm-text-primary);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      ${m.first_name} ${m.last_name}
    </div>
    <div style="font-size:11px;color:var(--mm-text-muted);">Joined ${fmtDate(m.join_date ?? m.created_at)}</div>
  </div>
  <span class="mm-badge ${m.membership_status === 'active' ? 'green' : 'blue'}" style="font-size:10px;">${m.membership_status}</span>
</div>`
  }).join('')}
  <button class="mm-btn-outline" style="width:100%;justify-content:center;font-size:12px;margin-top:4px;"
    id="nm-viewAll">View All Members →</button>
</div>`

      container.querySelectorAll<HTMLElement>('[data-nm-member]').forEach(el => {
        el.addEventListener('click', () => navigate(`/members/${el.dataset['nmMember']}`))
      })
      container.querySelector('#nm-viewAll')?.addEventListener('click', () => navigate('/members'))
    } catch {
      container.innerHTML = `<div style="font-size:12px;color:var(--mm-text-muted);padding:8px;">Could not load recent members.</div>`
    }
  },
  destroy() {},
}

export default NewMembersWidget
