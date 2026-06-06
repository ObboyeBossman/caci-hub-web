// src/modules/pastoral/pages/PrayerRequestCreate.ts
// Submit a new prayer request.
import type { PageModule }     from '../../../../types/module.types'
import { createPrayerRequest } from '../repository'

const PrayerRequestCreate: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:640px;margin:0 auto;">
  <a href="#/pastoral/prayer-requests" style="font-size:var(--text-sm);color:var(--mm-text-secondary);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:16px;">← Back to Prayer Requests</a>
  <h2 style="margin:0 0 20px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">New Prayer Request</h2>
  <div id="pr-create-msg" style="margin-bottom:12px;"></div>
  <form id="pr-create-form" style="display:flex;flex-direction:column;gap:16px;">
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Title <span style="color:#b91c1c;">*</span></label>
      <input id="pr-title" class="mm-input" placeholder="Brief description of the request" required style="width:100%;" />
    </div>
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Details</label>
      <textarea id="pr-description" class="mm-input" rows="4" placeholder="Optional additional context…" style="width:100%;resize:vertical;"></textarea>
    </div>
    <div>
      <label style="display:flex;align-items:center;gap:8px;font-size:var(--text-sm);font-weight:500;cursor:pointer;">
        <input type="checkbox" id="pr-anonymous" />
        Submit anonymously (member identity hidden from pastoral staff)
      </label>
    </div>
    <div style="display:flex;gap:10px;">
      <button type="submit" class="mm-btn-primary" id="pr-submit">Submit Request</button>
      <a href="#/pastoral/prayer-requests" style="text-decoration:none;"><button type="button" class="mm-btn-outline">Cancel</button></a>
    </div>
  </form>
</div>`

    const form = container.querySelector('#pr-create-form') as HTMLFormElement
    const msg  = container.querySelector('#pr-create-msg') as HTMLElement
    const btn  = container.querySelector('#pr-submit') as HTMLButtonElement

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      btn.disabled = true
      btn.textContent = 'Submitting…'
      msg.innerHTML = ''
      try {
        await createPrayerRequest({
          title:        (container.querySelector('#pr-title') as HTMLInputElement).value.trim(),
          description:  (container.querySelector('#pr-description') as HTMLTextAreaElement).value.trim() || null,
          is_anonymous: (container.querySelector('#pr-anonymous') as HTMLInputElement).checked,
        })
        location.hash = '#/pastoral/prayer-requests'
      } catch (err: any) {
        msg.innerHTML = `<div style="color:#b91c1c;font-size:var(--text-sm);">${err.message}</div>`
        btn.disabled = false
        btn.textContent = 'Submit Request'
      }
    })
  },
  destroy() {},
}

export default PrayerRequestCreate
