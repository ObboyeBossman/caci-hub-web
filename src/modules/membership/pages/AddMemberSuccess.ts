// src/modules/membership/pages/AddMemberSuccess.ts
// Success/confirmation page after member registration.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import { navigate } from '@core/router'
import { getMember } from '../repository'
import { avatarColor, initials, injectMembershipCSS } from '../utils/member-helpers'

const AddMemberSuccess: PageModule = {
  async render(container: HTMLElement) {
    injectMembershipCSS()

    const memberId       = container.dataset['id']
    const membershipNum  = container.dataset['number'] ?? null
    const firstName      = container.dataset['firstName'] ?? 'Member'
    const lastName       = container.dataset['lastName'] ?? ''

    let bg  = '#004BA0'
    let ini = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()

    // Try to load real member for avatar colour (non-fatal)
    if (memberId) {
      try {
        const m = await getMember(memberId)
        bg  = avatarColor(`${formatName(m.first_name, m.last_name, m.title)}`)
        ini = initials(m.first_name, m.last_name)
      } catch { /* non-fatal */ }
    }

    container.innerHTML = `
<div class="mm-root" style="display:flex;align-items:center;justify-content:center;
  min-height:70vh;padding:40px;">
  <div style="text-align:center;max-width:440px;">
    <!-- Checkmark animation -->
    <div style="width:80px;height:80px;border-radius:50%;background:var(--mm-green);
      display:flex;align-items:center;justify-content:center;margin:0 auto 20px;
      box-shadow:0 0 0 12px rgba(31,198,100,0.15);">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>

    <!-- Avatar -->
    <div style="width:64px;height:64px;border-radius:50%;background:${bg};
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-size: var(--text-3xl);font-weight:700;margin:0 auto 12px;">${ini}</div>

    <h2 style="margin:0 0 6px;font-size: var(--text-3xl);font-weight:700;color:var(--mm-text-primary);">
      ${firstName} ${lastName} Registered!
    </h2>
    <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-bottom:${membershipNum ? '6px' : '28px'};">
      The member record has been created successfully.
    </div>
    ${membershipNum ? `<div style="font-size: var(--text-base);font-family:monospace;background:var(--mm-bg-card);
      border:1px solid var(--mm-border);border-radius:6px;padding:8px 16px;
      display:inline-block;margin-bottom:28px;color:var(--mm-text-primary);">
      Membership # <strong>${membershipNum}</strong>
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:10px;max-width:260px;margin:0 auto;">
      ${memberId ? `<button class="mm-btn-primary" style="justify-content:center;"
        id="ams-viewProfile">View Profile</button>` : ''}
      <button class="mm-btn-outline" style="justify-content:center;" id="ams-addAnother">
        Add Another Member
      </button>
      <button class="mm-btn-outline" style="justify-content:center;" id="ams-goToList">
        Go to Members List
      </button>
    </div>
  </div>
</div>`

    if (memberId) {
      container.querySelector('#ams-viewProfile')?.addEventListener('click', () =>
        navigate(`/members/${memberId}`)
      )
    }
    container.querySelector('#ams-addAnother')?.addEventListener('click', () => navigate('/members/add'))
    container.querySelector('#ams-goToList')?.addEventListener('click',   () => navigate('/members'))
  },

  destroy() {},
}

export default AddMemberSuccess
