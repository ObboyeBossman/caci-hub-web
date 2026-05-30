// src/modules/membership/pages/EditMember.ts
// Standalone full-page edit-member form.
// Reads member ID from container.dataset.id.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getMember, updateMember } from '../repository'
import { getHouseholdDropdownItems } from '../repository'
import { UpdateMemberSchema } from '../schemas/member.schema'
import { injectMembershipCSS } from '../utils/member-helpers'
import type { MemberView } from '../../../types/member.types'
import { PhoneInput } from '@shared/components/PhoneInput'

let _primaryPhone: PhoneInput | null = null
let _secondaryPhone: PhoneInput | null = null

const EditMember: PageModule = {
  async render(container) {
    renderSkeleton(container, 'form')
    injectMembershipCSS()

    const id = container.dataset['id']
    if (!id) { renderError(container, new Error('No member ID in route')); return }

    let member: MemberView
    try {
      member = await getMember(id)
    } catch (err) {
      renderError(container, err, { retry: () => EditMember.render(container) })
      return
    }

    container.innerHTML = _buildHTML(member)

    // ── Mount PhoneInput components ───────────────────────────────────────────────
    const primarySlot   = container.querySelector<HTMLElement>('#em-phone-primary-slot')
    const secondarySlot = container.querySelector<HTMLElement>('#em-phone-secondary-slot')

    if (primarySlot) {
      _primaryPhone = new PhoneInput({ id: 'em-primary', placeholder: '24 123 4567', selectClass: 'mm-form-select', inputClass: 'mm-form-input' })
      _primaryPhone.mount(primarySlot)
      if (member.primary_phone) _primaryPhone.setValue(member.primary_phone)
    }

    if (secondarySlot) {
      _secondaryPhone = new PhoneInput({ id: 'em-secondary', placeholder: '24 123 4567', selectClass: 'mm-form-select', inputClass: 'mm-form-input' })
      _secondaryPhone.mount(secondarySlot)
      if (member.secondary_phone) _secondaryPhone.setValue(member.secondary_phone)
    }

    // Populate household dropdown
    try {
      const items = await getHouseholdDropdownItems()
      const sel = container.querySelector<HTMLSelectElement>('#em-fHousehold')
      if (sel) {
        items.forEach(h => {
          const o = document.createElement('option')
          o.value = h.id; o.textContent = h.family_name
          if (h.id === member.household_id) o.selected = true
          sel.appendChild(o)
        })
      }
    } catch { /* non-fatal */ }

    container.querySelector('#em-cancel')?.addEventListener('click', () => navigate(`/members/${id}`))
    container.querySelector('#em-save')?.addEventListener('click', () => _save(container, id, member))
  },

  destroy() {
    _primaryPhone   = null
    _secondaryPhone = null
  },}

export default EditMember

