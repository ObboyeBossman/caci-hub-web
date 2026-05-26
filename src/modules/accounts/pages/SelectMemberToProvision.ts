// src/modules/accounts/pages/SelectMemberToProvision.ts
// Lists all members without an account so the user can select one to provision.

import type { PageModule }             from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { navigate }                    from '@core/router'
import { listUnprovisionedMembers }    from '../repository'

let _members: Array<{ id: string; fullName: string; email: string | null }> = []
let _search = ''

const SelectMemberToProvision: PageModule = {
  async render(container) {
    renderSkeleton(container, 'table')

    try {
      _members = await listUnprovisionedMembers()
    } catch (err) {
      renderError(container, err, { retry: () => SelectMemberToProvision.render(container) })
      return
    }

    renderTable(container)
  },

  destroy() {
    _members = []
    _search = ''
  },
}

function renderTable(container: HTMLElement) {
  container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:960px;margin:0 auto;">

  <!-- Back button & Header -->
  <button id="sm-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back
  </button>

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
    <div>
      <h1 style="margin:0;font-size:1.375rem;font-weight:700;color:var(--mm-text-primary);">Select Member</h1>
      <p style="margin:4px 0 0;font-size:13px;color:var(--mm-text-secondary);">
        Choose a member to provision a new login account.
      </p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="sm-search" type="search" placeholder="Search by name…"
        value="${_search}"
        style="padding:7px 12px;border:1px solid var(--mm-border);border-radius:6px;
          font-size:13px;font-family:inherit;background:var(--mm-bg-card);
          color:var(--mm-text-primary);min-width:200px;" />
    </div>
  </div>

  <!-- Table -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    ${_members.length === 0
      ? `<div style="padding:48px;text-align:center;color:var(--mm-text-secondary);font-size:13px;">
           All members currently have active accounts (or there are no members).
         </div>`
      : `<table class="mm-table" id="sm-table">
           <thead>
             <tr>
               <th>Name</th>
               <th>Email</th>
               <th style="width:100px;"></th>
             </tr>
           </thead>
           <tbody>
             ${_members.map(m => `
               <tr data-id="${m.id}">
                 <td style="font-weight:500;">${m.fullName}</td>
                 <td style="font-size:12px;color:var(--mm-text-secondary);">${m.email ?? '—'}</td>
                 <td style="text-align:right;">
                   <button class="mm-btn-outline" data-select="${m.id}"
                     style="padding:4px 12px;font-size:12px;">Select</button>
                 </td>
               </tr>`).join('')}
           </tbody>
         </table>`
    }
  </div>
</div>
`

  // Back button
  container.querySelector('#sm-back')?.addEventListener('click', () => {
    history.length > 1 ? history.back() : navigate('/accounts')
  })

  // Search
  const searchInput = container.querySelector<HTMLInputElement>('#sm-search')
  searchInput?.addEventListener('input', () => {
    _search = searchInput.value.toLowerCase()
    const rows = container.querySelectorAll<HTMLTableRowElement>('#sm-table tbody tr')
    rows.forEach(row => {
      const name = row.querySelector('td')?.textContent?.toLowerCase() ?? ''
      row.style.display = name.includes(_search) ? '' : 'none'
    })
  })

  // Select buttons
  container.querySelectorAll<HTMLElement>('[data-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`/accounts/provision/${btn.dataset['select']}`)
    })
  })
}

export default SelectMemberToProvision
