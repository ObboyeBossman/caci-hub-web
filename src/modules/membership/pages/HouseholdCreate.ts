// src/modules/membership/pages/HouseholdCreate.ts
// Create a new household.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { createHousehold, getHouseholdDropdownItems } from '../repository'
import { injectMembershipCSS } from '../utils/member-helpers'
import type { HouseholdDropdownItem } from '../../../types/member.types'

const HouseholdCreate: PageModule = {
  async render(container) {
    injectMembershipCSS()

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:640px;margin:0 auto;">
  <button id="hc-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size: var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Households
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 20px;font-size: var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">New Household</h2>

    <div class="mm-form-group">
      <label class="mm-form-label">Family Name <span style="color:var(--mm-red)">*</span></label>
      <input class="mm-form-input" id="hc-familyName" placeholder="e.g. Mensah Family">
      <div class="mm-form-error" id="hc-err-familyName">Family name is required.</div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Address</label>
      <input class="mm-form-input" id="hc-address" placeholder="Physical address (optional)">
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Primary Contact</label>
      <select class="mm-form-select" id="hc-primaryContact">
        <option value="">Select member… (optional)</option>
      </select>
      <div style="font-size: var(--text-xs);color:var(--mm-text-muted);margin-top:4px;">
        You can also set this after adding members to the household.
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="hc-save" style="flex:1;">Create Household</button>
      <button class="mm-btn-outline" id="hc-cancel">Cancel</button>
    </div>
  </div>
</div>`

    container.querySelector('#hc-back')?.addEventListener('click', () => navigate('/households'))
    container.querySelector('#hc-cancel')?.addEventListener('click', () => navigate('/households'))

    // Populate member dropdown in background (non-fatal)
    try {
      const members = await getHouseholdDropdownItems()
      _populateMembers(container, members)
    } catch { /* non-fatal */ }

    container.querySelector('#hc-save')?.addEventListener('click', async () => {
      const nameEl = container.querySelector<HTMLInputElement>('#hc-familyName')!
      const name = nameEl.value.trim()
      const errEl = container.querySelector('#hc-err-familyName')!

      if (!name) {
        errEl.classList.add('show')
        nameEl.classList.add('error')
        return
      }
      errEl.classList.remove('show')
      nameEl.classList.remove('error')

      const btn = container.querySelector<HTMLButtonElement>('#hc-save')!
      btn.disabled = true; btn.textContent = 'Creating…'

      try {
        const hh = await createHousehold({
          family_name:        name,
          address:            container.querySelector<HTMLInputElement>('#hc-address')?.value.trim() || null,
          primary_contact_id: container.querySelector<HTMLSelectElement>('#hc-primaryContact')?.value || null,
        })
        Toast.success(`Household "${hh.family_name}" created.`)
        navigate(`/households/${hh.id}`)
      } catch (err) {
        Toast.fromError(err)
        btn.disabled = false; btn.textContent = 'Create Household'
      }
    })
  },

  destroy() {},
}

function _populateMembers(container: HTMLElement, members: HouseholdDropdownItem[]): void {
  const sel = container.querySelector<HTMLSelectElement>('#hc-primaryContact')
  if (!sel) return
  members.forEach(m => {
    const o = document.createElement('option')
    o.value = m.id; o.textContent = m.family_name
    sel.appendChild(o)
  })
}

export default HouseholdCreate
