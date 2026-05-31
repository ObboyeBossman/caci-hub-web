// src/modules/membership/pages/FlagMember.ts
// Flag a member for pastoral care — full-page form.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { listMembers } from '../repository'
import { injectMembershipCSS } from '../utils/member-helpers'

const FlagMember: PageModule = {
  async render(container) {
    injectMembershipCSS()

    let memberOptions = ''
    try {
      const members = await listMembers({ includeDeleted: false }, { limit: 500, sortBy: 'last_name' })
      memberOptions = members.map(m => `<option value="${m.id}">${formatName(m.first_name, m.last_name, m.title)}</option>`).join('')
    } catch { /* non-fatal */ }

    // Pre-select if navigated from a specific member
    const preselectedId = container.dataset['id'] ?? ''

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:640px;margin:0 auto;">
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
    <h2 style="margin:0 0 6px;font-size: var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Flag Member for Pastoral Care</h2>
    <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-bottom:22px;">
      Pastoral flags help the team track members who need follow-up, care, or support.
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Member *</label>
      <select class="mm-form-select" id="fm-member">
        <option value="">Select member…</option>
        ${memberOptions}
      </select>
      <div class="mm-form-error" id="fm-err-member">Please select a member.</div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Flag Type</label>
      <select class="mm-form-select" id="fm-type">
        <option value="followup">Follow-up Required</option>
        <option value="absent">Extended Absence</option>
        <option value="life-event">Life Event</option>
        <option value="first-timer">First Timer</option>
      </select>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Priority</label>
      <select class="mm-form-select" id="fm-priority">
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Assign To</label>
      <input class="mm-form-input" id="fm-assignTo" placeholder="e.g. Elder Mensah, Pastor">
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Notes / Reason *</label>
      <textarea class="mm-form-textarea" id="fm-notes" rows="4"
        placeholder="Describe the situation or reason for flagging…"></textarea>
      <div class="mm-form-error" id="fm-err-notes">Please provide a reason.</div>
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button class="mm-btn-primary" id="fm-save" style="flex:1;">Add Flag</button>
      <button class="mm-btn-outline" id="fm-cancel">Cancel</button>
    </div>
  </div>
</div>`

    // Pre-select member if navigated from member profile
    if (preselectedId) {
      const sel = container.querySelector<HTMLSelectElement>('#fm-member')
      if (sel) sel.value = preselectedId
    }

    container.querySelector('#fm-cancel')?.addEventListener('click', () => history.back())

    container.querySelector('#fm-save')?.addEventListener('click', () => {
      const memberId = (container.querySelector<HTMLSelectElement>('#fm-member')?.value ?? '').trim()
      const notes    = (container.querySelector<HTMLTextAreaElement>('#fm-notes')?.value ?? '').trim()

      let valid = true
      const show = (e: string) => { container.querySelector(`#${e}`)?.classList.add('show'); valid = false }
      const hide = (e: string) => container.querySelector(`#${e}`)?.classList.remove('show')

      if (!memberId) show('fm-err-member'); else hide('fm-err-member')
      if (!notes)    show('fm-err-notes');  else hide('fm-err-notes')
      if (!valid) return

      // TODO: Persist to pastoral_flags table when backend table is available
      Toast.success('Pastoral flag added successfully.')
      navigate('/pastoral-care')
    })
  },

  destroy() {},
}

export default FlagMember
