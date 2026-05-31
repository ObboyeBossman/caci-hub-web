// src/modules/accounts/pages/ProvisionAccount.ts
// Provision a login for an existing member.
// Navigated to from MemberProfile via navigate(`/accounts/provision/${member.id}`).

import type { PageModule }             from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast }                       from '@shared/components/Toast'
import { navigate }                    from '@core/router'
import { getMemberStub, provisionUser } from '../repository'
import type { UserRoleEnum }           from '../../../types/database.types'

const ASSIGNABLE_ROLES: { value: UserRoleEnum; label: string }[] = [
  { value: 'member',           label: 'Member' },
  { value: 'admin',            label: 'Admin' },
]

const ProvisionAccount: PageModule = {
  async render(container) {
    renderSkeleton(container, 'profile')

    const memberId = container.dataset['memberId']
    if (!memberId) { renderError(container, new Error('No member ID in route')); return }

    // Fetch minimal member data to pre-fill the form
    const member = await getMemberStub(memberId)

    // If member already has an auth user, redirect to their account detail
    if (member?.authUserId) {
      navigate(`/admin/users/${member.authUserId}`)
      return
    }

    if (!member) {
      renderError(container, new Error('Member not found or no access.'))
      return
    }

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:540px;margin:0 auto;">

  <!-- Back -->
  <button id="pa-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size: var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:28px;">

    <h2 style="margin:0 0 4px;font-size:1.125rem;font-weight:700;color:var(--mm-text-primary);">
      Provision Login
    </h2>
    <p style="margin:0 0 24px;font-size: var(--text-base);color:var(--mm-text-secondary);">
      Creating a system account for <strong>${member.fullName}</strong>
    </p>

    <form id="pa-form">
      <!-- Email -->
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:6px;font-size: var(--text-base);font-weight:500;
          color:var(--mm-text-secondary);">Email</label>
        <input type="email" id="pa-email" value="${member.email ?? ''}"
          placeholder="user@example.com"
          style="width:100%;padding:9px 12px;border:1px solid var(--mm-border);
            border-radius:6px;font-size: var(--text-base);font-family:inherit;
            background:var(--mm-bg-card);color:var(--mm-text-primary);
            box-sizing:border-box;" />
        <p style="margin:4px 0 0;font-size: var(--text-xs);color:var(--mm-text-muted);">
          Required for email invite method.
        </p>
      </div>

      <!-- Role -->
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:6px;font-size: var(--text-base);font-weight:500;
          color:var(--mm-text-secondary);">Initial Role</label>
        <select id="pa-role" style="width:100%;padding:9px 12px;
          border:1px solid var(--mm-border);border-radius:6px;font-size: var(--text-base);
          font-family:inherit;background:var(--mm-bg-card);color:var(--mm-text-primary);">
          ${ASSIGNABLE_ROLES.map(r =>
            `<option value="${r.value}">${r.label}</option>`
          ).join('')}
        </select>
      </div>

      <!-- Method -->
      <div style="margin-bottom:24px;">
        <label style="display:block;margin-bottom:6px;font-size: var(--text-base);font-weight:500;
          color:var(--mm-text-secondary);">Provisioning Method</label>
        <select id="pa-method" style="width:100%;padding:9px 12px;
          border:1px solid var(--mm-border);border-radius:6px;font-size: var(--text-base);
          font-family:inherit;background:var(--mm-bg-card);color:var(--mm-text-primary);">
          <option value="invite">Send Email Invite</option>
          <option value="default_password">Use Assembly Default Password</option>
        </select>
      </div>

      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button type="button" id="pa-cancel" class="mm-btn-outline">Cancel</button>
        <button type="submit" id="pa-submit" class="mm-btn-primary">Provision Account</button>
      </div>
    </form>

  </div>
</div>
`

    // Back / Cancel
    const goBack = () => history.length > 1 ? history.back() : navigate('/admin/users')
    container.querySelector('#pa-back')?.addEventListener('click', goBack)
    container.querySelector('#pa-cancel')?.addEventListener('click', goBack)

    // Submit
    const form = container.querySelector<HTMLFormElement>('#pa-form')!
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const submitBtn = form.querySelector<HTMLButtonElement>('#pa-submit')!
      const email  = (form.querySelector<HTMLInputElement>('#pa-email')!).value.trim()
      const role   = (form.querySelector<HTMLSelectElement>('#pa-role')!).value as UserRoleEnum
      const method = (form.querySelector<HTMLSelectElement>('#pa-method')!).value as 'invite' | 'default_password'

      submitBtn.disabled = true
      submitBtn.textContent = 'Provisioning…'

      try {
        const { userId } = await provisionUser({ memberId, role, path: method, email })
        Toast.success('Account provisioned successfully.')
        navigate(`/admin/users/${userId}`)
      } catch (err: any) {
        Toast.error(err.message || 'Provisioning failed')
        submitBtn.disabled = false
        submitBtn.textContent = 'Provision Account'
      }
    })
  },
}

export default ProvisionAccount
