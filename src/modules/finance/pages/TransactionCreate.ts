// src/modules/finance/pages/TransactionCreate.ts
// Create a new finance transaction.
import type { PageModule } from '../../../types/module.types'
import type { FinanceCategoryRow, FinanceTransactionType, FinancePaymentMethod } from '../../../types/finance.types'
import { createTransaction, listCategories } from '../repository'
import { Toast } from '@shared/components/Toast'

const TRANSACTION_TYPES: { value: FinanceTransactionType; label: string }[] = [
  { value: 'tithe',            label: 'Tithe' },
  { value: 'offering',         label: 'Offering' },
  { value: 'special_offering', label: 'Special Offering' },
  { value: 'pledge_payment',   label: 'Pledge Payment' },
  { value: 'donation',         label: 'Donation' },
  { value: 'expense',          label: 'Expense' },
]

const PAYMENT_METHODS: { value: FinancePaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'momo',          label: 'Mobile Money (MoMo)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
]

const TransactionCreate: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:640px;margin:0 auto;">
  <button style="display:inline-flex;align-items:center;gap:6px;color:var(--mm-text-secondary);font-size:var(--text-base);border:none;background:none;cursor:pointer;margin-bottom:20px;font-family:inherit;"
    onclick="location.hash='#/finance/transactions'">← Back to Transactions</button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 22px;font-size:var(--text-2xl);font-weight:700;">New Transaction</h2>

    <div class="mm-form-group">
      <label class="mm-form-label">Category *</label>
      <select class="mm-form-select" id="tc-category"><option value="">Loading categories…</option></select>
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Transaction Type *</label>
      <select class="mm-form-select" id="tc-type">
        ${TRANSACTION_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Amount (GHS) *</label>
      <input class="mm-form-input" id="tc-amount" type="number" min="0.01" step="0.01" placeholder="0.00">
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Payment Method *</label>
      <select class="mm-form-select" id="tc-method">
        ${PAYMENT_METHODS.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
      </select>
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Date *</label>
      <input class="mm-form-input" id="tc-date" type="date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Reference No.</label>
      <input class="mm-form-input" id="tc-ref" placeholder="MoMo ref, cheque no, etc.">
    </div>
    <div class="mm-form-group">
      <label class="mm-form-label">Description</label>
      <textarea class="mm-form-textarea" id="tc-desc" rows="2" placeholder="Optional note"></textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="tc-save" style="flex:1;">Record Transaction</button>
      <button class="mm-btn-outline" onclick="location.hash='#/finance/transactions'">Cancel</button>
    </div>
  </div>
</div>`

    // Load categories into select
    try {
      const cats: FinanceCategoryRow[] = await listCategories()
      const catSel = container.querySelector<HTMLSelectElement>('#tc-category')!
      if (cats.length === 0) {
        catSel.innerHTML = '<option value="">No categories — add some first</option>'
      } else {
        catSel.innerHTML = '<option value="">Select a category</option>' +
          cats.map(c => `<option value="${c.id}">${c.name} (${c.category_type})</option>`).join('')
      }
    } catch { /* silent */ }

    const saveBtn = container.querySelector<HTMLButtonElement>('#tc-save')!
    saveBtn.addEventListener('click', async () => {
      const categoryId = (container.querySelector<HTMLSelectElement>('#tc-category')!).value
      const type       = (container.querySelector<HTMLSelectElement>('#tc-type')!).value as FinanceTransactionType
      const amount     = parseFloat((container.querySelector<HTMLInputElement>('#tc-amount')!).value)
      const method     = (container.querySelector<HTMLSelectElement>('#tc-method')!).value as FinancePaymentMethod
      const date       = (container.querySelector<HTMLInputElement>('#tc-date')!).value
      const ref        = (container.querySelector<HTMLInputElement>('#tc-ref')!).value.trim() || null
      const desc       = (container.querySelector<HTMLTextAreaElement>('#tc-desc')!).value.trim() || null

      if (!categoryId || !type || isNaN(amount) || amount <= 0 || !method || !date) {
        Toast.error('Please fill in all required fields.')
        return
      }
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…'
      try {
        await createTransaction({ category_id: categoryId, transaction_type: type, amount, payment_method: method, transaction_date: date, reference_number: ref, description: desc })
        Toast.success('Transaction recorded.')
        location.hash = '#/finance/transactions'
      } catch (err: any) {
        Toast.error(err.message ?? 'Failed to record transaction.')
        saveBtn.disabled = false; saveBtn.textContent = 'Record Transaction'
      }
    })
  },
  destroy() {},
}

export default TransactionCreate