function _buildHTML(m: MemberView): string { return `
<div class="mm-root" style="padding:24px;max-width:720px;margin:0 auto;">
  <button style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size: var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;"
    onclick="history.back()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;font-size: var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Edit Member</h2>
    <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-bottom:24px;">
      ${formatName(m.first_name, m.last_name, m.title)} · ${m.membership_number ?? 'No membership number'}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="mm-form-group" style="grid-column:1/-1;">
        <label class="mm-form-label">Title</label>
        <select class="mm-form-select" id="em-fTitle" style="max-width:200px;">
          <option value="">None</option>
          <option value="Mr." ${m.title === 'Mr.' ? 'selected' : ''}>Mr.</option>
          <option value="Mrs." ${m.title === 'Mrs.' ? 'selected' : ''}>Mrs.</option>
          <option value="Ms." ${m.title === 'Ms.' ? 'selected' : ''}>Ms.</option>
          <option value="Miss" ${m.title === 'Miss' ? 'selected' : ''}>Miss</option>
          <option value="Dr." ${m.title === 'Dr.' ? 'selected' : ''}>Dr.</option>
          <option value="Prof." ${m.title === 'Prof.' ? 'selected' : ''}>Prof.</option>
          <option value="Rev." ${m.title === 'Rev.' ? 'selected' : ''}>Rev.</option>
          <option value="Pastor" ${m.title === 'Pastor' ? 'selected' : ''}>Pastor</option>
          <option value="Elder" ${m.title === 'Elder' ? 'selected' : ''}>Elder</option>
          <option value="Deacon" ${m.title === 'Deacon' ? 'selected' : ''}>Deacon</option>
          <option value="Deaconess" ${m.title === 'Deaconess' ? 'selected' : ''}>Deaconess</option>
          <option value="Apostle" ${m.title === 'Apostle' ? 'selected' : ''}>Apostle</option>
          <option value="Bishop" ${m.title === 'Bishop' ? 'selected' : ''}>Bishop</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">First Name *</label>
        <input class="mm-form-input" id="em-fFirstName" value="${m.first_name}">
        <div class="mm-form-error" id="em-err-firstName">First name is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Last Name *</label>
        <input class="mm-form-input" id="em-fLastName" value="${m.last_name}">
        <div class="mm-form-error" id="em-err-lastName">Last name is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Gender *</label>
        <select class="mm-form-select" id="em-fGender">
          <option value="male" ${m.gender === 'male' ? 'selected' : ''}>Male</option>
          <option value="female" ${m.gender === 'female' ? 'selected' : ''}>Female</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Date of Birth</label>
        <input class="mm-form-input" id="em-fDOB" type="date" value="${m.date_of_birth ?? ''}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Marital Status</label>
        <select class="mm-form-select" id="em-fMarital">
          <option value="">Select…</option>
          <option value="single" ${m.marital_status === 'single' ? 'selected' : ''}>Single</option>
          <option value="married" ${m.marital_status === 'married' ? 'selected' : ''}>Married</option>
          <option value="divorced" ${m.marital_status === 'divorced' ? 'selected' : ''}>Divorced</option>
          <option value="widowed" ${m.marital_status === 'widowed' ? 'selected' : ''}>Widowed</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Occupation</label>
        <input class="mm-form-input" id="em-fOccupation" value="${m.occupation ?? ''}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Primary Phone</label>
        <!-- PhoneInput mounts here -->
        <div id="em-phone-primary-slot"></div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Secondary Phone</label>
        <!-- PhoneInput mounts here -->
        <div id="em-phone-secondary-slot"></div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Email</label>
        <input class="mm-form-input" id="em-fEmail" type="email" value="${m.email ?? ''}">
      </div>
      <div class="mm-form-group" style="grid-column:1/-1;">
        <label class="mm-form-label">Physical Address</label>
        <input class="mm-form-input" id="em-fAddress" value="${m.physical_address ?? ''}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Membership Status</label>
        <select class="mm-form-select" id="em-fStatus">
          <option value="visitor"  ${m.membership_status === 'visitor'  ? 'selected' : ''}>Visitor</option>
          <option value="active"   ${m.membership_status === 'active'   ? 'selected' : ''}>Active Member</option>
          <option value="prospect" ${m.membership_status === 'prospect' ? 'selected' : ''}>Prospect</option>
          <option value="inactive" ${m.membership_status === 'inactive' ? 'selected' : ''}>Inactive</option>
          <option value="transfer" ${m.membership_status === 'transfer' ? 'selected' : ''}>Transfer</option>
          <option value="deceased" ${m.membership_status === 'deceased' ? 'selected' : ''}>Deceased</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Join Date</label>
        <input class="mm-form-input" id="em-fJoined" type="date" value="${m.join_date ?? ''}">
      </div>
      <div class="mm-form-group" style="grid-column:1/-1;">
        <label class="mm-form-label">Household</label>
        <select class="mm-form-select" id="em-fHousehold">
          <option value="">None</option>
        </select>
      </div>
    </div>

    <div style="border-top:1px solid var(--mm-border);margin:20px 0 16px;"></div>
    <div style="font-size: var(--text-base);font-weight:600;color:var(--mm-text-secondary);margin-bottom:14px;">EMERGENCY CONTACT</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
      <div class="mm-form-group">
        <label class="mm-form-label">Name</label>
        <input class="mm-form-input" id="em-fECName" value="${m.emergency_contact_name ?? ''}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Phone</label>
        <input class="mm-form-input" id="em-fECPhone" value="${m.emergency_contact_phone ?? ''}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Relationship</label>
        <select class="mm-form-select" id="em-fECRel">
          <option value="">Select…</option>
          <option value="spouse"  ${m.emergency_contact_relationship === 'spouse'  ? 'selected' : ''}>Spouse</option>
          <option value="parent"  ${m.emergency_contact_relationship === 'parent'  ? 'selected' : ''}>Parent</option>
          <option value="sibling" ${m.emergency_contact_relationship === 'sibling' ? 'selected' : ''}>Sibling</option>
          <option value="child"   ${m.emergency_contact_relationship === 'child'   ? 'selected' : ''}>Child</option>
          <option value="friend"  ${m.emergency_contact_relationship === 'friend'  ? 'selected' : ''}>Friend</option>
          <option value="other"   ${m.emergency_contact_relationship === 'other'   ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Pastoral Notes (admin/pastor only)</label>
      <textarea class="mm-form-textarea" id="em-fNotes" rows="3">${m.pastoral_notes ?? ''}</textarea>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="em-save" style="flex:1;">Save Changes</button>
      <button class="mm-btn-outline" id="em-cancel">Cancel</button>
    </div>
  </div>
</div>` }

