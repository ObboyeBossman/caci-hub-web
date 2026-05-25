// src/modules/membership/pages/GroupCreate.ts
// Create or edit a group.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { injectMembershipCSS } from '../utils/member-helpers'

const GroupCreate: PageModule = {
  async render(container) {
    injectMembershipCSS()
    const isEdit = !!(new URLSearchParams(location.hash.split('?')[1] ?? '')).get('id')

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:640px;margin:0 auto;">
  <button style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;"
    onclick="history.back()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Groups
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 22px;font-size:20px;font-weight:700;color:var(--mm-text-primary);">
      ${isEdit ? 'Edit Group' : 'New Group'}
    </h2>

    <div class="mm-form-group">
      <label class="mm-form-label">Group Name *</label>
      <input class="mm-form-input" id="gc-name" placeholder="e.g. Youth Ministry">
      <div class="mm-form-error" id="gc-err-name">Group name is required.</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="mm-form-group">
        <label class="mm-form-label">Type</label>
        <select class="mm-form-select" id="gc-type">
          <option value="Department">Department</option>
          <option value="Fellowship">Fellowship</option>
          <option value="Ministry">Ministry</option>
          <option value="Committee">Committee</option>
          <option value="Cell Group">Cell Group</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Meeting Day</label>
        <select class="mm-form-select" id="gc-day">
          <option value="">No fixed day</option>
          <option value="Monday">Monday</option>
          <option value="Tuesday">Tuesday</option>
          <option value="Wednesday">Wednesday</option>
          <option value="Thursday">Thursday</option>
          <option value="Friday">Friday</option>
          <option value="Saturday">Saturday</option>
          <option value="Sunday">Sunday</option>
        </select>
      </div>
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Leader</label>
      <input class="mm-form-input" id="gc-leader" placeholder="Leader name">
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Description</label>
      <textarea class="mm-form-textarea" id="gc-desc" rows="3" placeholder="Brief description of this group…"></textarea>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="gc-save" style="flex:1;">${isEdit ? 'Save Changes' : 'Create Group'}</button>
      <button class="mm-btn-outline" id="gc-cancel">Cancel</button>
    </div>
  </div>
</div>`

    container.querySelector('#gc-cancel')?.addEventListener('click', () => navigate('/groups'))
    container.querySelector('#gc-save')?.addEventListener('click', () => {
      const name = (container.querySelector<HTMLInputElement>('#gc-name')?.value ?? '').trim()
      if (!name) { container.querySelector('#gc-err-name')?.classList.add('show'); return }
      container.querySelector('#gc-err-name')?.classList.remove('show')
      // TODO: Persist to groups table when backend table is available
      Toast.success(isEdit ? 'Group updated.' : 'Group created.')
      navigate('/groups')
    })
  },

  destroy() {},
}

export default GroupCreate
