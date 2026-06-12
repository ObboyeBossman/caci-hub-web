import { emit } from '@core/events'
import { CommunicationService } from '../services/communication.service'
import type { Announcement } from '../schemas/communication'

// Assuming showToast exists or we just use global Toast
import { Toast } from '@shared/components/Toast'

/**
 * Common modal renderer and manager.
 */
function _showModal(
  title: string,
  contentHtml: string,
  onMount: (modal: HTMLElement, close: () => void) => void
): void {
  const overlay = document.createElement('div')
  overlay.className = 'cw-modal-overlay open'
  
  overlay.innerHTML = `
    <div class="cw-modal">
      <div class="cw-modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="cw-modal-header-icon" style="background:rgba(0,75,160,0.1);"><i class="bi bi-window-stack" style="color:var(--caci-blue-light);"></i></div>
          <h2 class="cw-modal-title">${title}</h2>
        </div>
        <button class="cw-modal-close-btn"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="cw-modal-body">
        ${contentHtml}
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const _close = () => {
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 300)
  }

  overlay.querySelector('.cw-modal-close-btn')!.addEventListener('click', _close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _close()
  })

  onMount(overlay.querySelector('.cw-modal')!, _close)
}

/**
 * Create Announcement Modal
 */
export function openCreateAnnouncementModal(assemblyId: string): void {
  const formHtml = `
    <div class="cw-form-group">
      <label class="cw-form-label">Announcement Title</label>
      <input type="text" class="cw-form-inp" id="anc-title" placeholder="e.g. Mid-Week Service Updates" />
    </div>
    <div class="cw-form-group">
      <label class="cw-form-label">Message Body</label>
      <textarea class="cw-form-textarea" id="anc-body" rows="4" placeholder="Enter the announcement details here..."></textarea>
    </div>
    <div class="cw-form-group" style="flex-direction:row;align-items:center;margin-top:8px;">
      <input type="checkbox" id="anc-pinned" class="cw-chk" />
      <label for="anc-pinned" style="font-size:13px;color:var(--text-primary);cursor:pointer;margin:0;">Pin this announcement to the top</label>
    </div>
    <div class="cw-modal-footer" style="margin: 20px -22px -20px;">
      <button class="cw-tbtn" id="anc-cancel">Cancel</button>
      <button class="cw-tbtn cw-tbtn-primary" id="anc-submit">Create Announcement</button>
    </div>
  `

  _showModal('New Announcement', formHtml, (modal, close) => {
    const btnSubmit = modal.querySelector<HTMLButtonElement>('#anc-submit')!
    const btnCancel = modal.querySelector<HTMLButtonElement>('#anc-cancel')!
    const inpTitle  = modal.querySelector<HTMLInputElement>('#anc-title')!
    const inpBody   = modal.querySelector<HTMLTextAreaElement>('#anc-body')!
    const chkPinned = modal.querySelector<HTMLInputElement>('#anc-pinned')!

    btnCancel.addEventListener('click', close)

    btnSubmit.addEventListener('click', async () => {
      const title = inpTitle.value.trim()
      const body = inpBody.value.trim()

      if (!title || !body) {
        Toast.error('Please fill in all fields')
        return
      }

      btnSubmit.disabled = true
      btnSubmit.innerHTML = '<div class="cw-spinner"></div>'

      try {
        await CommunicationService.createAnnouncement({
          assembly_id: assemblyId,
          title,
          body,
          is_pinned: chkPinned.checked,
          // Defaults: viewable indefinitely (or 1 week typically, using indefinite here for ease)
          visible_from: new Date().toISOString(),
          visible_until: undefined
        })
        Toast.success('Announcement created successfully')
        emit('communication:announcement_mutated')
        close()
      } catch (err) {
        Toast.fromError(err)
        btnSubmit.disabled = false
        btnSubmit.innerHTML = 'Create Announcement'
      }
    })
  })
}

/**
 * Edit Announcement Modal
 */
export function openEditAnnouncementModal(assemblyId: string, ann: Announcement): void {
  const formHtml = `
    <div class="cw-form-group">
      <label class="cw-form-label">Announcement Title</label>
      <input type="text" class="cw-form-inp" id="anc-title" value="${ann.title.replace(/"/g, '&quot;')}" />
    </div>
    <div class="cw-form-group">
      <label class="cw-form-label">Message Body</label>
      <textarea class="cw-form-textarea" id="anc-body" rows="4">${ann.body}</textarea>
    </div>
    <div class="cw-form-group" style="flex-direction:row;align-items:center;margin-top:8px;">
      <input type="checkbox" id="anc-pinned" class="cw-chk" ${ann.is_pinned ? 'checked' : ''} />
      <label for="anc-pinned" style="font-size:13px;color:var(--text-primary);cursor:pointer;margin:0;">Pin this announcement to the top</label>
    </div>
    <div class="cw-modal-footer" style="margin: 20px -22px -20px;">
      <button class="cw-tbtn" id="anc-cancel">Cancel</button>
      <button class="cw-tbtn cw-tbtn-primary" id="anc-submit">Save Changes</button>
    </div>
  `

  _showModal('Edit Announcement', formHtml, (modal, close) => {
    const btnSubmit = modal.querySelector<HTMLButtonElement>('#anc-submit')!
    const btnCancel = modal.querySelector<HTMLButtonElement>('#anc-cancel')!
    const inpTitle  = modal.querySelector<HTMLInputElement>('#anc-title')!
    const inpBody   = modal.querySelector<HTMLTextAreaElement>('#anc-body')!
    const chkPinned = modal.querySelector<HTMLInputElement>('#anc-pinned')!

    btnCancel.addEventListener('click', close)

    btnSubmit.addEventListener('click', async () => {
      const title = inpTitle.value.trim()
      const body = inpBody.value.trim()

      if (!title || !body) {
        Toast.error('Please fill in all fields')
        return
      }

      btnSubmit.disabled = true
      btnSubmit.innerHTML = '<div class="cw-spinner"></div>'

      try {
        await CommunicationService.updateAnnouncement(ann.id, {
          title,
          body,
          is_pinned: chkPinned.checked
        })
        Toast.success('Announcement updated successfully')
        emit('communication:announcement_mutated')
        close()
      } catch (err) {
        Toast.fromError(err)
        btnSubmit.disabled = false
        btnSubmit.innerHTML = 'Save Changes'
      }
    })
  })
}

export function openCreateCampaignModal(): void {
  // To be implemented when refactoring CampaignsTab
}

export function openTemplateEditorModal(): void {
  // To be implemented when refactoring TemplatesTab
}
