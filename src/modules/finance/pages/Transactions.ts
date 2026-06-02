// src/modules/finance/pages/Transactions.ts
// Transaction ledger listing page.
import type { PageModule } from '../../../types/module.types'
import type { FinanceTransaction, FinanceTransactionType, FinancePaymentMethod } from '../../../types/finance.types'
import { listTransactions, softDeleteTransaction } from '../repository'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'

const TYPE_LABELS: Record<FinanceTransactionType, string> = {
  tithe:            'Tithe',
  offering:         'Offering',
  special_offering: 'Special Offering',
  pledge_payment:   'Pledge Payment',
  donation:         'Donation',
  expense:          'Expense',
}

const METHOD_LABELS: Record<FinancePaymentMethod, string> = {
  cash:          'Cash',
  momo:          'MoMo',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  other:         'Other',
}

const fmt = (n: number) => `GHS ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

let _txs: FinanceTransaction[] = []

function renderRows() {
  if (_txs.length === 0) return `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--mm-text-secondary);">No transactions yet. <a href="#/finance/transactions/new">+ Add one</a></td></tr>`
  return _txs.map(t => `
<tr>
  <td style="padding:10px 12px;">${t.transaction_date}</td>
  <td style="padding:10px 12px;">${t.category_name ?? '—'}</td>
  <td style="padding:10px 12px;">${TYPE_LABELS[t.transaction_type] ?? t.transaction_type}</td>
  <td style="padding:10px 12px;">${METHOD_LABELS[t.payment_method] ?? t.payment_method}</td>
  <td style="padding:10px 12px;font-weight:700;color:${t.category_type === 'expense' ? '#b91c1c' : '#1a7f37'};">
    ${t.category_type === 'expense' ? '-' : '+'}${fmt(Number(t.amount))}
  </td>
  <td style="padding:10px 12px;">
    <button class="mm-btn-icon" data-del-tx="${t.id}" title="Delete"
      style="color:#b91c1c;border-color:#fecaca;">
      <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
    </button>
  </td>
</tr>`).join('')
}

const Transactions: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1200px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:var(--text-2xl);font-weight:700;">Transactions</h2>
      <div id="tx-subtitle" style="color:var(--mm-text-secondary);">Loading…</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" onclick="location.hash='#/finance/transactions/new'">+ New Transaction</button>
      <button class="mm-btn-outline" onclick="location.hash='#/finance'">← Back</button>
    </div>
  </div>
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <thead style="background:var(--mm-bg-secondary,rgba(0,0,0,.03));">
        <tr>
          <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Date</th>
          <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Category</th>
          <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Type</th>
          <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Method</th>
          <th style="padding:10px 12px;text-align:left;font-size:var(--text-sm);color:var(--mm-text-secondary);">Amount</th>
          <th style="padding:10px 12px;"></th>
        </tr>
      </thead>
      <tbody id="tx-tbody"><tr><td colspan="6" style="padding:40px;text-align:center;color:var(--mm-text-secondary);">Loading…</td></tr></tbody>
    </table>
  </div>
</div>`

    try {
      _txs = await listTransactions()
      const tbody = container.querySelector<HTMLElement>('#tx-tbody')!
      tbody.innerHTML = renderRows()
      const sub = container.querySelector<HTMLElement>('#tx-subtitle')
      if (sub) sub.textContent = `${_txs.length} record${_txs.length !== 1 ? 's' : ''}`

      tbody.querySelectorAll<HTMLElement>('[data-del-tx]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['delTx']!
          if (!confirm('Delete this transaction?')) return
          try {
            await softDeleteTransaction(id)
            _txs = _txs.filter(t => t.id !== id)
            tbody.innerHTML = renderRows()
            Toast.success('Transaction deleted.')
          } catch (err: any) {
            Toast.error(err.message)
          }
        })
      })
    } catch (err: any) {
      container.querySelector<HTMLElement>('#tx-tbody')!.innerHTML =
        `<tr><td colspan="6" style="padding:20px;color:#b91c1c;">${err.message}</td></tr>`
    }
  },
  destroy() { _txs = [] },
}

export default Transactions
