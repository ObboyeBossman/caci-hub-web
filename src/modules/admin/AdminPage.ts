// src/modules/admin/AdminPage.ts
// The single routed PageModule for the Admin module.
// Instantiates the workspace shell with all tabs.
// This is the ONLY file the router ever touches.

import type { PageModule }          from '../../types/module.types'
import { getCurrentUser }            from '@core/auth'
import { can }                       from '@core/authorization/authorization-service'
import { PERMISSIONS }               from '@core/authorization/permissions'
import { renderError }               from '@shared/utils/pageHelpers'
import { AdminWorkspaceShell }       from './workspace/AdminWorkspaceShell'
import { AccountsTab }               from './tabs/AccountsTab'
import { RolesTab }                  from './tabs/RolesTab'
import { PermissionsTab }            from './tabs/PermissionsTab'
import { HouseholdsTab }             from './tabs/HouseholdsTab'
import { AuditLogTab }               from './tabs/AuditLogTab'
import { SettingsTab }               from './tabs/SettingsTab'

let _shell: AdminWorkspaceShell | null = null

const AdminPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    if (!can(user, PERMISSIONS.ADMIN_VIEW)) {
      // permissionGuard handles this, but be defensive
      renderError(container, new Error('Access denied'), {})
      return
    }

    // Instantiate all tabs (permission filtering happens inside the shell)
    _shell = new AdminWorkspaceShell(container, [
      new AccountsTab(),
      new RolesTab(),
      new PermissionsTab(),
      new HouseholdsTab(),
      new AuditLogTab(),
      new SettingsTab(),
    ])
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default AdminPage