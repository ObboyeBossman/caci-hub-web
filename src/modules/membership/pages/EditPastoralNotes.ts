// src/modules/membership/pages/EditPastoralNotes.ts
// Edit pastoral notes for a given member.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getMember, updateMember } from '../repository'
import { injectMembershipCSS } from '../utils/member-helpers'

const EditPastoralNotes: PageModule = {
  async render(container) {
    renderSkeleton(container, 'form')
    injectMembershipCSS()

    const id = container.dataset['id']
    if (!id) { renderError(container, new Error('No member ID in route')); return }

    let member: Awaited<ReturnType<typeof getMember>>
    try {
      member = await getMember(id)
    } catch (err) {
      renderError(container, err, { retry: () => EditPastoralNotes.render(container) })
      return
    }

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
    <h2 style="margin:0 0 6px;font-size: var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Pastoral Notes</h2>
    <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-bottom:22px;">
      ${formatName(member.first_name, member.last_name, member.title)} — visible to admin and pastor only.
    </div>

    <div class="mm-form-group">
      <label class="mm-form-label">Notes</label>
      <textarea class="mm-form-textarea" id="epn-notes" rows="8"
        placeholder="Internal pastoral notes…">${member.pastoral_notes ?? ''}</textarea>
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button class="mm-btn-primary" id="epn-save" style="flex:1;">Save Notes</button>
      <button class="mm-btn-outline" id="epn-cancel">Cancel</button>
    </div>
  </div>
</div>`

    container.querySelector('#epn-cancel')?.addEventListener('click', () => navigate(`/members/${id}`))
    container.querySelector('#epn-save')?.addEventListener('click', async () => {
      const notes = (container.querySelector<HTMLTextAreaElement>('#epn-notes')?.value ?? '').trim()
      const btn = container.querySelector<HTMLButtonElement>('#epn-save')!
      btn.disabled = true; btn.textContent = 'Saving…'
      try {
        await updateMember(id, { pastoral_notes: notes || null })
        Toast.success('Pastoral notes saved.')
        navigate(`/members/${id}`)
      } catch (err) {
        Toast.fromError(err)
        btn.disabled = false; btn.textContent = 'Save Notes'
      }
    })
  },

  destroy() {},
}

export default EditPastoralNotes