async function _save(container: HTMLElement, id: string, original: MemberView): Promise<void> {
  const get = (sel: string) =>
    (container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${sel}`)?.value ?? '').trim()

  const firstName    = get('em-fFirstName')
  const lastName     = get('em-fLastName')
  const primaryPhone = _primaryPhone?.getValue()   ?? ''
  const secondaryPhone= _secondaryPhone?.getValue() ?? ''
  const email        = get('em-fEmail')

  let valid = true
  const showErr = (e: string, i: string) => { container.querySelector(`#${e}`)?.classList.add('show'); container.querySelector(`#${i}`)?.classList.add('error'); valid = false }
  const hideErr = (e: string, i: string) => { container.querySelector(`#${e}`)?.classList.remove('show'); container.querySelector(`#${i}`)?.classList.remove('error') }
  if (!firstName) showErr('em-err-firstName','em-fFirstName'); else hideErr('em-err-firstName','em-fFirstName')
  if (!lastName)  showErr('em-err-lastName', 'em-fLastName');  else hideErr('em-err-lastName', 'em-fLastName')
  _primaryPhone?.setError(null)
  if (!valid) return

  const payload = {
    title:                          get('em-fTitle') || null,
    first_name:                     firstName,
    last_name:                      lastName,
    gender:                         get('em-fGender') as any,
    membership_status:              get('em-fStatus') as any,
    primary_phone:                  primaryPhone || null,
    secondary_phone:                secondaryPhone || null,
    email:                          get('em-fEmail') || null,
    date_of_birth:                  get('em-fDOB') || null,
    marital_status:                 (get('em-fMarital') || null) as any,
    occupation:                     get('em-fOccupation') || null,
    physical_address:               get('em-fAddress') || null,
    join_date:                      get('em-fJoined') || null,
    household_id:                   get('em-fHousehold') || null,
    emergency_contact_name:         get('em-fECName') || null,
    emergency_contact_phone:        get('em-fECPhone') || null,
    emergency_contact_relationship: get('em-fECRel') || null,
    pastoral_notes:                 get('em-fNotes') || null,
  }

  const parse = UpdateMemberSchema.safeParse({ id, ...payload })
  if (!parse.success) { Toast.error(parse.error.errors[0]?.message ?? 'Validation failed'); return }

  const btn = container.querySelector<HTMLButtonElement>('#em-save')!
  btn.disabled = true; btn.textContent = 'Saving…'
  try {
    await updateMember(id, payload)
    Toast.success(`${firstName} ${lastName} updated.`)
    navigate(`/members/${id}`)
  } catch (err) {
    Toast.fromError(err)
    btn.disabled = false; btn.textContent = 'Save Changes'
  }
}
