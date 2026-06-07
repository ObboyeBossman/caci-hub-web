// src/modules/membership/pages/GroupCreate.ts
// Create or edit a group — backed by live Supabase queries.
// Type options locked to DB enum values: department | age_group.
// Leader picker: live member search storing leader_id UUID.

import type { PageModule } from '../../../types/module.types'
import type { GroupType } from '../../../types/group.types'
import type { MemberView } from '../../../types/member.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { injectMembershipCSS } from '../utils/member-helpers'
import { getGroup, createGroup, updateGroup } from '../groups.repository'
import { listMembers } from '../repository'

const GroupCreate: PageModule = {
  async render(container) {
    injectMembershipCSS()

    // ── Parse route context ──────────────────────────────────────────────────
    // Supports both /groups/new and /groups/:id/edit
    const hashParts = location.hash.replace('#', '').split('/')
    // e.g. #/groups/abc-123/edit → ['', 'groups', 'abc-123', 'edit']
    let editId: string | null = null
    if (hashParts.length >= 4 && hashParts[3] === 'edit') {
      editId = hashParts[2] ?? null
    }
    // Fallback: legacy ?id= query param
    if (!editId) {
      editId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id')
    }
    const isEdit = !!editId

    // ── Render form shell (always synchronous) ───────────────────────────────
    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:640px;margin:0 auto;">
  <button style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;"
    id="gc-back">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Groups
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 22px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">
      ${isEdit ? 'Edit Group' : 'New Group'}
    </h2>

    <div id="gc-load-error" style="display:none;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;margin-bottom:16px;"></div>

    <!-- Name -->
    <div class="mm-form-group">
      <label class="mm-form-label">Group Name *</label>
      <input class="mm-form-input" id="gc-name" placeholder="e.g. Youth Ministry">
      <div class="mm-form-error" id="gc-err-name">Group name is required.</div>
    </div>

    <!-- Type -->
    <div class="mm-form-group">
      <label class="mm-form-label">Type *</label>
      <select class="mm-form-select" id="gc-type">
        <option value="department">Department</option>
        <option value="age_group">Age Group</option>
      </select>
    </div>

    <!-- Leader picker -->
    <div class="mm-form-group">
      <label class="mm-form-label">Leader</label>
      <input class="mm-form-input" id="gc-leader-search" placeholder="Search for a member…" autocomplete="off">
      <div id="gc-leader-results" style="display:none;background:var(--mm-bg-card);border:1px solid var(--mm-border);
        border-radius:8px;max-height:160px;overflow-y:auto;margin-top:4px;"></div>
      <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);margin-top:4px;" id="gc-leader-label"></div>
      <input type="hidden" id="gc-leader-id">
    </div>

    <!-- Description -->
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

    // ── Navigation ───────────────────────────────────────────────────────────
    container.querySelector('#gc-back')?.addEventListener('click', () => navigate('/groups'))
    container.querySelector('#gc-cancel')?.addEventListener('click', () => navigate('/groups'))

    // ── Pre-fill in edit mode ────────────────────────────────────────────────
    if (isEdit && editId) {
      try {
        const group = await getGroup(editId)
        ;(container.querySelector<HTMLInputElement>('#gc-name'))!.value   = group.name
        ;(container.querySelector<HTMLSelectElement>('#gc-type'))!.value  = group.group_type
        ;(container.querySelector<HTMLTextAreaElement>('#gc-desc'))!.value = group.description ?? ''
        if (group.leader_id) {
          ;(container.querySelector<HTMLInputElement>('#gc-leader-id'))!.value    = group.leader_id
          ;(container.querySelector<HTMLInputElement>('#gc-leader-search'))!.value = group.leader_name ?? ''
          const lbl = container.querySelector<HTMLElement>('#gc-leader-label')
          if (lbl && group.leader_name) lbl.textContent = `Selected: ${group.leader_name}`
        }
      } catch (err: any) {
        const errEl = container.querySelector<HTMLElement>('#gc-load-error')
        if (errEl) { errEl.textContent = err.message ?? 'Failed to load group.'; errEl.style.display = 'block' }
        ;(container.querySelector<HTMLButtonElement>('#gc-save'))!.disabled = true
      }
    }

    // ── Leader search ────────────────────────────────────────────────────────
    let _searchDebounce: ReturnType<typeof setTimeout> | null = null
    const leaderSearch  = container.querySelector<HTMLInputElement>('#gc-leader-search')!
    const leaderResults = container.querySelector<HTMLElement>('#gc-leader-results')!
    const leaderIdInput = container.querySelector<HTMLInputElement>('#gc-leader-id')!
    const leaderLabel   = container.querySelector<HTMLElement>('#gc-leader-label')!

    leaderSearch.addEventListener('input', () => {
      const q = leaderSearch.value.trim()
      leaderIdInput.value = ''
      leaderLabel.textContent = ''

      if (_searchDebounce) clearTimeout(_searchDebounce)
      if (!q) { leaderResults.style.display = 'none'; return }

      _searchDebounce = setTimeout(async () => {
        try {
          const results = await listMembers({ searchQuery: q }, { limit: 8 })
          if (results.length === 0) {
            leaderResults.innerHTML = `<div style="padding:10px 12px;color:var(--mm-text-secondary);font-size:var(--text-sm);">No members found.</div>`
          } else {
            leaderResults.innerHTML = results.map((m: MemberView) => `
              <div class="gc-leader-item" data-mid="${m.id}" data-name="${m.first_name} ${m.last_name}" style="
                padding:9px 12px;cursor:pointer;font-size:var(--text-sm);
                border-bottom:1px solid var(--mm-border);transition:background .1s;">
                <span style="font-weight:600;">${m.first_name} ${m.last_name}</span>
                <span style="color:var(--mm-text-secondary);margin-left:6px;">${m.membership_status}</span>
              </div>`).join('')
            leaderResults.querySelectorAll<HTMLElement>('.gc-leader-item').forEach(item => {
              item.addEventListener('mouseenter', () => item.style.background = 'var(--mm-bg-hover,rgba(0,0,0,.05))')
              item.addEventListener('mouseleave', () => item.style.background = '')
              item.addEventListener('click', () => {
                const name = item.dataset['name']!
                leaderIdInput.value   = item.dataset['mid']!
                leaderSearch.value    = name
                leaderLabel.textContent = `Selected: ${name}`
                leaderResults.style.display = 'none'
              })
            })
          }
          leaderResults.style.display = 'block'
        } catch {
          // silent — leader is optional
        }
      }, 300)
    })

    // Hide results on blur (small delay to allow click)
    leaderSearch.addEventListener('blur', () => {
      setTimeout(() => { leaderResults.style.display = 'none' }, 150)
    })

    // ── Save ─────────────────────────────────────────────────────────────────
    const saveBtn = container.querySelector<HTMLButtonElement>('#gc-save')!
    saveBtn.addEventListener('click', async () => {
      const name = container.querySelector<HTMLInputElement>('#gc-name')!.value.trim()
      if (!name) {
        container.querySelector('#gc-err-name')?.classList.add('show')
        return
      }
      container.querySelector('#gc-err-name')?.classList.remove('show')

      const type        = container.querySelector<HTMLSelectElement>('#gc-type')!.value as GroupType
      const description = container.querySelector<HTMLTextAreaElement>('#gc-desc')!.value.trim() || null
      const leaderId    = leaderIdInput.value.trim() || null

      saveBtn.disabled   = true
      saveBtn.textContent = isEdit ? 'Saving…' : 'Creating…'

      try {
        if (isEdit && editId) {
          await updateGroup(editId, { name, group_type: type, description, leader_id: leaderId })
          Toast.success('Group updated.')
        } else {
          await createGroup({ name, group_type: type, description, leader_id: leaderId })
          Toast.success('Group created.')
        }
        navigate('/groups')
      } catch (err: any) {
        Toast.error(err.message ?? 'Failed to save group.')
        saveBtn.disabled   = false
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Group'
      }
    })
  },

  destroy() {},
}

export default GroupCreate
