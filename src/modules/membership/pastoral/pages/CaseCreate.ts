// src/modules/pastoral/pages/CaseCreate.ts
// Create a new pastoral case.
import type { PageModule }      from '../../../../types/module.types'
import { createCase }           from '../repository'
import type { PastoralCaseType, PastoralPriority } from '../../../../types/pastoral.types'

const CaseCreate: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:640px;margin:0 auto;">
  <a href="#/pastoral/cases" style="font-size:var(--text-sm);color:var(--mm-text-secondary);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:16px;">← Back to Cases</a>
  <h2 style="margin:0 0 20px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">New Pastoral Case</h2>
  <div id="case-create-msg" style="margin-bottom:12px;"></div>
  <form id="case-create-form" style="display:flex;flex-direction:column;gap:16px;">
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Member ID <span style="color:#b91c1c;">*</span></label>
      <input id="cc-member-id" class="mm-input" placeholder="UUID of the member" required style="width:100%;" />
    </div>
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Case Type <span style="color:#b91c1c;">*</span></label>
      <select id="cc-type" class="mm-input" required style="width:100%;">
        <option value="follow_up">Follow Up</option>
        <option value="bereavement">Bereavement</option>
        <option value="illness">Illness</option>
        <option value="counselling">Counselling</option>
        <option value="discipline">Discipline</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Title <span style="color:#b91c1c;">*</span></label>
      <input id="cc-title" class="mm-input" placeholder="Brief case title" required style="width:100%;" />
    </div>
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Priority</label>
      <select id="cc-priority" class="mm-input" style="width:100%;">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:var(--text-sm);font-weight:500;margin-bottom:6px;">Description</label>
      <textarea id="cc-description" class="mm-input" rows="4" placeholder="Optional details…" style="width:100%;resize:vertical;"></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button type="submit" class="mm-btn-primary" id="cc-submit">Create Case</button>
      <a href="#/pastoral/cases" style="text-decoration:none;"><button type="button" class="mm-btn-outline">Cancel</button></a>
    </div>
  </form>
</div>`

    const form = container.querySelector('#case-create-form') as HTMLFormElement
    const msg  = container.querySelector('#case-create-msg') as HTMLElement
    const btn  = container.querySelector('#cc-submit') as HTMLButtonElement

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      btn.disabled = true
      btn.textContent = 'Creating…'
      msg.innerHTML = ''
      try {
        await createCase({
          member_id:   (container.querySelector('#cc-member-id') as HTMLInputElement).value.trim(),
          case_type:   (container.querySelector('#cc-type') as HTMLSelectElement).value as PastoralCaseType,
          title:       (container.querySelector('#cc-title') as HTMLInputElement).value.trim(),
          priority:    (container.querySelector('#cc-priority') as HTMLSelectElement).value as PastoralPriority,
          description: (container.querySelector('#cc-description') as HTMLTextAreaElement).value.trim() || null,
        })
        location.hash = '#/pastoral/cases'
      } catch (err: any) {
        msg.innerHTML = `<div style="color:#b91c1c;font-size:var(--text-sm);">${err.message}</div>`
        btn.disabled = false
        btn.textContent = 'Create Case'
      }
    })
  },
  destroy() {},
}

export default CaseCreate
