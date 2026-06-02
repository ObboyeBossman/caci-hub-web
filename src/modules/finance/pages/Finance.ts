// src/modules/finance/pages/Finance.ts
// Finance Dashboard — overview of income, expenses, pledges, and budgets.
import type { PageModule } from '../../../types/module.types'
import { listTransactions } from '../repository'
import { listCategories }   from '../repository'
import { listPledges }      from '../repository'

const Finance: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1100px;margin:0 auto;">
  <h2 style="margin:0 0 4px;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Finance</h2>
  <p style="color:var(--mm-text-secondary);margin:0 0 24px;">Overview of assembly finances</p>

  <div id="fin-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px;">
    <div class="mm-stat-card"><div class="mm-stat-label">Loading…</div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap;">
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Recent Transactions</div>
      <div id="fin-recent-tx" style="color:var(--mm-text-secondary);font-size:var(--text-sm);">Loading…</div>
    </div>
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
      <div style="font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Active Pledges</div>
      <div id="fin-pledges" style="color:var(--mm-text-secondary);font-size:var(--text-sm);">Loading…</div>
    </div>
  </div>

  <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
    <a href="#/finance/transactions" style="text-decoration:none;">
      <button class="mm-btn-primary">View All Transactions</button>
    </a>
    <a href="#/finance/transactions/new" style="text-decoration:none;">
      <button class="mm-btn-outline">+ New Transaction</button>
    </a>
    <a href="#/finance/pledges" style="text-decoration:none;">
      <button class="mm-btn-outline">Pledges</button>
    </a>
    <a href="#/finance/budgets" style="text-decoration:none;">
      <button class="mm-btn-outline">Budgets</button>
    </a>
    <a href="#/finance/categories" style="text-decoration:none;">
      <button class="mm-btn-outline">Categories</button>
    </a>
  </div>
</div>`

    try {
      const [txs, _cats, pledges] = await Promise.all([
        listTransactions(undefined),
        listCategories(),
        listPledges({ status: 'active' }),
      ])

      // Summary cards
      const income  = txs.filter(t => t.category_type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = txs.filter(t => t.category_type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      const fmt = (n: number) => `GHS ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

      container.querySelector('#fin-summary')!.innerHTML = `
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Total Income (all time)</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:#1a7f37;">${fmt(income)}</div>
        </div>
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Total Expenses (all time)</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:#b91c1c;">${fmt(expense)}</div>
        </div>
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Net Balance</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:${income - expense >= 0 ? '#1a7f37' : '#b91c1c'};">${fmt(income - expense)}</div>
        </div>
        <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;">
          <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin-bottom:6px;">Active Pledges</div>
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">${pledges.length}</div>
        </div>`

      // Recent transactions
      const recent = txs.slice(0, 5)
      container.querySelector('#fin-recent-tx')!.innerHTML = recent.length === 0
        ? '<div style="color:var(--mm-text-secondary);">No transactions yet.</div>'
        : recent.map(t => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--mm-border);font-size:var(--text-sm);">
            <div>
              <div style="font-weight:600;">${t.category_name ?? t.transaction_type}</div>
              <div style="color:var(--mm-text-secondary);">${t.transaction_date}</div>
            </div>
            <div style="font-weight:700;color:${t.category_type === 'income' ? '#1a7f37' : '#b91c1c'};">
              ${t.category_type === 'expense' ? '-' : '+'}${fmt(Number(t.amount))}
            </div>
          </div>`).join('')

      // Pledges
      container.querySelector('#fin-pledges')!.innerHTML = pledges.length === 0
        ? '<div style="color:var(--mm-text-secondary);">No active pledges.</div>'
        : pledges.slice(0, 5).map(p => `
          <div style="padding:8px 0;border-bottom:1px solid var(--mm-border);font-size:var(--text-sm);">
            <div style="font-weight:600;">${p.pledge_name}</div>
            <div style="display:flex;justify-content:space-between;color:var(--mm-text-secondary);">
              <span>${fmt(Number(p.amount_paid))} / ${fmt(Number(p.total_amount))}</span>
              <span>${p.fulfilment_pct ?? 0}%</span>
            </div>
          </div>`).join('')
    } catch (err: any) {
      container.querySelector('#fin-summary')!.innerHTML = `<div style="color:#b91c1c;">${err.message}</div>`
    }
  },
  destroy() {},
}

export default Finance
