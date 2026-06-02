// src/modules/finance/pages/Budgets.ts
// Budget planning page — budgeted vs actual per category per period.
import type { PageModule } from '../../../types/module.types'
import type { FinanceBudget, FinanceBudgetPeriod, FinanceCategoryRow } from '../../../types/finance.types'
import { listBudgets, createBudget, softDeleteBudget, listCategories } from '../repository'
import { Toast } from '@shared/components/Toast'

const PERIOD_LABELS: Record<FinanceBudgetPeriod, string> = {
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annual:    'Annual',
}

const fmt = (n: number) => `GHS ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

let _budgets: FinanceBudget[]     = []
let _cats:    FinanceCategoryRow[] = []

const Budgets: PageModule = {
  async render(container) {
    const currentYear = new Date().getFullYear()

    container.innerHTML = `
<div style="padding:24px;max-width:900px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:var(--text-2xl);font-weight:700;">Budgets</h2>
      <p style="color:var(--mm-text-secondary);margin:0;">Planned vs actual per category</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <select class="mm-form-select" id="bg-year" style="width:auto;">
        ${[currentYear, currentYear - 1, currentYear + 1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <button class="mm-btn-outline" onclick="location.hash='#/finance'">← Back</button>
    </div>
  </div>

  <!-- Quick-add form -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="font-weight:600;margin-bottom:12px;">Add Budget Entry</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">
      <div class="mm-form-group" style="margin-bottom:0;">
        <label class="mm-form-label">Category *</label>
        <select class="mm-form-select" id="bg-cat"><option value="">Loading…</option></select>
      </div>
      <div class="mm-form-group" style="margin-bottom:0;">
        <label class="mm-form-label">Period *</label>
        <select class="mm-form-select" id="bg-period">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <div class="mm-form-group" style="margin-bottom:0;">
        <label class="mm-form-label">Budgeted Amount *</label>
        <input class="mm-form-input" id="bg-amount" type="number" min="0" step="0.01" placeholder="0.00">
      </div>
      <button class="mm-btn-primary" id="bg-add">Add</button>
    </div>
  </div>

  <div id="bg-list" style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    <div style="padding:40px;text-align:center;color:var(--mm-text-secondary);">Loading…</div>
  </div>
</div>`

    // Load data
    try {
      [_budgets, _cats] = await Promise.all([listBudgets(currentYear), listCategories()])
      const catSel = container.querySelector<HTMLSelectElement>('#bg-cat')!
      catSel.innerHTML = '<option value="">Select category</option>' +
        _cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
      render()
    } catch (err: any) {
      container.querySelector('#bg-list')!.innerHTML = `<div style="padding:20px;color:#b91c1c;">${err.message}</div>`
    }

    // Year filter
    container.querySelector<HTMLSelectElement>('#bg-year')!.addEventListener('change', async (e) => {
      const year = parseInt((e.target as HTMLSelectElement).value)
      try {
        _budgets = await listBudgets(year)
        render()
      } catch (err: any) { Toast.error(err.message) }
    })

    // Add budget entry
    container.querySelector<HTMLButtonElement>('#bg-add')!.addEventListener('click', async () => {
      const catId  = (container.querySelector<HTMLSelectElement>('#bg-cat')!).value
      const period = (container.querySelector<HTMLSelectElement>('#bg-period')!).value as FinanceBudgetPeriod
      const amount = parseFloat((container.querySelector<HTMLInputElement>('#bg-amount')!).value)
      const year   = parseInt((container.querySelector<HTMLSelectElement>('#bg-year')!).value)
      if (!catId || isNaN(amount) || amount < 0) { Toast.error('Category and amount are required.'); return }
      try {
        const budget = await createBudget({ category_id: catId, period, year, budgeted_amount: amount })
        _budgets.push(budget)
        render()
        Toast.success('Budget entry added.')
        ;(container.querySelector<HTMLInputElement>('#bg-amount')!).value = ''
      } catch (err: any) { Toast.error(err.message ?? 'Failed to add budget.') }
    })

    function render() {
      const list = container.querySelector<HTMLElement>('#bg-list')!
      if (_budgets.length === 0) {
        list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--mm-text-secondary);">No budget entries for this year.</div>`
        return
      }
      list.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead style="background:var(--mm-bg-secondary,rgba(0,0,0,.03));">
          <tr>
            <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Category</th>
            <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Period</th>
            <th style="padding:10px 12px;text-align:right;font-size:var(--text-sm);color:var(--mm-text-secondary);">Budgeted</th>
            <th style="padding:10px 12px;text-align:right;font-size:var(--text-sm);color:var(--mm-text-secondary);">Actual</th>
            <th style="padding:10px 12px;text-align:right;font-size:var(--text-sm);color:var(--mm-text-secondary);">Variance</th>
            <th style="padding:10px 12px;"></th>
          </tr>
        </thead>
        <tbody>
          ${_budgets.map(b => {
            const variance = Number(b.budgeted_amount) - Number(b.actual_amount)
            const varColor = b.category_type === 'income'
              ? (variance > 0 ? '#b91c1c' : '#1a7f37')  // income: under budget is bad
              : (variance > 0 ? '#1a7f37' : '#b91c1c')  // expense: under budget is good
            return `<tr>
              <td style="padding:10px 12px;font-size:var(--text-sm);">${b.category_name ?? '—'}
                <span style="font-size:var(--text-xs);color:var(--mm-text-secondary);margin-left:4px;">${b.category_type ?? ''}</span>
              </td>
              <td style="padding:10px 12px;font-size:var(--text-sm);">${PERIOD_LABELS[b.period]}</td>
              <td style="padding:10px 12px;text-align:right;font-size:var(--text-sm);">${fmt(Number(b.budgeted_amount))}</td>
              <td style="padding:10px 12px;text-align:right;font-size:var(--text-sm);">${fmt(Number(b.actual_amount))}</td>
              <td style="padding:10px 12px;text-align:right;font-size:var(--text-sm);font-weight:600;color:${varColor};">
                ${variance >= 0 ? '+' : ''}${fmt(variance)}
              </td>
              <td style="padding:10px 12px;">
                <button class="mm-btn-icon" data-del-bg="${b.id}" title="Delete" style="color:#b91c1c;border-color:#fecaca;">
                  <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`

      list.querySelectorAll<HTMLElement>('[data-del-bg]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['delBg']!
          if (!confirm('Delete this budget entry?')) return
          try {
            await softDeleteBudget(id)
            _budgets = _budgets.filter(b => b.id !== id)
            render()
            Toast.success('Budget entry deleted.')
          } catch (err: any) { Toast.error(err.message) }
        })
      })
    }
  },
  destroy() { _budgets = []; _cats = [] },
}

export default Budgets
