// src/modules/finance/tabs/BudgetTab.ts

import {
  listBudgets, getBudgetStats, createBudgetLine, updateBudgetLine, listCategories,
} from '../repository'
import {
  fmtCurrency, EmptyState, renderStatCards,
  BudgetVarianceBadge, PeriodSwitcher, Modal,
} from '../widgets/index'
import type {
  FinanceBudget, BudgetStats, FinanceCategoryRow,
  FinanceBudgetPeriod,
} from '../finance.types'

export function createBudgetTab() {
  let container:  HTMLElement
  let budgets:    FinanceBudget[]      = []
  let categories: FinanceCategoryRow[] = []
  let stats:      BudgetStats          = { totalBudgeted:0, totalActual:0, remaining:0, overBudgetCount:0 }
  let period:     FinanceBudgetPeriod  = 'annual'
  let year        = new Date().getFullYear()
  let catFilter   = 'all'

  const periodLabel: Record<string, string> = {
    annual:    `Full Year ${new Date().getFullYear()}`,
    quarterly: `Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`,
    monthly:   new Date().toLocaleDateString('en-GB', { month:'long', year:'numeric' }),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(el: HTMLElement): void {
    container = el
    container.innerHTML = buildShell()
    attachListeners()
    loadData()
  }

  function buildShell(): string {
    return `
    <!-- Stats -->
    ${renderStatCards([
      { icon:'wallet2',            label:'Total Budget',  value:'GH₵ 0', iconBg:'rgba(88,166,255,.12)',  iconColor:'#58a6ff', id:'bgStatBudget' },
      { icon:'graph-up',           label:'Actual Spend',  value:'GH₵ 0', iconBg:'rgba(34,197,94,.12)',   iconColor:'#22c55e', id:'bgStatActual',
        barColor:'linear-gradient(90deg,#22c55e,#56d364)', barValue:0 },
      { icon:'piggy-bank',         label:'Remaining',     value:'GH₵ 0', iconBg:'rgba(16,185,129,.1)',   iconColor:'#10b981', id:'bgStatRemain' },
      { icon:'exclamation-octagon',label:'Over Budget',   value:'0',     iconBg:'rgba(244,63,94,.1)',    iconColor:'#f43f5e', id:'bgStatOver' },
    ])}

    <!-- Toolbar -->
    <div class="fin-toolbar animate-fade-up" style="animation-delay:200ms;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        ${PeriodSwitcher(
          [
            { value: 'monthly',   label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual',    label: 'Annual' },
          ],
          period,
          'bg'
        )}
        <span class="fin-page-info" id="bgPeriodLabel" style="font-weight:600;">${periodLabel[period]}</span>
      </div>
      <div class="fin-toolbar-actions">
        <button class="fin-tbtn" id="bgExport">
          <span class="bi bi-download"></span>
          <span class="fin-btn-label">Export</span>
        </button>
        <button class="fin-tbtn fin-tbtn-primary" id="bgNewBtn">
          <span class="bi bi-plus-lg"></span>
          <span class="fin-btn-label">Add Line</span>
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="fin-filter-row animate-fade-in" style="animation-delay:240ms;" id="bgFilterRow">
      <button class="fin-filter-chip active-all" data-bgfilter="all">
        <span class="bi bi-filter" style="font-size:12px;"></span> All
      </button>
      <button class="fin-filter-chip" data-bgfilter="income">
        <span class="bi bi-arrow-down-circle" style="font-size:12px;"></span> Income
      </button>
      <button class="fin-filter-chip" data-bgfilter="expense">
        <span class="bi bi-arrow-up-circle" style="font-size:12px;"></span> Expense
      </button>
      <span class="fin-page-info" style="margin-left:auto;" id="bgCountLabel"></span>
    </div>

    <!-- Budget list -->
    <div id="bgList" class="animate-fade-up" style="animation-delay:280ms;display:flex;flex-direction:column;gap:12px;"></div>

    <!-- Legend -->
    <div style="display:flex;align-items:center;gap:20px;padding:0 4px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:12px;height:4px;border-radius:99px;background:linear-gradient(90deg,#22c55e,#56d364);"></div>
        <span style="font-size:11px;color:#484f58;">Under budget</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:12px;height:4px;border-radius:99px;background:linear-gradient(90deg,#f59e0b,#fbbf24);"></div>
        <span style="font-size:11px;color:#484f58;">≥ 80% used</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:12px;height:4px;border-radius:99px;background:linear-gradient(90deg,#f43f5e,#fb7185);"></div>
        <span style="font-size:11px;color:#484f58;">Over budget</span>
      </div>
    </div>

    <!-- New budget line modal -->
    ${Modal('bgModal', 'Add Budget Line', buildBudgetForm(), `
      <button class="fin-tbtn" data-modal-close="bgModal">Cancel</button>
      <button class="fin-tbtn fin-tbtn-primary" id="bgModalSave">Add Line</button>
    `)}
    `
  }

  function buildBudgetForm(): string {
    return `
    <div id="bgFormError" style="display:none;"></div>
    <div class="fin-form-group">
      <label class="fin-label" for="bgFCat">Category *</label>
      <select class="fin-select" id="bgFCat" required>
        <option value="">Select category…</option>
      </select>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="bgFPeriod">Period *</label>
        <select class="fin-select" id="bgFPeriod" required>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual" selected>Annual</option>
        </select>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="bgFYear">Year *</label>
        <input class="fin-input" id="bgFYear" type="number" min="2000" value="${year}" required>
      </div>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="bgFMonth">Month <span style="color:#484f58;">(monthly only)</span></label>
        <select class="fin-select" id="bgFMonth">
          <option value="">—</option>
          ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            .map((m,i) => `<option value="${i+1}">${m}</option>`).join('')}
        </select>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="bgFQuarter">Quarter <span style="color:#484f58;">(quarterly only)</span></label>
        <select class="fin-select" id="bgFQuarter">
          <option value="">—</option>
          <option value="1">Q1</option>
          <option value="2">Q2</option>
          <option value="3">Q3</option>
          <option value="4">Q4</option>
        </select>
      </div>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="bgFAmount">Budgeted Amount (GHS) *</label>
      <input class="fin-input" id="bgFAmount" type="number" min="0" step="0.01" placeholder="0.00" required>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="bgFNotes">Notes</label>
      <input class="fin-input" id="bgFNotes" type="text" placeholder="Optional">
    </div>
    <input type="hidden" id="bgFEditId">
    `
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async function loadData(): Promise<void> {
    try {
      const [bg, bs, cats] = await Promise.all([
        listBudgets({ period }),
        getBudgetStats(period, year),
        listCategories(),
      ])
      budgets    = bg
      stats      = bs
      categories = cats
      updateStats()
      updateView()
      populateCatSelect()
    } catch (err: any) {
      container.querySelector<HTMLElement>('#bgList')!.innerHTML =
        `<div class="fin-empty-state">
          <span class="bi bi-exclamation-circle" style="font-size:2rem;color:#fb7185;"></span>
          <p class="fin-empty-title">${err?.message ?? 'Failed to load budgets.'}</p>
        </div>`
    }
  }

  function populateCatSelect(): void {
    const sel = container.querySelector<HTMLSelectElement>('#bgFCat')!
    sel.innerHTML = `<option value="">Select category…</option>` +
      categories.map(c => `<option value="${c.id}">[${c.category_type}] ${c.name}</option>`).join('')
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  function updateStats(): void {
    setEl('bgStatBudget', fmtCurrency(stats.totalBudgeted))
    setEl('bgStatActual', fmtCurrency(stats.totalActual))
    setEl('bgStatRemain', fmtCurrency(stats.remaining))
    setEl('bgStatOver',   String(stats.overBudgetCount))

    const pct = stats.totalBudgeted > 0
      ? Math.min(100, Math.round((stats.totalActual / stats.totalBudgeted) * 100))
      : 0
    const bars = container.querySelectorAll<HTMLElement>('.fin-stat-bar-fill')
    bars.forEach(b => { setTimeout(() => { b.style.width = `${pct}%` }, 400) })
  }

  // ── Filter + View ─────────────────────────────────────────────────────────

  function getFiltered(): FinanceBudget[] {
    if (catFilter === 'all') return budgets
    return budgets.filter(b => b.category_type === catFilter)
  }

  function updateView(): void {
    const filtered = getFiltered()
    setEl('bgCountLabel', `${filtered.length} lines`)

    const income  = filtered.filter(b => b.category_type === 'income')
    const expense = filtered.filter(b => b.category_type === 'expense')
    const list    = container.querySelector<HTMLElement>('#bgList')!

    if (!filtered.length) {
      list.innerHTML = EmptyState('wallet2', 'No budget lines', 'Add a line to get started')
      return
    }

    let html = ''
    if (income.length && catFilter !== 'expense') {
      html += `<p class="fin-section-header">Income</p>`
      income.forEach((b, i) => { html += buildBudgetCard(b, i) })
    }
    if (expense.length && catFilter !== 'income') {
      html += `<p class="fin-section-header" style="margin-top:8px;">Expense</p>`
      expense.forEach((b, i) => { html += buildBudgetCard(b, income.length + i) })
    }
    list.innerHTML = html
  }

  // ── Card rendering ────────────────────────────────────────────────────────

  function buildBudgetCard(b: FinanceBudget, i: number): string {
    const pct     = b.budgeted_amount > 0 ? (b.actual_amount / b.budgeted_amount) * 100 : 0
    const over    = b.actual_amount > b.budgeted_amount && b.budgeted_amount > 0
    const warn    = !over && pct >= 80
    const clamped = Math.min(100, pct)
    const fillBg  = over ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                  : warn ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(90deg,#22c55e,#56d364)'
    const actColor = over ? '#fb7185' : '#e6edf3'
    const pctColor = over ? '#fb7185' : warn ? '#fbbf24' : '#34d399'
    const variance = b.actual_amount - b.budgeted_amount
    const catIcon  = b.category_type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'
    const catBg    = b.category_type === 'income' ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.08)'
    const catColor = b.category_type === 'income' ? '#34d399' : '#fb7185'

    return `
    <div class="fin-budget-card animate-fade-up" style="animation-delay:${i*50}ms;"
      onmousemove="(function(e,el){const r=el.getBoundingClientRect();el.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');el.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');})(event,this)"
      onmouseleave="this.style.setProperty('--mx','50%');this.style.setProperty('--my','50%')"
    >
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <!-- Icon -->
        <div style="
          width:42px;height:42px;border-radius:12px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:${catBg};
        ">
          <span class="bi bi-${catIcon}" style="font-size:18px;color:${catColor};"></span>
        </div>

        <!-- Main -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
            <span style="font-size:14px;font-weight:600;color:#e6edf3;">${b.category_name ?? '—'}</span>
            <span style="
              display:inline-flex;align-items:center;gap:3px;
              padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;
              background:${catBg};color:${catColor};
            ">${b.category_type}</span>
          </div>

          <!-- Progress bar -->
          <div style="height:8px;border-radius:99px;background:#21262d;overflow:hidden;margin:10px 0 8px;">
            <div style="
              height:100%;border-radius:99px;width:${clamped.toFixed(1)}%;
              background:${fillBg};
              animation:finBarGrow .9s ${.3 + i * .04}s cubic-bezier(.16,1,.3,1) both;
            "></div>
          </div>

          <!-- Amounts row -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:18px;">
              <div>
                <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.05em;">Actual</div>
                <div style="font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:${actColor};">
                  ${fmtCurrency(b.actual_amount)}
                </div>
              </div>
              <div style="width:1px;height:32px;background:#30363d;"></div>
              <div>
                <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.05em;">Budgeted</div>
                <div style="font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:#8b949e;">
                  ${fmtCurrency(b.budgeted_amount)}
                </div>
              </div>
              <div style="width:1px;height:32px;background:#30363d;"></div>
              <div>
                <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.05em;">Used</div>
                <div style="font-size:14px;font-weight:700;color:${pctColor};">
                  ${b.budgeted_amount > 0 ? Math.round(pct) + '%' : '—'}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${BudgetVarianceBadge(variance, b.budgeted_amount)}
              <button class="fin-icon-btn fin-bg-edit" data-budget-id="${b.id}" title="Edit" aria-label="Edit budget line">
                <span class="bi bi-pencil"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  async function saveBudgetLine(): Promise<void> {
    const catId    = container.querySelector<HTMLSelectElement>('#bgFCat')?.value ?? ''
    const p        = container.querySelector<HTMLSelectElement>('#bgFPeriod')?.value as FinanceBudgetPeriod
    const yr       = parseInt(container.querySelector<HTMLInputElement>('#bgFYear')?.value ?? '2025')
    const month    = parseInt(container.querySelector<HTMLSelectElement>('#bgFMonth')?.value ?? '') || null
    const quarter  = parseInt(container.querySelector<HTMLSelectElement>('#bgFQuarter')?.value ?? '') || null
    const amount   = parseFloat(container.querySelector<HTMLInputElement>('#bgFAmount')?.value ?? '0')
    const notes    = container.querySelector<HTMLInputElement>('#bgFNotes')?.value || null
    const editId   = container.querySelector<HTMLInputElement>('#bgFEditId')?.value || null

    if (!catId || !p || !yr || !amount) {
      const err = container.querySelector<HTMLElement>('#bgFormError')
      if (err) {
        err.textContent = 'Please fill in all required fields.'
        err.style.cssText = `display:block;padding:10px 14px;border-radius:8px;font-size:13px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);color:#fb7185;margin-bottom:12px;`
      }
      return
    }

    const btn = container.querySelector<HTMLButtonElement>('#bgModalSave')!
    btn.disabled = true; btn.textContent = 'Saving…'

    try {
      if (editId) {
        await updateBudgetLine(editId, { budgeted_amount: amount, notes })
      } else {
        await createBudgetLine({ category_id: catId, period: p, year: yr, month, quarter, budgeted_amount: amount, notes })
      }
      container.querySelector<HTMLElement>('#bgModal')!.style.display = 'none'
      await loadData()
    } catch (err: any) {
      const errEl = container.querySelector<HTMLElement>('#bgFormError')
      if (errEl) {
        errEl.textContent = err?.message ?? 'Failed.'
        errEl.style.cssText = `display:block;padding:10px 14px;border-radius:8px;font-size:13px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);color:#fb7185;margin-bottom:12px;`
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Add Line'
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function attachListeners(): void {
    // Period switcher
    container.querySelector('.fin-period-bar')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-period]')
      if (!btn) return
      period = btn.dataset['period'] as FinanceBudgetPeriod
      container.querySelectorAll<HTMLElement>('[data-period]').forEach(b => {
        b.classList.toggle('active', b.dataset['period'] === period)
      })
      setEl('bgPeriodLabel', periodLabel[period])
      loadData()
    })

    // Category filter
    container.querySelector('#bgFilterRow')?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-bgfilter]')
      if (!chip) return
      catFilter = chip.dataset['bgfilter'] ?? 'all'
      container.querySelectorAll<HTMLElement>('[data-bgfilter]').forEach(c => {
        c.className = 'fin-filter-chip'
        if (c.dataset['bgfilter'] === catFilter) c.classList.add(`active-${catFilter}`)
      })
      updateView()
    })

    // New button
    container.querySelector('#bgNewBtn')?.addEventListener('click', () => {
      container.querySelector<HTMLElement>('#bgModal')!.style.display = 'flex'
    })

    container.querySelector('#bgModalSave')?.addEventListener('click', () => saveBudgetLine())

    // Modal close
    container.addEventListener('click', (e) => {
      const close = (e.target as HTMLElement).closest<HTMLElement>('[data-modal-close]')
      if (close?.dataset['modalClose'] === 'bgModal') {
        container.querySelector<HTMLElement>('#bgModal')!.style.display = 'none'
      }
    })

    // Edit button (delegated)
    container.querySelector('#bgList')?.addEventListener('click', (e) => {
      const editBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-budget-id]')
      if (!editBtn) return
      const id     = editBtn.dataset['budgetId']!
      const budget = budgets.find(b => b.id === id)
      if (!budget) return
      const sel = container.querySelector<HTMLInputElement>('#bgFCat')
      const amtEl = container.querySelector<HTMLInputElement>('#bgFAmount')
      const editIdEl = container.querySelector<HTMLInputElement>('#bgFEditId')
      if (sel)     sel.value     = budget.category_id
      if (amtEl)   amtEl.value   = String(budget.budgeted_amount)
      if (editIdEl) editIdEl.value = budget.id
      container.querySelector<HTMLElement>('#bgModal')!.style.display = 'flex'
    })
  }

  function setEl(id: string, val: string): void {
    const el = container.querySelector<HTMLElement>(`#${id}`)
    if (el) el.textContent = val
  }

  return { render, destroy: () => {} }
}