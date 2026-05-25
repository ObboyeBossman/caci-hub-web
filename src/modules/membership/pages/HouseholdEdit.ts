// src/modules/membership/pages/HouseholdEdit.ts
// Edit an existing household.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getHousehold, updateHousehold, getHouseholdDropdownItems } from '../repository'
import { injectMembershipCSS } from '../utils/member-helpers'

const HouseholdEdit: PageModule = {
  async render(container) {
    renderSkeleton(container, 'form')
    injectMembershipCSS()

    const id = container.dataset['id']
    if (!id) { renderError(container, new Error('No household ID in route')); return }

    let household: Awaited<ReturnType<typeof getHousehold>>
    try {
      household = await getHousehold(id)
    } catch (err) {
      renderError(container, err, { retry: () => HouseholdEdit.render(container) })
      return
    }

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:640px;margin:0 auto;">
  <button id="he-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:var(--mm-text-primary);">
      Edit Household
    </h2>

    <div class="mm-form-group">
      <label class="mm-form-label">Family Name <span style="color:var(--mm-red)">*</span></label>
      <input class="mm-form-input" id="he-familyName" value="${household.family_name}">
      <div class="mm-form-error" id="he-err-familyName">Family name is required.</div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Address</label>
      <input class="mm-form-input" id="he-address" value="${household.address ?? ''}">
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Primary Contact</label>
      <select class="mm-form-select" id="he-primaryContact">
        <option value="">None</option>
      </select>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="he-save" style="flex:1;">Save Changes</button>
      <button class="mm-btn-outline" id="he-cancel">Cancel</button>
    </div>
  </div>
</div>`

    container.querySelector('#he-back')?.addEventListener('click', () => navigate(`/households/${id}`))
    container.querySelector('#he-cancel')?.addEventListener('click', () => navigate(`/households/${id}`))

    // Populate members dropdown
    try {
      const members = household.members
      const sel = container.querySelector<HTMLSelectElement>('#he-primaryContact')!
      members.forEach(m => {
        const o = document.createElement('option')
        o.value = m.id
        o.textContent = `${m.first_name} ${m.last_name}`
        if (m.id === household.primary_contact_id) o.selected = true
        sel.appendChild(o)
      })
    } catch { /* non-fatal */ }

    container.querySelector('#he-save')?.addEventListener('click', async () => {
      const nameEl = container.querySelector<HTMLInputElement>('#he-familyName')!
      const name = nameEl.value.trim()
      const errEl = container.querySelector('#he-err-familyName')!

      if (!name) { errEl.classList.add('show'); nameEl.classList.add('error'); return }
      errEl.classList.remove('show'); nameEl.classList.remove('error')

      const btn = container.querySelector<HTMLButtonElement>('#he-save')!
      btn.disabled = true; btn.textContent = 'Saving…'

      try {
        await updateHousehold(id, {
          family_name:        name,
          address:            container.querySelector<HTMLInputElement>('#he-address')?.value.trim() || null,
          primary_contact_id: container.querySelector<HTMLSelectElement>('#he-primaryContact')?.value || null,
        })
        Toast.success('Household updated.')
        navigate(`/households/${id}`)
      } catch (err) {
        Toast.fromError(err)
        btn.disabled = false; btn.textContent = 'Save Changes'
      }
    })
  },

  destroy() {},
}

export default HouseholdEdit
