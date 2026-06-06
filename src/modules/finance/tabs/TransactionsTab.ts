// src/modules/finance/tabs/TransactionsTab.ts

import {
  listTransactions,
  getFinanceStats,
  createTransaction,
  updateTransaction,
  voidTransaction,
  listCategories,
} from '../repository'
import {
  fmtCurrency, fmtDate, EmptyState, SkeletonRows,
  PaginationControls, BulkActionBar, renderStatCards,
  PaymentMethodBadge, TransactionTypeBadge, Modal, Drawer,
} from '../widgets/index'
import type {
  FinanceTransaction, TransactionFilter,
  FinanceStats, FinanceCategoryRow,
} from '../finance.types'

// ── State ─────────────────────────────────────────────────────────────────────

interface TxState {
  transactions: FinanceTransaction[]
  categories:   FinanceCategoryRow[]
  stats:        FinanceStats
  filter:       TransactionFilter
  sortCol:      string
  sortDir:      'asc' | 'desc'
  page:         number
  perPage:      number
  activeFilter: string
  selectedIds:  Set<string>
  loading:      boolean
}

const PER_PAGE = 10

export function createTransactionsTab() {
  let container: HTMLElement
  let state: TxState = {
    transactions: [],
    categories:   [],
    stats:        { totalIncome: 0, totalExpense: 0, netBalance: 0, pendingCount: 0 },
    filter:       {},
    sortCol:      'transaction_date',
    sortDir:      'desc',
    page:         1,
    perPage:      PER_PAGE,
    activeFilter: 'all',
    selectedIds:  new Set(),
    loading:      false,
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(el: HTMLElement): void {
    container = el
    container.innerHTML = buildShell()
    attachEventListeners()
    loadData()
  }

  function buildShell(): string {
    return `
    <div class="fin-bg-glow"></div>

    <!-- Stat cards -->
    <div id="txStats">
      ${renderStatCards([
        { icon: 'arrow-down-circle', label: 'Total Income',   value: 'Loading…', iconBg: 'rgba(16,185,129,.12)',  iconColor: '#10b981', id: 'txStatIncome' },
        { icon: 'arrow-up-circle',   label: 'Total Expense',  value: 'Loading…', iconBg: 'rgba(244,63,94,.1)',    iconColor: '#f43f5e', id: 'txStatExpense' },
        { icon: 'bank',              label: 'Net Balance',    value: 'Loading…', iconBg: 'rgba(88,166,255,.12)',  iconColor: '#58a6ff', id: 'txStatNet' },
        { icon: 'clock-history',     label: 'Today\'s Entries', value: '0',     iconBg: 'rgba(245,158,11,.1)',   iconColor: '#f59e0b', id: 'txStatPending' },
      ])}
    </div>

    <!-- Toolbar -->
    <div class="fin-toolbar animate-fade-up" style="animation-delay:200ms;">
      <div class="fin-search-wrap">
        <span class="bi bi-search"></span>
        <input
          class="fin-search-input"
          id="txSearch"
          type="text"
          placeholder="Search transactions…"
          aria-label="Search transactions"
        >
      </div>
      <div class="fin-toolbar-actions">
        <div class="fin-sort-wrap">
          <span class="bi bi-arrow-down-up"></span>
          <select class="fin-sort-select" id="txSort" aria-label="Sort transactions">
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount (High–Low)</option>
            <option value="amount_asc">Amount (Low–High)</option>
          </select>
        </div>
        <button class="fin-tbtn" id="txExportBtn" aria-label="Export">
          <span class="bi bi-download"></span>
          <span class="fin-btn-label">Export</span>
        </button>
        <button class="fin-tbtn fin-tbtn-primary" id="txNewBtn" aria-label="Record transaction">
          <span class="bi bi-plus-lg"></span>
          <span class="fin-btn-label">Record</span>
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="fin-filter-row animate-fade-in" style="animation-delay:250ms;" id="txFilterRow">
      ${buildFilterChips()}
      <span class="fin-page-info" style="margin-left:auto;" id="txCountLabel"></span>
    </div>

    <!-- Bulk action bar -->
    ${BulkActionBar(0)}

    <!-- Desktop table -->
    <div class="fin-table-wrap animate-fade-up" style="animation-delay:300ms;" id="txTableWrap">
      <div class="fin-table-scroll">
        <table class="fin-table" role="grid" aria-label="Transactions">
          <thead>
            <tr>
              <th style="width:36px;padding:10px 10px 10px 16px;">
                <input type="checkbox" class="fin-chk" id="txSelectAll" aria-label="Select all">
              </th>
              <th data-sort="transaction_date" aria-sort="descending">
                Date <span class="sort-arrow">↓</span>
              </th>
              <th data-sort="description">Description <span class="sort-arrow">↕</span></th>
              <th data-sort="member_name">Member <span class="sort-arrow">↕</span></th>
              <th>Category</th>
              <th>Method</th>
              <th data-sort="amount" style="text-align:right;">Amount <span class="sort-arrow">↕</span></th>
              <th>Ref</th>
              <th style="width:72px;"></th>
            </tr>
          </thead>
          <tbody id="txBody">
            ${SkeletonRows()}
          </tbody>
        </table>
      </div>
      <div id="txTableEmpty" style="display:none;">
        ${EmptyState('receipt', 'No transactions found', 'Try adjusting your search or filters')}
      </div>
    </div>

    <!-- Mobile list -->
    <div id="txMobileList" class="fin-mobile-list" aria-label="Transactions list"></div>

    <!-- Pagination -->
    <div id="txPagination"></div>

    <!-- Transaction detail drawer -->
    ${Drawer('txDrawer', 'Transaction Detail', '<div id="txDrawerBody"></div>')}

    <!-- New / edit transaction modal -->
    ${Modal('txModal', 'Record Transaction', buildTransactionForm(), `
      <button class="fin-tbtn" data-modal-close="txModal">Cancel</button>
      <button class="fin-tbtn fin-tbtn-primary" id="txModalSave">Save Transaction</button>
    `)}
    `
  }

  function buildFilterChips(): string {
    const chips = [
      { key: 'all',      label: 'All',           icon: 'filter' },
      { key: 'income',   label: 'Income',         icon: 'arrow-down-circle' },
      { key: 'expense',  label: 'Expense',        icon: 'arrow-up-circle' },
      { key: 'offering', label: 'Offering',       icon: 'gift' },
      { key: 'pledge',   label: 'Pledge Payment', icon: 'handshake' },
      { key: 'tithe',    label: 'Tithe',          icon: 'church2' },
      { key: 'donation', label: 'Donation',       icon: 'heart' },
    ]
    return chips.map(c => `
    <button
      class="fin-filter-chip ${c.key === state.activeFilter ? 'active-' + c.key : ''}"
      data-txfilter="${c.key}"
      aria-pressed="${c.key === state.activeFilter}"
    >
      <span class="bi bi-${c.icon}" style="font-size:12px;"></span>
      ${c.label}
    </button>`).join('')
  }

  function buildTransactionForm(): string {
    const methodOptions = [
      { value: 'cash',          label: 'Cash' },
      { value: 'momo',          label: 'Mobile Money' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'cheque',        label: 'Cheque' },
      { value: 'other',         label: 'Other' },
    ]
    const typeOptions = [
      { value: 'tithe',            label: 'Tithe' },
      { value: 'offering',         label: 'Offering' },
      { value: 'special_offering', label: 'Special Offering' },
      { value: 'pledge_payment',   label: 'Pledge Payment' },
      { value: 'donation',         label: 'Donation' },
      { value: 'expense',          label: 'Expense' },
    ]
    return `
    <div id="txFormError" style="display:none;" class="fin-form-error"></div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="txFType">Transaction Type *</label>
        <select class="fin-select" id="txFType" required>
          <option value="">Select type…</option>
          ${typeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="txFCategory">Category *</label>
        <select class="fin-select" id="txFCategory" required>
          <option value="">Select category…</option>
        </select>
      </div>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="txFAmount">Amount (GHS) *</label>
        <input class="fin-input" id="txFAmount" type="number" min="0.01" step="0.01" placeholder="0.00" required>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="txFMethod">Payment Method *</label>
        <select class="fin-select" id="txFMethod" required>
          <option value="">Select method…</option>
          ${methodOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="txFDate">Date *</label>
        <input class="fin-input" id="txFDate" type="date" required>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="txFRef">Reference Number</label>
        <input class="fin-input" id="txFRef" type="text" placeholder="Optional">
      </div>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="txFDesc">Description</label>
      <input class="fin-input" id="txFDesc" type="text" placeholder="Brief description">
    </div>
    <input type="hidden" id="txFEditId">
    `
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadData(): Promise<void> {
    state.loading = true
    try {
      const [transactions, stats, categories] = await Promise.all([
        listTransactions(state.filter, { limit: 1000 }),
        getFinanceStats(),
        listCategories(),
      ])
      state.transactions = transactions
      state.stats        = stats
      state.categories   = categories
      state.loading      = false
      updateStats()
      updateFilteredView()
      populateCategorySelect()
    } catch (err) {
      state.loading = false
      showError(err)
    }
  }

  function populateCategorySelect(): void {
    const sel = container.querySelector<HTMLSelectElement>('#txFCategory')
    if (!sel) return
    const opts = state.categories.map(c =>
      `<option value="${c.id}">[${c.category_type}] ${c.name}</option>`
    ).join('')
    sel.innerHTML = `<option value="">Select category…</option>${opts}`
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  function updateStats(): void {
    const s = state.stats
    const netColor = s.netBalance >= 0 ? '#34d399' : '#fb7185'

    setEl('txStatIncome',  fmtCurrency(s.totalIncome))
    setEl('txStatExpense', fmtCurrency(s.totalExpense))
    setEl('txStatNet',     fmtCurrency(s.netBalance))
    setEl('txStatPending', String(s.pendingCount))

    const netEl = container.querySelector<HTMLElement>('#txStatNet')
    if (netEl) netEl.style.color = netColor
  }

  // ── Filtering & sorting ───────────────────────────────────────────────────

  function getFiltered(): FinanceTransaction[] {
    const q     = (container.querySelector<HTMLInputElement>('#txSearch')?.value ?? '').toLowerCase().trim()
    const fKey  = state.activeFilter

    // Category-type filter lookup
    const txTypeMap: Record<string, string[]> = {
      income:   [],   // matched by category_type
      expense:  [],
      offering: ['offering', 'special_offering'],
      pledge:   ['pledge_payment'],
      tithe:    ['tithe'],
      donation: ['donation'],
    }

    let list = state.transactions.filter(t => {
      if (fKey === 'all') return true
      if (fKey === 'income')  return t.category_type === 'income'
      if (fKey === 'expense') return t.category_type === 'expense'
      const allowed = txTypeMap[fKey]
      if (allowed && allowed.length) return allowed.includes(t.transaction_type)
      return true
    })

    if (q) {
      list = list.filter(t =>
        (t.description    ?? '').toLowerCase().includes(q) ||
        (t.member_name    ?? '').toLowerCase().includes(q) ||
        (t.category_name  ?? '').toLowerCase().includes(q) ||
        (t.reference_number ?? '').toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    }

    // Sort
    const dir = state.sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let va: any, vb: any
      switch (state.sortCol) {
        case 'transaction_date': va = a.transaction_date; vb = b.transaction_date; break
        case 'amount':           va = a.amount;           vb = b.amount;           break
        case 'description':      va = a.description ?? ''; vb = b.description ?? ''; break
        case 'member_name':      va = a.member_name ?? ''; vb = b.member_name ?? ''; break
        default:                 va = a.transaction_date; vb = b.transaction_date
      }
      if (va < vb) return -dir
      if (va > vb) return dir
      return 0
    })

    return list
  }

  function updateFilteredView(): void {
    const filtered   = getFiltered()
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
    if (state.page > totalPages) state.page = totalPages
    const paged = filtered.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE)

    setEl('txCountLabel', `Showing ${filtered.length} of ${state.transactions.length}`)

    renderTableRows(paged)
    renderMobileCards(paged)
    renderPagination(totalPages, filtered.length)
    syncSelectAll()
  }

  // ── Table rows ────────────────────────────────────────────────────────────

  function renderTableRows(list: FinanceTransaction[]): void {
    const tbody  = container.querySelector<HTMLElement>('#txBody')!
    const empty  = container.querySelector<HTMLElement>('#txTableEmpty')!

    if (!list.length) {
      tbody.innerHTML = ''
      empty.style.display = 'flex'
      return
    }
    empty.style.display = 'none'

    // Group by date
    const groups = new Map<string, FinanceTransaction[]>()
    list.forEach(t => {
      const key = t.transaction_date
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    })

    const dates = [...groups.keys()].sort((a, b) =>
      state.sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
    )

    let html = ''
    let idx  = 0

    dates.forEach(date => {
      html += `<tr class="fin-date-group-header"><td colspan="9">${fmtDate(date)}</td></tr>`
      groups.get(date)!.forEach(t => {
        const isIncome   = t.category_type === 'income'
        const typeColor  = isIncome ? '#34d399' : '#fb7185'
        const typeBg     = isIncome ? 'rgba(16,185,129,.1)' : 'rgba(244,63,94,.08)'
        const typeIcon   = isIncome ? 'arrow-down' : 'arrow-up'
        const checked    = state.selectedIds.has(t.id) ? 'checked' : ''
        const delay      = Math.min(idx, 9) * 40
        idx++

        html += `
        <tr class="fin-table-row" style="animation-delay:${delay}ms;" data-tx-id="${t.id}">
          <td style="padding-left:16px;">
            <input type="checkbox" class="fin-chk fin-row-chk" data-id="${t.id}" ${checked}
              aria-label="Select transaction">
          </td>
          <td>
            <div style="font-size:13px;font-weight:500;color:#e6edf3;">${fmtDate(t.transaction_date)}</div>
            <div style="font-size:10px;font-family:monospace;color:#484f58;margin-top:2px;">
              ${t.id.slice(0, 8)}…
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="fin-type-icon" style="background:${typeBg};">
                <span class="bi bi-${typeIcon}" style="font-size:14px;color:${typeColor};"></span>
              </div>
              <div>
                <div style="font-size:13px;font-weight:500;color:#e6edf3;line-height:1.3;">
                  ${t.description ?? '—'}
                </div>
                <div style="font-size:10px;color:#484f58;margin-top:1px;">
                  ${t.transaction_type.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </td>
          <td>
            ${t.member_name
              ? `<span style="font-size:13px;color:#8b949e;">${t.member_name}</span>`
              : `<span style="font-size:12px;color:#484f58;font-style:italic;">—</span>`
            }
          </td>
          <td>
            <span style="
              display:inline-flex;align-items:center;gap:4px;
              padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;
              background:rgba(88,166,255,.1);color:#58a6ff;
            ">${t.category_name ?? '—'}</span>
          </td>
          <td>${PaymentMethodBadge(t.payment_method)}</td>
          <td style="text-align:right;">
            <span style="
              font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;
              color:${isIncome ? '#34d399' : '#fb7185'};
            ">${isIncome ? '+' : '−'}${fmtCurrency(Number(t.amount))}</span>
          </td>
          <td>
            <span style="font-size:11px;font-family:monospace;color:#484f58;">
              ${t.reference_number ?? '—'}
            </span>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:2px;">
              <button class="fin-icon-btn fin-tx-view" data-id="${t.id}" title="View" aria-label="View transaction">
                <span class="bi bi-eye"></span>
              </button>
              <button class="fin-icon-btn fin-tx-edit" data-id="${t.id}" title="Edit" aria-label="Edit transaction">
                <span class="bi bi-pencil"></span>
              </button>
              <button class="fin-icon-btn" style="color:#fb7185;" data-id="${t.id}"
                title="Void" class="fin-tx-void" aria-label="Void transaction">
                <span class="bi bi-x-circle"></span>
              </button>
            </div>
          </td>
        </tr>`
      })
    })

    tbody.innerHTML = html
  }

  // ── Mobile cards ──────────────────────────────────────────────────────────

  function renderMobileCards(list: FinanceTransaction[]): void {
    const el = container.querySelector<HTMLElement>('#txMobileList')!
    if (!list.length) {
      el.innerHTML = EmptyState('receipt', 'No transactions found')
      return
    }
    el.innerHTML = list.map((t, i) => {
      const isIncome  = t.category_type === 'income'
      const typeColor = isIncome ? '#34d399' : '#fb7185'
      const typeBg    = isIncome ? 'rgba(16,185,129,.1)' : 'rgba(244,63,94,.08)'
      const typeIcon  = isIncome ? 'arrow-down' : 'arrow-up'
      return `
      <div class="fin-mobile-card" style="animation-delay:${Math.min(i,9)*50}ms;"
        onmousemove="(function(e,el){const r=el.getBoundingClientRect();el.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');el.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');})(event,this)"
        onmouseleave="this.style.setProperty('--mx','50%');this.style.setProperty('--my','50%')"
      >
        <div class="fin-type-icon" style="background:${typeBg};flex-shrink:0;">
          <span class="bi bi-${typeIcon}" style="font-size:15px;color:${typeColor};"></span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <div>
              <div style="font-size:13.5px;font-weight:600;color:#e6edf3;line-height:1.3;">
                ${t.description ?? '—'}
              </div>
              <div style="font-size:10px;font-family:monospace;color:#484f58;margin-top:1px;">
                ${t.id.slice(0,8)}…
              </div>
            </div>
            <span style="
              font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;flex-shrink:0;
              color:${isIncome ? '#34d399' : '#fb7185'};
            ">${isIncome ? '+' : '−'}${fmtCurrency(Number(t.amount))}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;">
            <span style="
              display:inline-flex;align-items:center;gap:3px;
              padding:2px 7px;border-radius:5px;font-size:10px;font-weight:500;
              background:rgba(88,166,255,.1);color:#58a6ff;
            ">${t.category_name ?? '—'}</span>
            ${PaymentMethodBadge(t.payment_method)}
            <span style="font-size:11px;color:#484f58;">${fmtDate(t.transaction_date)}</span>
          </div>
          ${t.member_name ? `
          <div style="margin-top:6px;font-size:11px;color:#8b949e;">
            <span class="bi bi-person" style="font-size:11px;margin-right:3px;"></span>
            ${t.member_name}
          </div>` : ''}
        </div>
      </div>`
    }).join('')
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  function renderPagination(totalPages: number, total: number): void {
    const el = container.querySelector<HTMLElement>('#txPagination')!
    el.innerHTML = PaginationControls(state.page, totalPages, 'txpage')
    el.querySelectorAll('[data-txpage]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number((btn as HTMLElement).dataset['txpage'])
        if (p < 1 || p > totalPages || p === state.page) return
        state.page = p
        updateFilteredView()
        container.scrollIntoView({ behavior: 'smooth' })
      })
    })
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function syncSelectAll(): void {
    const allChk   = container.querySelector<HTMLInputElement>('#txSelectAll')
    const rowChks  = container.querySelectorAll<HTMLInputElement>('.fin-row-chk')
    if (!allChk || !rowChks.length) return
    const allChecked = Array.from(rowChks).every(c => c.checked)
    allChk.checked       = allChecked
    allChk.indeterminate = !allChecked && state.selectedIds.size > 0
  }

  function updateBulkBar(): void {
    const bar       = container.querySelector<HTMLElement>('#finBulkBar')!
    const countEl   = container.querySelector<HTMLElement>('#finBulkCount')!
    const n         = state.selectedIds.size
    bar.classList.toggle('visible', n > 0)
    countEl.textContent = String(n)
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openModal(): void {
    const m = container.querySelector<HTMLElement>('#txModal')!
    // Set default date to today
    const dateInput = container.querySelector<HTMLInputElement>('#txFDate')
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0]
    }
    m.style.display = 'flex'
    container.querySelector<HTMLElement>('#txFType')?.focus()
  }

  function closeModal(): void {
    const m = container.querySelector<HTMLElement>('#txModal')!
    m.style.display = 'none'
    clearForm()
  }

  function clearForm(): void {
    ;['txFType','txFCategory','txFAmount','txFMethod','txFDate','txFRef','txFDesc','txFEditId']
      .forEach(id => {
        const el = container.querySelector<HTMLInputElement>(`#${id}`)
        if (el) el.value = ''
      })
    const errEl = container.querySelector<HTMLElement>('#txFormError')
    if (errEl) errEl.style.display = 'none'
  }

  function showFormError(msg: string): void {
    const errEl = container.querySelector<HTMLElement>('#txFormError')
    if (!errEl) return
    errEl.textContent = msg
    errEl.style.cssText = `
      display:block; padding:10px 14px; border-radius:8px; font-size:13px;
      background:rgba(244,63,94,.1); border:1px solid rgba(244,63,94,.3);
      color:#fb7185; margin-bottom:12px;
    `
  }

  async function saveTransaction(): Promise<void> {
    const type   = (container.querySelector<HTMLSelectElement>('#txFType')?.value ?? '') as any
    const catId  = container.querySelector<HTMLSelectElement>('#txFCategory')?.value ?? ''
    const amount = parseFloat(container.querySelector<HTMLInputElement>('#txFAmount')?.value ?? '0')
    const method = (container.querySelector<HTMLSelectElement>('#txFMethod')?.value ?? '') as any
    const date   = container.querySelector<HTMLInputElement>('#txFDate')?.value ?? ''
    const ref    = container.querySelector<HTMLInputElement>('#txFRef')?.value || null
    const desc   = container.querySelector<HTMLInputElement>('#txFDesc')?.value || null
    const editId = container.querySelector<HTMLInputElement>('#txFEditId')?.value || null

    if (!type || !catId || !amount || !method || !date) {
      showFormError('Please fill in all required fields.')
      return
    }

    const saveBtn = container.querySelector<HTMLButtonElement>('#txModalSave')!
    saveBtn.disabled    = true
    saveBtn.textContent = 'Saving…'

    try {
      if (editId) {
        await updateTransaction(editId, {
          category_id:      catId,
          transaction_type: type,
          amount,
          payment_method:   method,
          transaction_date: date,
          reference_number: ref,
          description:      desc,
        })
      } else {
        await createTransaction({
          category_id:      catId,
          transaction_type: type,
          amount,
          payment_method:   method,
          transaction_date: date,
          reference_number: ref,
          description:      desc,
        })
      }
      closeModal()
      await loadData()
    } catch (err: any) {
      showFormError(err?.message ?? 'Failed to save transaction.')
    } finally {
      saveBtn.disabled    = false
      saveBtn.textContent = 'Save Transaction'
    }
  }

  // ── Drawer ────────────────────────────────────────────────────────────────

  function openDrawer(tx: FinanceTransaction): void {
    const body   = container.querySelector<HTMLElement>('#txDrawerBody')!
    const isInc  = tx.category_type === 'income'
    const amtCol = isInc ? '#34d399' : '#fb7185'
    const sign   = isInc ? '+' : '−'

    body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="text-align:center;padding:20px 0;">
        <div style="
          font-size:2rem;font-weight:800;color:${amtCol};
          font-variant-numeric:tabular-nums;margin-bottom:4px;
        ">${sign}${fmtCurrency(Number(tx.amount))}</div>
        <div style="font-size:14px;color:#8b949e;">${tx.description ?? '—'}</div>
      </div>
      ${buildDetailRow('Date',       fmtDate(tx.transaction_date))}
      ${buildDetailRow('Type',       tx.transaction_type.replace(/_/g,' '))}
      ${buildDetailRow('Category',   tx.category_name ?? '—')}
      ${buildDetailRow('Method',     tx.payment_method.replace(/_/g,' '))}
      ${buildDetailRow('Member',     tx.member_name ?? '—')}
      ${buildDetailRow('Reference',  tx.reference_number ?? '—')}
      ${buildDetailRow('Currency',   tx.currency)}
      <div style="margin-top:8px;padding-top:16px;border-top:1px solid #21262d;">
        <div style="font-size:10px;font-family:monospace;color:#484f58;">ID: ${tx.id}</div>
        <div style="font-size:10px;font-family:monospace;color:#484f58;margin-top:2px;">
          Created: ${fmtDate(tx.created_at)}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="fin-tbtn" style="flex:1;" data-tx-drawer-edit="${tx.id}">
          <span class="bi bi-pencil"></span> Edit
        </button>
        <button class="fin-tbtn fin-tbtn-danger" data-tx-drawer-void="${tx.id}">
          <span class="bi bi-x-circle"></span> Void
        </button>
      </div>
    </div>`

    const overlay = container.querySelector<HTMLElement>('#txDrawer')!
    overlay.style.display = 'flex'
  }

  function buildDetailRow(label: string, value: string): string {
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:10px 0;border-bottom:1px solid #21262d;">
      <span style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em;">${label}</span>
      <span style="font-size:13px;font-weight:500;color:#e6edf3;">${value}</span>
    </div>`
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function attachEventListeners(): void {
    // Search
    container.querySelector('#txSearch')?.addEventListener('input', () => {
      state.page = 1
      updateFilteredView()
    })

    // Sort select
    container.querySelector('#txSort')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value
      if (v === 'date_desc')   { state.sortCol = 'transaction_date'; state.sortDir = 'desc' }
      if (v === 'date_asc')    { state.sortCol = 'transaction_date'; state.sortDir = 'asc'  }
      if (v === 'amount_desc') { state.sortCol = 'amount';           state.sortDir = 'desc' }
      if (v === 'amount_asc')  { state.sortCol = 'amount';           state.sortDir = 'asc'  }
      state.page = 1
      updateFilteredView()
    })

    // Column sort headers
    container.querySelector<HTMLElement>('#txTableWrap')
      ?.querySelectorAll<HTMLElement>('th[data-sort]')
      .forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset['sort']!
          if (state.sortCol === col) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
          } else {
            state.sortCol = col
            state.sortDir = 'desc'
          }
          container.querySelectorAll<HTMLElement>('th[data-sort]').forEach(t => {
            t.classList.remove('sort-active')
            const arr = t.querySelector('.sort-arrow')
            if (arr) arr.textContent = '↕'
          })
          th.classList.add('sort-active')
          const arrow = th.querySelector('.sort-arrow')
          if (arrow) arrow.textContent = state.sortDir === 'asc' ? '↑' : '↓'
          state.page = 1
          updateFilteredView()
        })
      })

    // Filter chips
    container.querySelector('#txFilterRow')?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-txfilter]')
      if (!chip) return
      state.activeFilter = chip.dataset['txfilter'] ?? 'all'
      state.page         = 1
      container.querySelectorAll<HTMLElement>('[data-txfilter]').forEach(c => {
        c.className = 'fin-filter-chip'
        if (c.dataset['txfilter'] === state.activeFilter) {
          c.classList.add(`active-${state.activeFilter}`)
          c.setAttribute('aria-pressed', 'true')
        } else {
          c.setAttribute('aria-pressed', 'false')
        }
      })
      updateFilteredView()
    })

    // Select all
    container.querySelector('#txSelectAll')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      container.querySelectorAll<HTMLInputElement>('.fin-row-chk').forEach(chk => {
        chk.checked = checked
        if (checked) state.selectedIds.add(chk.dataset['id']!)
        else         state.selectedIds.delete(chk.dataset['id']!)
      })
      updateBulkBar()
    })

    // Row checkboxes (delegated)
    container.querySelector('#txBody')?.addEventListener('change', (e) => {
      const chk = (e.target as HTMLElement).closest<HTMLInputElement>('.fin-row-chk')
      if (!chk) return
      const id = chk.dataset['id']!
      if (chk.checked) state.selectedIds.add(id)
      else             state.selectedIds.delete(id)
      updateBulkBar()
      syncSelectAll()
    })

    // New button
    container.querySelector('#txNewBtn')?.addEventListener('click', () => openModal())

    // Modal save
    container.querySelector('#txModalSave')?.addEventListener('click', () => saveTransaction())

    // Modal close
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset['modalClose'] === 'txModal') closeModal()
      if (target.classList.contains('fin-modal-overlay') &&
          (target as HTMLElement).id === 'txModal') closeModal()
    })

    // Drawer close
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset['drawerClose'] === 'txDrawer' ||
          target.closest('[data-drawer-close="txDrawer"]')) {
        const overlay = container.querySelector<HTMLElement>('#txDrawer')!
        overlay.style.display = 'none'
      }
    })

    // Row view / edit / void (delegated via tbody)
    container.querySelector('#txBody')?.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
      if (!btn) return
      const id = btn.dataset['id']!
      const tx = state.transactions.find(t => t.id === id)
      if (!tx) return

      if (btn.classList.contains('fin-tx-view')) {
        openDrawer(tx)
        return
      }
      if (btn.classList.contains('fin-tx-edit')) {
        openModal()
        fillForm(tx)
        return
      }
      // void
      if (confirm(`Void transaction "${tx.description ?? tx.id}"? This cannot be undone.`)) {
        try {
          await voidTransaction(id)
          await loadData()
        } catch (err: any) {
          alert(err?.message ?? 'Failed to void transaction.')
        }
      }
    })

    // Drawer edit / void
    container.querySelector('#txDrawerBody')?.addEventListener('click', async (e) => {
      const btn  = e.target as HTMLElement
      const editId  = btn.closest<HTMLElement>('[data-tx-drawer-edit]')?.dataset['txDrawerEdit']
      const voidId  = btn.closest<HTMLElement>('[data-tx-drawer-void]')?.dataset['txDrawerVoid']

      if (editId) {
        const tx = state.transactions.find(t => t.id === editId)
        if (tx) { openModal(); fillForm(tx) }
        container.querySelector<HTMLElement>('#txDrawer')!.style.display = 'none'
      }
      if (voidId && confirm('Void this transaction?')) {
        try {
          await voidTransaction(voidId)
          container.querySelector<HTMLElement>('#txDrawer')!.style.display = 'none'
          await loadData()
        } catch (err: any) {
          alert(err?.message ?? 'Failed.')
        }
      }
    })

    // Bulk clear
    container.querySelector('#finBulkClear')?.addEventListener('click', () => {
      state.selectedIds.clear()
      container.querySelectorAll<HTMLInputElement>('.fin-row-chk').forEach(c => c.checked = false)
      syncSelectAll()
      updateBulkBar()
    })

    // Export
    container.querySelector('#txExportBtn')?.addEventListener('click', async () => {
      const { exportFinanceReport } = await import('../repository')
      const csv  = await exportFinanceReport('annual', new Date().getFullYear())
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `finance-transactions-${new Date().getFullYear()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })

    // Keyboard: Escape closes modals/drawers
    document.addEventListener('keydown', handleKeydown)
  }

  function fillForm(tx: FinanceTransaction): void {
    const s = (id: string, v: string) => {
      const el = container.querySelector<HTMLInputElement>(`#${id}`)
      if (el) el.value = v
    }
    s('txFType',     tx.transaction_type)
    s('txFCategory', tx.category_id)
    s('txFAmount',   String(tx.amount))
    s('txFMethod',   tx.payment_method)
    s('txFDate',     tx.transaction_date)
    s('txFRef',      tx.reference_number ?? '')
    s('txFDesc',     tx.description ?? '')
    s('txFEditId',   tx.id)
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return
    const modal  = container?.querySelector<HTMLElement>('#txModal')
    const drawer = container?.querySelector<HTMLElement>('#txDrawer')
    if (modal?.style.display  !== 'none') closeModal()
    if (drawer?.style.display !== 'none') {
      if (drawer) drawer.style.display = 'none'
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setEl(id: string, val: string): void {
    const el = container.querySelector<HTMLElement>(`#${id}`)
    if (el) el.textContent = val
  }

  function showError(err: unknown): void {
    const tbody = container.querySelector<HTMLElement>('#txBody')
    if (tbody) {
      tbody.innerHTML = `
      <tr><td colspan="9" style="padding:40px;text-align:center;">
        <div style="color:#fb7185;font-size:13px;">
          ${(err as any)?.message ?? 'Failed to load transactions.'}
        </div>
      </td></tr>`
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function destroy(): void {
    document.removeEventListener('keydown', handleKeydown)
  }

  return { render, destroy }
}