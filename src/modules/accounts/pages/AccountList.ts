// src/modules/accounts/pages/AccountList.ts
// Lists all provisioned user accounts for the active assembly.

import type { PageModule }             from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast }                       from '@shared/components/Toast'
import { navigate }                    from '@core/router'
import { listAccounts }                from '../repository'
import type { UserProfileSummary }     from '../utils/userProfileCache'
import type { UserRoleEnum }           from '../../../types/database.types'

const ROLE_BADGE: Record<string, { cls: string; label: string }> = {
  admin:           { cls: 'danger',  label: 'Admin' },
  pastor:          { cls: 'purple',  label: 'Pastor' },
  secretary:       { cls: 'info',    label: 'Secretary' },
  volunteer:       { cls: 'warning', label: 'Volunteer' },
  member:          { cls: '',        label: 'Member' },
  finance_officer: { cls: 'info',    label: 'Finance Officer' },
  welfare_officer: { cls: 'info',    label: 'Welfare Officer' },
  cell_leader:     { cls: 'info',    label: 'Cell Leader' },
  elder:           { cls: 'info',    label: 'Elder' },
  children_worker: { cls: 'info',    label: 'Children Worker' },
  media_officer:   { cls: 'info',    label: 'Media Officer' },
  district_overseer: { cls: 'danger', label: 'District Overseer' },
  national_admin:  { cls: 'danger',  label: 'National Admin' },
}

function roleBadge(role: UserRoleEnum) {
  const b = ROLE_BADGE[role] ?? { cls: '', label: role }
  return `<span class="mm-badge ${b.cls}">${b.label}</span>`
}

function statusBadge(isActive: boolean) {
  return isActive
    ? `<span class="mm-badge active">Active</span>`
    : `<span class="mm-badge danger">Suspended</span>`
}

let _accounts: UserProfileSummary[] = []
let _search = ''

const AccountList: PageModule = {
  async render(container) {
    renderSkeleton(container, 'table')

    let accounts: UserProfileSummary[]
    try {
      accounts = await listAccounts()
      _accounts = accounts
    } catch (err) {
      renderError(container, err, { retry: () => AccountList.render(container) })
      return
    }

    renderTable(container, accounts)
  },

  destroy() {
    _accounts = []
    _search = ''
  },
}

function renderTable(container: HTMLElement, accounts: UserProfileSummary[]) {
  container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:960px;margin:0 auto;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
    <div>
      <h1 style="margin:0;font-size:1.375rem;font-weight:700;color:var(--mm-text-primary);">User Accounts</h1>
      <p style="margin:4px 0 0;font-size:13px;color:var(--mm-text-secondary);">
        Provisioned logins for this assembly
      </p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="al-search" type="search" placeholder="Search by name…"
        value="${_search}"
        style="padding:7px 12px;border:1px solid var(--mm-border);border-radius:6px;
          font-size:13px;font-family:inherit;background:var(--mm-bg-card);
          color:var(--mm-text-primary);min-width:200px;" />
      <button id="al-manageRoles" class="mm-btn-outline" style="white-space:nowrap;">
        Manage Roles
      </button>
      <button id="al-provisionBtn" class="mm-btn-primary" style="white-space:nowrap;">
        Provision Login
      </button>
    </div>
  </div>

  <!-- Table -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    ${accounts.length === 0
      ? `<div style="padding:48px;text-align:center;color:var(--mm-text-secondary);font-size:13px;">
           No provisioned accounts yet.
         </div>`
      : `<table class="mm-table" id="al-table">
           <thead>
             <tr>
               <th>Name</th>
               <th>Email</th>
               <th>Role</th>
               <th>Status</th>
               <th></th>
             </tr>
           </thead>
           <tbody>
             ${accounts.map(a => `
               <tr data-id="${a.id}" style="cursor:pointer;">
                 <td style="font-weight:500;">${a.fullName}</td>
                 <td style="font-size:12px;color:var(--mm-text-secondary);">${a.email ?? '—'}</td>
                 <td>${roleBadge(a.role)}</td>
                 <td>${statusBadge(a.isActive)}</td>
                 <td style="text-align:right;">
                   <button class="mm-btn-outline" data-view="${a.id}"
                     style="padding:4px 10px;font-size:12px;">View</button>
                 </td>
               </tr>`).join('')}
           </tbody>
         </table>`
    }
  </div>

</div>
`

  // Search
  const searchInput = container.querySelector<HTMLInputElement>('#al-search')
  searchInput?.addEventListener('input', () => {
    _search = searchInput.value.toLowerCase()
    const rows = container.querySelectorAll<HTMLTableRowElement>('#al-table tbody tr')
    rows.forEach(row => {
      const name = row.querySelector('td')?.textContent?.toLowerCase() ?? ''
      row.style.display = name.includes(_search) ? '' : 'none'
    })
  })

  // Row / view-button clicks
  container.querySelectorAll<HTMLElement>('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigate(`/accounts/${btn.dataset['view']}`)
    })
  })
  container.querySelectorAll<HTMLTableRowElement>('#al-table tbody tr').forEach(row => {
    row.addEventListener('click', () => navigate(`/accounts/${row.dataset['id']}`))
  })

  // Provision
  container.querySelector('#al-provisionBtn')?.addEventListener('click', () => {
    navigate('/accounts/provision/select-member')
  })

  // Manage Roles
  container.querySelector('#al-manageRoles')?.addEventListener('click', () => {
    navigate('/accounts/roles')
  })
}

export default AccountList
