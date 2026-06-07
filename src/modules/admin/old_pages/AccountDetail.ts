// src/modules/accounts/pages/AccountDetail.ts
// Single user account — role management, suspend/reactivate, link back to member profile.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { navigate } from '@core/router'
import { getAccountById, updateUserRole, setUserActive, listAssemblyRoles, assignRoleToUser } from '../repository'
import type { AssemblyRole } from '../repository'
import type { UserProfileSummary } from '../utils/userProfileCache'
import type { SystemRole } from '../../../types/auth.types'

// Extended type for this page to include role_id
interface AccountDetailSummary extends UserProfileSummary {
  roleId: string | null
}

const ASSIGNABLE_ROLES: { value: SystemRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
]

let _container: HTMLElement | null = null

const AccountDetail: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'profile')

    const userId = container.dataset['id']
    if (!userId) { renderError(container, new Error('No account ID in route')); return }

    let account: AccountDetailSummary
    let customRoles: AssemblyRole[] = []
    try {
      account = await getAccountByIdWithRoleId(userId)
      customRoles = await listAssemblyRoles()
    } catch (err) {
      renderError(container, err, { retry: () => AccountDetail.render(container) })
      return
    }

    renderDetail(container, account, customRoles)
  },

  destroy() { _container = null },
}

// Inline fetcher because repository.ts's getAccountById doesn't return roleId
// to avoid breaking the userProfileCache shape used everywhere else.
async function getAccountByIdWithRoleId(userId: string): Promise<AccountDetailSummary> {
  const { supabase } = await import('@core/supabase')
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, assembly_id, role, assembly_role_id, full_name, is_active')
    .eq('id', userId)
    .single()

  if (error) throw error
  const p = profile as any

  const { data: member } = await supabase
    .from('members')
    .select('id, email')
    .eq('auth_user_id', userId)
    .maybeSingle()
  const m = member as any | null

  return {
    id: p.id,
    memberId: m?.id ?? null,
    fullName: p.full_name,
    email: m?.email ?? null,
    role: p.role as SystemRole,
    roleId: p.assembly_role_id,
    isActive: p.is_active,
    assemblyId: p.assembly_id,
  }
}

