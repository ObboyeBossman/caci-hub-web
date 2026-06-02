// src/modules/finance/pages/Categories.ts
// Finance categories management (chart of accounts).
import type { PageModule } from '../../../types/module.types'
import type { FinanceCategoryRow, FinanceCategoryType } from '../../../types/finance.types'
import { listCategories, createCategory, softDeleteCategory } from '../repository'
import { Toast } from '@shared/components/Toast'

let _cats: FinanceCategoryRow[] = []

const Categories: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:800px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:var(--text-2xl);font-weight:700;">Finance Categories</h2>
      <p style="color:var(--mm-text-secondary);margin:0;">Chart of accounts for income and expenses</p>
    </div>
    <button class="mm-btn-outline" onclick="location.hash='#/finance'">← Back</button>
  </div>

  <!-- New category form -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="font-weight:600;margin-bottom:12px;">Add Category</div>
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;">
      <div class="mm-form-group" style="margin-bottom:0;">
        <label class="mm-form-label">Name *</label>
        <input class="mm-form-input" id="cat-name" placeholder="e.g. Tithe Income">
      </div>
      <div class="mm-form-group" style="margin-bottom:0;">
        <label class="mm-form-label">Type *</label>
        <select class="mm-form-select" id="cat-type">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      <button class="mm-btn-primary" id="cat-add">Add</button>
    </div>
  </div>

  <div id="cat-list" style="display:flex;flex-direction:column;gap:8px;">
    <div style="padding:40px;text-align:center;color:var(--mm-text-secondary);">Loading…</div>
  </div>
</div>`

    try {
      _cats = await listCategories()
      render()
    } catch (err: any) {
      container.querySelector('#cat-list')!.innerHTML = `<div style="color:#b91c1c;">${err.message}</div>`
    }

    container.querySelector<HTMLButtonElement>('#cat-add')!.addEventListener('click', async () => {
      const name = (container.querySelector<HTMLInputElement>('#cat-name')!).value.trim()
      const type = (container.querySelector<HTMLSelectElement>('#cat-type')!).value as FinanceCategoryType
      if (!name) { Toast.error('Category name is required.'); return }
      try {
        const cat = await createCategory({ name, category_type: type })
        _cats.push(cat)
        _cats.sort((a, b) => a.name.localeCompare(b.name))
        render()
        Toast.success('Category created.')
        ;(container.querySelector<HTMLInputElement>('#cat-name')!).value = ''
      } catch (err: any) {
        Toast.error(err.message ?? 'Failed to create category.')
      }
    })

    function render() {
      const list = container.querySelector<HTMLElement>('#cat-list')!
      if (_cats.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mm-text-secondary);">No categories yet. Add one above.</div>`
        return
      }
      const income  = _cats.filter(c => c.category_type === 'income')
      const expense = _cats.filter(c => c.category_type === 'expense')
      const section = (label: string, color: string, items: FinanceCategoryRow[]) => `
        <div style="font-size:var(--text-sm);font-weight:600;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${label}</div>
        ${items.map(c => `
          <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:8px;padding:10px 14px;
            display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:var(--text-sm);font-weight:600;">${c.name}</span>
            <button class="mm-btn-icon" data-del-cat="${c.id}" title="Delete" style="color:#b91c1c;border-color:#fecaca;">
              <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>`).join('')}`
      list.innerHTML =
        (income.length  > 0 ? section('Income',  '#1a7f37', income)  : '') +
        (expense.length > 0 ? section('Expense', '#b91c1c', expense) : '')

      list.querySelectorAll<HTMLElement>('[data-del-cat]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['delCat']!
          if (!confirm('Delete this category? Transactions referencing it may be affected.')) return
          try {
            await softDeleteCategory(id)
            _cats = _cats.filter(c => c.id !== id)
            render()
            Toast.success('Category deleted.')
          } catch (err: any) { Toast.error(err.message) }
        })
      })
    }
  },
  destroy() { _cats = [] },
}

export default Categories
