// src/modules/finance/pages/FinancePage.ts
// The single PageModule for the Finance workspace.
// Owns the tab bar and delegates to four tab instances.
// Updated to use the centralized WorkspaceShell.

import type { PageModule }    from '../../../types/module.types'
import { getCurrentUser }      from '@core/auth'
import { can }                 from '@core/authorization/authorization-service'
import { PERMISSIONS }         from '@core/authorization/permissions'
import { renderError }         from '@shared/utils/pageHelpers'
import { WorkspaceShell }      from '@shell/WorkspaceShell'
import type { ShellConfig }    from '@shell/WorkspaceShell'

// Because we're using WorkspaceShell which wants synchronous instantiation of tabs,
// we will import the factories and instantiate them.
import { createTransactionsTab } from '../tabs/TransactionsTab'
import { createPledgesTab }      from '../tabs/PledgesTab'
import { createBudgetTab }       from '../tabs/BudgetTab'
import { createReportsTab }      from '../tabs/ReportsTab'

const FINANCE_CONFIG: ShellConfig = {
  sessionKey: 'fin_active_tab',
  icon:       'wallet2',
  title:      'Finance',
  subtitle:   'Church stewardship — income, expenses, pledges & budgets',
  badgeLabel: 'Stewardship',
  badgeIcon:  'piggy-bank',
  badgeColor: 'var(--caci-blue-light)',
  buildUrl:   (tabId) => `#/finance?tab=${tabId}`,
}

let _shell: WorkspaceShell | null = null

const FinancePage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    if (!can(user, PERMISSIONS.FINANCE_VIEW)) {
      container.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:60vh;gap:12px;font-family:inherit;
      ">
        <span class="bi bi-shield-lock-fill" style="font-size:2.5rem;color:var(--caci-red);"></span>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:var(--text-primary);">Access Restricted</h2>
        <p style="margin:0;font-size:13px;color:var(--text-secondary);">
          You don't have permission to view the Finance module.
        </p>
      </div>`
      return
    }

    // Inject module CSS if not already present
    if (!document.querySelector('#fin-module-styles')) {
      const style = document.createElement('style')
      style.id    = 'fin-module-styles'
      style.textContent = await import('../styles.css?raw').then(m => m.default).catch(() => '')
      document.head.appendChild(style)
    }

    const hashParts = location.hash.split('?')
    const queryParams = new URLSearchParams(hashParts[1] || '')
    const initialTabId = queryParams.get('tab') || undefined

    _shell = new WorkspaceShell(container, [
      createTransactionsTab(),
      createPledgesTab(),
      createBudgetTab(),
      createReportsTab(),
    ], FINANCE_CONFIG, initialTabId)
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default FinancePage