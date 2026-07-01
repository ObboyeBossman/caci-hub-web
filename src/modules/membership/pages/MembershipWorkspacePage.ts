// src/modules/membership/pages/MembershipWorkspacePage.ts
// The central workspace routing shell for the Membership admin side.
// It uses WorkspaceShell to mount Memebers, Groups, Pastoral, Reports, and Audit Logs tabs.

import type { PageModule }    from '../../../types/module.types'
import { getCurrentUser }      from '@core/auth'
import { can }                 from '@core/authorization/authorization-service'
import { PERMISSIONS }         from '@core/authorization/permissions'
import { renderError }         from '@shared/utils/pageHelpers'
import { WorkspaceShell }      from '@shell/WorkspaceShell'
import type { ShellConfig }    from '@shell/WorkspaceShell'

import { createMembersTab }   from './MemberList'
import { createGroupsTab }    from './Groups'
import { createPastoralTab }  from './PastoralCare'
import { createReportsTab }   from './Reports'
import { createAuditLogsTab } from './AuditLogs'

const MEMBERSHIP_CONFIG: ShellConfig = {
  sessionKey: 'membership_active_tab',
  icon:       'people-fill',
  title:      'Membership',
  subtitle:   'Manage member directory, groups, pastoral care, and statistics',
  badgeLabel: 'Admin',
  badgeIcon:  'shield-lock',
  badgeColor: 'var(--caci-blue-light)',
  buildUrl:   (tabId) => `#/membership?tab=${tabId}`,
}

let _shell: WorkspaceShell | null = null

const MembershipWorkspacePage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    if (!can(user, PERMISSIONS.MEMBERS_VIEW)) {
      container.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:60vh;gap:12px;font-family:inherit;
      ">
        <span class="bi bi-shield-lock-fill" style="font-size:2.5rem;color:var(--caci-red);"></span>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:var(--text-primary);">Access Restricted</h2>
        <p style="margin:0;font-size:13px;color:var(--text-secondary);">
          You don't have permission to view the Membership module.
        </p>
      </div>`
      return
    }

    const hashParts = location.hash.split('?')
    const queryParams = new URLSearchParams(hashParts[1] || '')
    const initialTabId = queryParams.get('tab') || undefined

    // For any module specific CSS, it will be injected by the tabs individually.
    _shell = new WorkspaceShell(container, [
      createMembersTab(),
      createGroupsTab(),
      createPastoralTab(),
      createReportsTab(),
      createAuditLogsTab(),
    ], MEMBERSHIP_CONFIG, initialTabId)
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default MembershipWorkspacePage