function renderDetail(container: HTMLElement, account: AccountDetailSummary, roles: AssemblyRole[]) {
  container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:720px;margin:0 auto;">

  <!-- Back -->
  <button id="ad-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size: var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    All Accounts
  </button>

  <!-- Header card -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;margin-bottom:20px;">

    <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;">
      <!-- Avatar -->
      <div style="width:56px;height:56px;border-radius:50%;
        background:var(--caci-accent);display:flex;align-items:center;
        justify-content:center;color:#fff;font-size: var(--text-2xl);font-weight:700;flex-shrink:0;">
        ${account.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
      </div>

      <div style="flex:1;">
        <div style="font-size:1.125rem;font-weight:700;color:var(--mm-text-primary);margin-bottom:4px;">
          ${account.fullName}
        </div>
        <div style="font-size: var(--text-sm);color:var(--mm-text-secondary);margin-bottom:10px;">
          ${account.email ?? 'No email on record'}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span class="mm-badge ${account.isActive ? 'active' : 'danger'}">
            ${account.isActive ? 'Active' : 'Suspended'}
          </span>
          <span class="mm-badge">${account.role}</span>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${account.memberId
      ? `<button class="mm-btn-outline" id="ad-viewMember"
               style="font-size: var(--text-sm);">View Member Profile</button>`
      : ''}
        ${account.isActive
      ? `<button class="mm-btn-danger" id="ad-suspend">Suspend</button>`
      : `<button class="mm-btn-primary" id="ad-reactivate">Reactivate</button>`}
      </div>
    </div>
  </div>

  <!-- Role management -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;">
    <div class="mm-detail-section-title" style="margin-bottom:16px;">Role Management</div>

    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <label style="display:block;margin-bottom:6px;font-size: var(--text-base);font-weight:500;
          color:var(--mm-text-secondary);">Assigned Role</label>
        <select id="ad-roleSelect" style="width:100%;padding:9px 12px;
          border:1px solid var(--mm-border);border-radius:6px;font-size: var(--text-base);
          font-family:inherit;background:var(--mm-bg-card);color:var(--mm-text-primary);">
          ${ASSIGNABLE_ROLES.map(r => `
            <option value="${r.value}" ${r.value === account.role ? 'selected' : ''}>
              ${r.label}
            </option>`).join('')}
        </select>
      </div>
      <button id="ad-saveRole" class="mm-btn-primary" style="white-space:nowrap;">
        Save Role
      </button>
    </div>

    <p style="margin:12px 0 0;font-size: var(--text-sm);color:var(--mm-text-muted);">
      System role changes take effect on the user's next login.
    </p>
  </div>

  <!-- Assembly Custom Role management -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div class="mm-detail-section-title" style="margin:0;">Assembly Custom Role</div>
      <button id="ad-manageRolesLink" class="mm-btn-outline" style="font-size: var(--text-sm);padding:4px 8px;">
        Manage Roles
      </button>
    </div>
    
    <p style="font-size: var(--text-base);color:var(--mm-text-secondary);margin:0 0 16px;max-width:500px;">
      Assign an assembly-specific role to grant additional permissions. 
      This works in combination with their base system role.
    </p>

    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <select id="ad-customRoleSelect" style="width:100%;padding:9px 12px;
          border:1px solid var(--mm-border);border-radius:6px;font-size: var(--text-base);
          font-family:inherit;background:var(--mm-bg-card);color:var(--mm-text-primary);">
          <option value="">-- No Custom Role --</option>
          ${roles.map(r => `
            <option value="${r.id}" ${r.id === account.roleId ? 'selected' : ''}>
              ${r.name}
            </option>`).join('')}
        </select>
      </div>
      <button id="ad-saveCustomRole" class="mm-btn-primary" style="white-space:nowrap;">
        Assign
      </button>
    </div>

    <p style="margin:12px 0 0;font-size: var(--text-sm);color:var(--mm-text-muted);">
      Role assignments take effect on the user's next login.
    </p>
  </div>

</div>
`

  // Back
  container.querySelector('#ad-back')?.addEventListener('click', () => navigate('/admin/users'))

  // View member profile
  if (account.memberId) {
    container.querySelector('#ad-viewMember')?.addEventListener('click', () =>
      navigate(`/members/${account.memberId}`)
    )
  }

  // Suspend / reactivate
  container.querySelector('#ad-suspend')?.addEventListener('click', async () => {
    const confirmed = await ConfirmDialog.show({
      title: 'Suspend Account',
      message: `Suspend ${account.fullName}? They will lose access immediately.`,
      danger: true,
      confirmText: 'Suspend'
    })
    if (!confirmed) return
    try {
      await setUserActive(account.id, false)
      Toast.success(`${account.fullName} suspended.`)
      AccountDetail.render(container)
    } catch (err) { Toast.fromError(err) }
  })
  container.querySelector('#ad-reactivate')?.addEventListener('click', async () => {
    const confirmed = await ConfirmDialog.show({
      title: 'Reactivate Account',
      message: `Reactivate ${account.fullName}?`,
      confirmText: 'Reactivate'
    })
    if (!confirmed) return
    try {
      await setUserActive(account.id, true)
      Toast.success(`${account.fullName} reactivated.`)
      AccountDetail.render(container)
    } catch (err) { Toast.fromError(err) }
  })

  // Save system role
  container.querySelector('#ad-saveRole')?.addEventListener('click', async () => {
    const select = container.querySelector<HTMLSelectElement>('#ad-roleSelect')!
    const newRole = select.value as SystemRole
    if (newRole === account.role) { Toast.info('No change — role is already set.'); return }
    const confirmed = await ConfirmDialog.show({
      title: 'Change System Role',
      message: `Change ${account.fullName}'s base role to "${newRole}"?`,
      danger: true,
      confirmText: 'Change Role'
    })
    if (!confirmed) return
    try {
      await updateUserRole(account.id, newRole)
      Toast.success('System role updated. Takes effect on next login.')
      AccountDetail.render(container)
    } catch (err) { Toast.fromError(err) }
  })

  // Save assembly custom role
  container.querySelector('#ad-saveCustomRole')?.addEventListener('click', async () => {
    const btn = container.querySelector<HTMLButtonElement>('#ad-saveCustomRole')!
    const select = container.querySelector<HTMLSelectElement>('#ad-customRoleSelect')!
    const newRoleId = select.value || null
    if (newRoleId === account.roleId) { Toast.info('No change — role is already set.'); return }
    const roleName = newRoleId ? roles.find(r => r.id === newRoleId)?.name : 'None'
    const confirmed = await ConfirmDialog.show({
      title: 'Assign Role',
      message: `Assign custom role "${roleName}" to ${account.fullName}?`
    })
    if (!confirmed) return

    try {
      btn.disabled = true; btn.textContent = 'Saving…'
      await assignRoleToUser(account.id, newRoleId)
      Toast.success('Custom role assigned. Takes effect on next login.')
      AccountDetail.render(container)
    } catch (err) { Toast.fromError(err) }
  })

  // Manage Roles shortcut
  container.querySelector('#ad-manageRolesLink')?.addEventListener('click', () => {
    navigate('/admin/roles')
  })
}

export default AccountDetail
