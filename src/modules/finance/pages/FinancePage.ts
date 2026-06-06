// src/modules/finance/pages/FinancePage.ts
// The single PageModule for the Finance workspace.
// Owns the tab bar and delegates to four tab instances.
// Mirrors the same single-page workspace pattern used by Membership and Admin.

import type { PageModule } from '../../../types/module.types'
import { getCurrentUser }  from '@core/auth'
import { can }             from '@core/authorization/authorization-service'
import { PERMISSIONS }     from '@core/authorization/permissions'

// Lazy-import tab factories so each tab's code is only executed when first activated
let txTab:  ReturnType<typeof import('../tabs/TransactionsTab')['createTransactionsTab']> | null = null
let plTab:  ReturnType<typeof import('../tabs/PledgesTab')['createPledgesTab']>           | null = null
let bgTab:  ReturnType<typeof import('../tabs/BudgetTab')['createBudgetTab']>             | null = null
let rpTab:  ReturnType<typeof import('../tabs/ReportsTab')['createReportsTab']>           | null = null

type TabId = 'transactions' | 'pledges' | 'budget' | 'reports'

let _activeTab: TabId  = 'transactions'
let _container: HTMLElement | null = null

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'transactions', label: 'Transactions', icon: 'receipt-cutoff' },
  { id: 'pledges',      label: 'Pledges',      icon: 'hand-thumbs-up' },
  { id: 'budget',       label: 'Budget',       icon: 'wallet2' },
  { id: 'reports',      label: 'Reports',      icon: 'bar-chart-line' },
]

const FinancePage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    _container = container

    const user = getCurrentUser()
    if (!user || !can(user, PERMISSIONS.FINANCE_VIEW)) {
      container.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:60vh;gap:12px;font-family:inherit;
      ">
        <span class="bi bi-shield-lock-fill" style="font-size:2.5rem;color:#f43f5e;"></span>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:#e6edf3;">Access Restricted</h2>
        <p style="margin:0;font-size:13px;color:#8b949e;">
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

    container.innerHTML = buildPageShell()
    attachPageListeners()

    // Activate default tab
    await activateTab(_activeTab)
  },

  destroy(): void {
    txTab?.destroy()
    plTab?.destroy()
    bgTab?.destroy()
    rpTab?.destroy()
    txTab = plTab = bgTab = rpTab = null
    _container = null
    _activeTab = 'transactions'
  },
}

// ── Page shell ────────────────────────────────────────────────────────────────

function buildPageShell(): string {
  return `
  <div class="fin-page" role="main" aria-label="Finance workspace">

    <!-- Page header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <h1 style="
          margin:0 0 4px;font-size:1.5rem;font-weight:800;
          color:#e6edf3;letter-spacing:-.025em;
        ">Finance</h1>
        <p style="margin:0;font-size:13px;color:#8b949e;">
          Church stewardship — income, expenses, pledges &amp; budgets
        </p>
      </div>
    </div>

    <!-- Tab bar -->
    <div style="display:flex;justify-content:center;">
      <div class="fin-tab-bar" role="tablist" aria-label="Finance workspace">
        ${TABS.map(t => `
        <button
          class="fin-tab-btn ${t.id === _activeTab ? 'active' : ''}"
          data-fin-tab="${t.id}"
          role="tab"
          aria-selected="${t.id === _activeTab}"
          aria-controls="fin-panel-${t.id}"
          id="fin-tab-${t.id}"
        >
          <span class="bi bi-${t.icon}" style="font-size:16px;"></span>
          ${t.label}
        </button>`).join('')}
      </div>
    </div>

    <!-- Tab panels -->
    ${TABS.map(t => `
    <div
      id="fin-panel-${t.id}"
      class="fin-tab-panel ${t.id === _activeTab ? 'active' : ''}"
      role="tabpanel"
      aria-labelledby="fin-tab-${t.id}"
    ></div>`).join('')}

  </div>`
}

// ── Tab activation ────────────────────────────────────────────────────────────

async function activateTab(tabId: TabId): Promise<void> {
  if (!_container) return

  _activeTab = tabId

  // Update tab button aria + active class
  _container.querySelectorAll<HTMLElement>('[data-fin-tab]').forEach(btn => {
    const isActive = btn.dataset['finTab'] === tabId
    btn.classList.toggle('active', isActive)
    btn.setAttribute('aria-selected', String(isActive))
  })

  // Show/hide panels
  _container.querySelectorAll<HTMLElement>('.fin-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `fin-panel-${tabId}`)
  })

  const panelEl = _container.querySelector<HTMLElement>(`#fin-panel-${tabId}`)
  if (!panelEl) return

  // Only render if panel is empty (first activation)
  if (panelEl.children.length > 0) return

  switch (tabId) {
    case 'transactions': {
      const { createTransactionsTab } = await import('../tabs/TransactionsTab')
      txTab = createTransactionsTab()
      txTab.render(panelEl)
      break
    }
    case 'pledges': {
      const { createPledgesTab } = await import('../tabs/PledgesTab')
      plTab = createPledgesTab()
      plTab.render(panelEl)
      break
    }
    case 'budget': {
      const { createBudgetTab } = await import('../tabs/BudgetTab')
      bgTab = createBudgetTab()
      bgTab.render(panelEl)
      break
    }
    case 'reports': {
      const { createReportsTab } = await import('../tabs/ReportsTab')
      rpTab = createReportsTab()
      rpTab.render(panelEl)
      break
    }
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

function attachPageListeners(): void {
  if (!_container) return

  _container.querySelector('.fin-tab-bar')?.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-fin-tab]')
    if (!btn) return
    const tabId = btn.dataset['finTab'] as TabId
    if (tabId && tabId !== _activeTab) {
      await activateTab(tabId)
    }
  })

  // Keyboard navigation for tab bar (arrow keys)
  _container.querySelector('.fin-tab-bar')?.addEventListener('keydown', async (e) => {
    const ke = e as KeyboardEvent
    const tabIds = TABS.map(t => t.id)
    const currentIdx = tabIds.indexOf(_activeTab)
    let nextIdx = currentIdx

    if (ke.key === 'ArrowRight') nextIdx = (currentIdx + 1) % tabIds.length
    if (ke.key === 'ArrowLeft')  nextIdx = (currentIdx - 1 + tabIds.length) % tabIds.length
    if (ke.key === 'Home')       nextIdx = 0
    if (ke.key === 'End')        nextIdx = tabIds.length - 1

    if (nextIdx !== currentIdx) {
      ke.preventDefault()
      const nextTab = tabIds[nextIdx]
      await activateTab(nextTab)
      _container?.querySelector<HTMLElement>(`[data-fin-tab="${nextTab}"]`)?.focus()
    }
  })
}

export default FinancePage