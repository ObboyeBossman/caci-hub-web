// src/modules/membership/pages/AddMember.ts
// Standalone full-page add-member form.
// Mirrors the modal form in MemberList.ts but rendered as a full page.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { registerMember } from '../services/memberService'
import { getHouseholdDropdownItems } from '../repository'
import { CreateMemberSchema } from '../schemas/member.schema'
import { injectMembershipCSS } from '../utils/member-helpers'

const AddMember: PageModule = {
  async render(container) {
    injectMembershipCSS()
    container.innerHTML = _buildHTML()

    // Populate household dropdown
    try {
      const items = await getHouseholdDropdownItems()
      const sel = container.querySelector<HTMLSelectElement>('#am-fHousehold')
      if (sel) {
        items.forEach(h => {
          const o = document.createElement('option')
          o.value = h.id; o.textContent = h.family_name
          sel.appendChild(o)
        })
      }
    } catch { /* non-fatal */ }

    // Set today as default join date
    const jEl = container.querySelector<HTMLInputElement>('#am-fJoined')
    if (jEl) jEl.value = new Date().toISOString().split('T')[0]

    container.querySelector('#am-cancel')?.addEventListener('click', () => navigate('/members'))
    container.querySelector('#am-save')?.addEventListener('click', () => _save(container))
  },

  destroy() {},
}

export default AddMember

function _buildHTML(): string { return `
<div class="mm-root" style="padding:24px;max-width:720px;margin:0 auto;">
  <button id="am-back-btn" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;"
    onclick="history.back()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Members
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 24px;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Add New Member</h2>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="mm-form-group">
        <label class="mm-form-label">First Name *</label>
        <input class="mm-form-input" id="am-fFirstName" placeholder="First name">
        <div class="mm-form-error" id="am-err-firstName">First name is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Last Name *</label>
        <input class="mm-form-input" id="am-fLastName" placeholder="Last name">
        <div class="mm-form-error" id="am-err-lastName">Last name is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Gender *</label>
        <select class="mm-form-select" id="am-fGender">
          <option value="">Select gender…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <div class="mm-form-error" id="am-err-gender">Gender is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Date of Birth</label>
        <input class="mm-form-input" id="am-fDOB" type="date">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Marital Status</label>
        <select class="mm-form-select" id="am-fMarital">
          <option value="">Select…</option>
          <option value="single">Single</option>
          <option value="married">Married</option>
          <option value="divorced">Divorced</option>
          <option value="widowed">Widowed</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Occupation</label>
        <input class="mm-form-input" id="am-fOccupation" placeholder="Job title or profession">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Phone Number *</label>
        <input class="mm-form-input" id="am-fPhone" placeholder="+233 …" type="tel">
        <div class="mm-form-error" id="am-err-phone">Phone number is required.</div>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Email</label>
        <input class="mm-form-input" id="am-fEmail" placeholder="email@example.com" type="email">
      </div>
      <div class="mm-form-group" style="grid-column:1/-1;">
        <label class="mm-form-label">Physical Address</label>
        <input class="mm-form-input" id="am-fAddress" placeholder="Home address">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Membership Status</label>
        <select class="mm-form-select" id="am-fStatus">
          <option value="visitor">Visitor</option>
          <option value="active">Active Member</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Join Date</label>
        <input class="mm-form-input" id="am-fJoined" type="date">
      </div>
      <div class="mm-form-group" style="grid-column:1/-1;">
        <label class="mm-form-label">Household</label>
        <select class="mm-form-select" id="am-fHousehold">
          <option value="">None</option>
        </select>
      </div>
    </div>

    <div style="border-top:1px solid var(--mm-border);margin:20px 0 16px;"></div>
    <div style="font-size:13px;font-weight:600;color:var(--mm-text-secondary);margin-bottom:14px;">EMERGENCY CONTACT (optional)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
      <div class="mm-form-group">
        <label class="mm-form-label">Name</label>
        <input class="mm-form-input" id="am-fECName" placeholder="Contact name">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Phone</label>
        <input class="mm-form-input" id="am-fECPhone" placeholder="Phone number">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Relationship</label>
        <select class="mm-form-select" id="am-fECRel">
          <option value="">Select…</option>
          <option value="spouse">Spouse</option>
          <option value="parent">Parent</option>
          <option value="sibling">Sibling</option>
          <option value="child">Child</option>
          <option value="friend">Friend</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Pastoral Notes (admin/pastor only)</label>
      <textarea class="mm-form-textarea" id="am-fNotes" rows="3" placeholder="Internal notes…"></textarea>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="am-save" style="flex:1;">Register Member</button>
      <button class="mm-btn-outline" id="am-cancel">Cancel</button>
    </div>
  </div>
</div>` }

async function _save(container: HTMLElement): Promise<void> {
  const get = (id: string) =>
    (container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '').trim()

  const firstName = get('am-fFirstName')
  const lastName  = get('am-fLastName')
  const phone     = get('am-fPhone')
  const gender    = get('am-fGender')

  let valid = true
  const showErr = (e: string, i: string) => { container.querySelector(`#${e}`)?.classList.add('show'); container.querySelector(`#${i}`)?.classList.add('error'); valid = false }
  const hideErr = (e: string, i: string) => { container.querySelector(`#${e}`)?.classList.remove('show'); container.querySelector(`#${i}`)?.classList.remove('error') }

  if (!firstName) showErr('am-err-firstName', 'am-fFirstName'); else hideErr('am-err-firstName', 'am-fFirstName')
  if (!lastName)  showErr('am-err-lastName',  'am-fLastName');  else hideErr('am-err-lastName',  'am-fLastName')
  if (!phone)     showErr('am-err-phone',     'am-fPhone');     else hideErr('am-err-phone',     'am-fPhone')
  if (!gender)    showErr('am-err-gender',    'am-fGender');    else hideErr('am-err-gender',    'am-fGender')
  if (!valid) return

  const payload = {
    first_name:                      firstName,
    last_name:                       lastName,
    gender:                          gender as 'male' | 'female',
    membership_status:               (get('am-fStatus') || 'visitor') as any,
    phone_number:                    phone || null,
    email:                           get('am-fEmail') || null,
    date_of_birth:                   get('am-fDOB') || null,
    marital_status:                  (get('am-fMarital') || null) as any,
    occupation:                      get('am-fOccupation') || null,
    physical_address:                get('am-fAddress') || null,
    join_date:                       get('am-fJoined') || null,
    household_id:                    get('am-fHousehold') || null,
    emergency_contact_name:          get('am-fECName') || null,
    emergency_contact_phone:         get('am-fECPhone') || null,
    emergency_contact_relationship:  get('am-fECRel') || null,
    pastoral_notes:                  get('am-fNotes') || null,
  }

  const parse = CreateMemberSchema.safeParse({ assembly_id: '00000000-0000-0000-0000-000000000000', ...payload })
  if (!parse.success) { Toast.error(parse.error.errors[0]?.message ?? 'Validation failed'); return }

  const btn = container.querySelector<HTMLButtonElement>('#am-save')!
  btn.disabled = true; btn.textContent = 'Registering…'

  try {
    const result = await registerMember(payload)
    let msg = `${firstName} ${lastName} registered successfully.`
    if (result.membershipNumber) msg += ` Membership #: ${result.membershipNumber}`
    Toast.success(msg)
    navigate(`/members/${result.member.id}`)
  } catch (err) {
    Toast.fromError(err)
    btn.disabled = false; btn.textContent = 'Register Member'
  }
}
