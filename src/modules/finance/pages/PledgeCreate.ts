// src/modules/finance/pages/PledgeCreate.ts
// Create a new pledge.
import type { PageModule } from '../../../types/module.types'
import type { MemberView } from '../../../types/member.types'
import { createPledge } from '../repository'
import { listMembers }  from '../../membership/repository'
import { Toast }        from '@shared/components/Toast'

const PledgeCreate: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:640px;margin:0 auto;">
  <button style="display:inline-flex;align-items:center;gap:6px;color:var(--mm-text-secondary);font-size:var(--text-base);border:none;background:none;cursor:pointer;margin-bottom:20px;font-family:inherit;"
    onclick="location.hash='#/finance/pledges'">← Back to Pledges</button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 22px;font-size:var(--text-2xl);font-weight:700;">New Pledge</h2>

    <div class="mm-form-group">
      <label class="mm-form-label">Member *</label>
      <input class="mm-form-input" id="pc-member-search" placeholder="Search for a member…" autocomplete="off">
      <div id="pc-member-results" style="display:none;background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:8px;max-height:160px;overflow-y:auto;margin-top:4px;"></div>
      <input type="hidden" id="pc-member-id">
      <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);margin-top:4px;" id="pc-member-label"></div>
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Pledge Name *</label>
      <input class="mm-form-input" id="pc-name" placeholder="e.g. Building Fund 2026">
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Total Amount (GHS) *</label>
      <input class="mm-form-input" id="pc-amount" type="number" min="0.01" step="0.01" placeholder="0.00">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="mm-form-group">
        <label class="mm-form-label">Start Date</label>
        <input class="mm-form-input" id="pc-start" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">End Date</label>
        <input class="mm-form-input" id="pc-end" type="date">
      </div>
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Notes</label>
      <textarea class="mm-form-textarea" id="pc-notes" rows="2" placeholder="Optional notes"></textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="pc-save" style="flex:1;">Create Pledge</button>
      <button class="mm-btn-outline" onclick="location.hash='#/finance/pledges'">Cancel</button>
    </div>
  </div>
</div>`

    // Member search
    let _selectedMemberId: string | null = null
    let _debounce: ReturnType<typeof setTimeout> | null = null
    const searchEl  = container.querySelector<HTMLInputElement>('#pc-member-search')!
    const resultsEl = container.querySelector<HTMLElement>('#pc-member-results')!
    const memberIdEl = container.querySelector<HTMLInputElement>('#pc-member-id')!
    const labelEl   = container.querySelector<HTMLElement>('#pc-member-label')!

    searchEl.addEventListener('input', () => {
      const q = searchEl.value.trim()
      _selectedMemberId = null
      if (_debounce) clearTimeout(_debounce)
      if (!q) { resultsEl.style.display = 'none'; return }
      _debounce = setTimeout(async () => {
        const members: MemberView[] = await listMembers({ searchQuery: q }, { limit: 8 })
        resultsEl.innerHTML = members.map(m => `
          <div class="pc-mb-item" data-mid="${m.id}" data-name="${m.first_name} ${m.last_name}"
            style="padding:9px 12px;cursor:pointer;font-size:var(--text-sm);border-bottom:1px solid var(--mm-border);">
            <strong>${m.first_name} ${m.last_name}</strong>
            <span style="color:var(--mm-text-secondary);margin-left:6px;">${m.membership_status}</span>
          </div>`).join('')
        resultsEl.querySelectorAll<HTMLElement>('.pc-mb-item').forEach(item => {
          item.addEventListener('click', () => {
            _selectedMemberId = item.dataset['mid']!
            memberIdEl.value = _selectedMemberId
            searchEl.value   = item.dataset['name']!
            labelEl.textContent = `Selected: ${item.dataset['name']}`
            resultsEl.style.display = 'none'
          })
        })
        resultsEl.style.display = 'block'
      }, 300)
    })
    searchEl.addEventListener('blur', () => setTimeout(() => { resultsEl.style.display = 'none' }, 150))

    const saveBtn = container.querySelector<HTMLButtonElement>('#pc-save')!
    saveBtn.addEventListener('click', async () => {
      const memberId   = memberIdEl.value.trim()
      const pledgeName = (container.querySelector<HTMLInputElement>('#pc-name')!).value.trim()
      const totalAmt   = parseFloat((container.querySelector<HTMLInputElement>('#pc-amount')!).value)
      const startDate  = (container.querySelector<HTMLInputElement>('#pc-start')!).value || undefined
      const endDate    = (container.querySelector<HTMLInputElement>('#pc-end')!).value || null
      const notes      = (container.querySelector<HTMLTextAreaElement>('#pc-notes')!).value.trim() || null

      if (!memberId || !pledgeName || isNaN(totalAmt) || totalAmt <= 0) {
        Toast.error('Member, pledge name, and amount are required.')
        return
      }
      saveBtn.disabled = true; saveBtn.textContent = 'Creating…'
      try {
        await createPledge({ member_id: memberId, pledge_name: pledgeName, total_amount: totalAmt, start_date: startDate, end_date: endDate, notes })
        Toast.success('Pledge created.')
        location.hash = '#/finance/pledges'
      } catch (err: any) {
        Toast.error(err.message ?? 'Failed to create pledge.')
        saveBtn.disabled = false; saveBtn.textContent = 'Create Pledge'
      }
    })
  },
  destroy() {},
}

export default PledgeCreate
