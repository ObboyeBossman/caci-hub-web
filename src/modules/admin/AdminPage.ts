// src/modules/admin/AdminPage.ts
// The single routed PageModule for the Admin module.
// Instantiates the shared WorkspaceShell with Admin-specific config and all tabs.
// This is the ONLY file the router ever touches.

import type { PageModule }          from '../../types/module.types'
import { getCurrentUser }            from '@core/auth'
import { can }                       from '@core/authorization/authorization-service'
import { PERMISSIONS }               from '@core/authorization/permissions'
import { renderError }               from '@shared/utils/pageHelpers'
import { WorkspaceShell }            from '@shell/WorkspaceShell'
import type { ShellConfig }          from '@shell/WorkspaceShell'
import { injectWidgetCSS }           from './widgets/adminWidgets'
import { AccountsTab }               from './tabs/AccountsTab'
import { RolesTab }                  from './tabs/RolesTab'
import { PermissionsTab }            from './tabs/PermissionsTab'
import { HouseholdsTab }             from './tabs/HouseholdsTab'
import { AuditLogTab }               from './tabs/AuditLogTab'
import { SettingsTab }               from './tabs/SettingsTab'

const ADMIN_CONFIG: ShellConfig = {
  sessionKey:  'admin_active_tab',
  icon:        'shield-lock-fill',
  title:       'Administration',
  subtitle:    'Manage accounts, roles, permissions, and system settings',
  badgeLabel:  'Admin Panel',
  badgeIcon:   'shield-fill-check',
  badgeColor:  'var(--caci-red)',
  buildUrl:    (tabId) => `#/admin?tab=${tabId}`,
}

let _shell: WorkspaceShell | null = null

const AdminPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    if (!can(user, PERMISSIONS.ADMIN_VIEW)) {
      // permissionGuard handles this, but be defensive
      renderError(container, new Error('Access denied'), {})
      return
    }

    injectWidgetCSS()

    const hashParts = location.hash.split('?')
    const queryParams = new URLSearchParams(hashParts[1] || '')
    const initialTabId = queryParams.get('tab') || undefined

    // Instantiate all tabs (permission filtering happens inside the shell)
    _shell = new WorkspaceShell(container, [
      new AccountsTab(),
      new RolesTab(),
      new PermissionsTab(),
      new HouseholdsTab(),
      new AuditLogTab(),
      new SettingsTab(),
    ], ADMIN_CONFIG, initialTabId)
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default AdminPage