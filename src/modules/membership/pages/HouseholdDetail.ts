// src/modules/membership/pages/HouseholdDetail.ts
// Full household detail: header, member list, edit/delete/primary-contact actions.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getHousehold, deleteHousehold, getAvailablePrimaryContacts, setPrimaryContact } from '../repository'
import type { HouseholdWithMembers } from '../../../types/member.types'
import { avatarColor, initials, statusBadge, fmtDate, injectMembershipCSS } from '../utils/member-helpers'

let _container: HTMLElement | null = null

const HouseholdDetail: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'profile')
    injectMembershipCSS()

    const householdId = container.dataset['id']
    if (!householdId) { renderError(container, new Error('No household ID in route')); return }

    let household: HouseholdWithMembers
    try {
      household = await getHousehold(householdId)
    } catch (err) {
      renderError(container, err, { retry: () => HouseholdDetail.render(container) })
      return
    }

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">

  <button id="hd-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Households
  </button>

  <!-- Header card -->
  <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:24px;
    background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;flex-wrap:wrap;">
    <div style="width:64px;height:64px;border-radius:12px;background:var(--mm-blue);
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-size:24px;font-weight:700;flex-shrink:0;">
      ${household.family_name[0]?.toUpperCase() ?? 'H'}
    </div>
    <div style="flex:1;">
      <div style="font-size:22px;font-weight:700;color:var(--mm-text-primary);margin-bottom:4px;">
        ${household.family_name}
      </div>
      <div style="font-size:13px;color:var(--mm-text-secondary);">
        ${household.address ?? 'No address on record'}
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <span class="mm-badge blue">${household.member_count} member${household.member_count === 1 ? '' : 's'}</span>
        ${household.primary_contact_name ? `<span class="mm-badge">Contact: ${household.primary_contact_name}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="mm-btn-primary" id="hd-editBtn">Edit</button>
      <button class="mm-btn-outline" id="hd-setPrimaryBtn">Set Primary Contact</button>
      <button class="mm-btn-danger" id="hd-deleteBtn">Delete</button>
    </div>
  </div>

  <!-- Members list -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid var(--mm-border);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:15px;font-weight:600;color:var(--mm-text-primary);">Household Members</div>
    </div>
    ${household.members.length === 0
      ? `<div style="padding:32px;text-align:center;color:var(--mm-text-secondary);font-size:13px;">
           No members linked to this household yet.
         </div>`
      : `<table class="mm-table">
           <thead><tr><th>Name</th><th>Status</th><th>Joined</th><th>Phone</th><th></th></tr></thead>
           <tbody>
             ${household.members.map(m => {
               const s = statusBadge(m.membership_status)
               const bg = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
               const ini = initials(m.first_name, m.last_name)
               return `<tr>
                 <td>
                   <div class="mm-table-name-cell">
                     <div class="mm-table-avatar" style="background:${bg}">${ini}</div>
                     <div>
                       <div class="mm-table-name">${formatName(m.first_name, m.last_name, m.title)}</div>
                       <div class="mm-table-email">${m.email ?? '—'}</div>
                     </div>
                   </div>
                 </td>
                 <td><span class="mm-badge ${s.cls}">${s.label}</span></td>
                 <td style="font-size:12px;">${fmtDate(m.join_date)}</td>
                 <td style="font-size:12px;">${m.primary_phone ?? '—'}</td>
                 <td>
                   <button class="mm-btn-icon" data-hd-view-member="${m.id}" title="View profile">
                     <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                   </button>
                 </td>
               </tr>`
             }).join('')}
           </tbody>
         </table>`}
  </div>
</div>`

    // Back
    container.querySelector('#hd-back')?.addEventListener('click', () => navigate('/households'))

    // Edit
    container.querySelector('#hd-editBtn')?.addEventListener('click', () =>
      navigate(`/households/${household.id}/edit`)
    )

    // Delete
    container.querySelector('#hd-deleteBtn')?.addEventListener('click', async () => {
      if (household.member_count > 0) {
        Toast.warning('Cannot delete a household with members. Unlink all members first.')
        return
      }
      if (!confirm(`Delete "${household.family_name}"? This cannot be undone.`)) return
      try {
        await deleteHousehold(household.id)
        Toast.success('Household deleted.')
        navigate('/households')
      } catch (err) {
        Toast.fromError(err)
      }
    })

    // Set primary contact
    container.querySelector('#hd-setPrimaryBtn')?.addEventListener('click', async () => {
      if (household.members.length === 0) { Toast.warning('No members to set as primary contact.'); return }
      try {
        const contacts = await getAvailablePrimaryContacts(household.id)
        const names = contacts.map(c => `${c.id}: ${c.full_name}`).join('\n')
        const chosen = prompt(`Select primary contact by ID:\n\n${names}`)
        if (!chosen) return
        const memberId = contacts.find(c => c.id === chosen.trim() || c.full_name.toLowerCase() === chosen.trim().toLowerCase())?.id
        if (!memberId) { Toast.error('Member not found.'); return }
        await setPrimaryContact(household.id, memberId)
        Toast.success('Primary contact updated.')
        HouseholdDetail.render(container)
      } catch (err) {
        Toast.fromError(err)
      }
    })

    // View member
    container.querySelectorAll<HTMLElement>('[data-hd-view-member]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/members/${btn.dataset['hdViewMember']}`))
    })
  },

  destroy() { _container = null },
}

export default HouseholdDetail
