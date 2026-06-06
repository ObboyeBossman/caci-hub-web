// src/modules/finance/tabs/PledgesTab.ts

import {
  listPledges,
  getPledgeStats,
  createPledge,
  updatePledge,
  recordPledgePayment,
  listCategories,
} from '../repository'
import {
  fmtCurrency, fmtDate, fmtDateShort,
  EmptyState, renderStatCards,
  PaginationControls, PledgeProgressBar, Modal,
} from '../widgets/index'
import type {
  FinancePledge, PledgeStats, FinanceCategoryRow,
  CreatePledgePayload,
} from '../finance.types'

const PER_PAGE = 9

export function createPledgesTab() {
  let container: HTMLElement
  let pledges:    FinancePledge[]     = []
  let categories: FinanceCategoryRow[] = []
  let stats:      PledgeStats          = { totalPledged:0, amountPaid:0, outstanding:0, overdueCount:0 }
  let activeFilter = 'all'
  let sortVal      = 'date_desc'
  let searchQ      = ''
  let page         = 1

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
    <div id="plStats">
      ${renderStatCards([
        { icon: 'handshake',    label: 'Total Pledged',    value: 'GH₵ 0', iconBg: 'rgba(139,92,246,.12)',  iconColor: '#a78bfa', id: 'plStatTotal' },
        { icon: 'cash-stack',   label: 'Amount Paid',      value: 'GH₵ 0', iconBg: 'rgba(34,197,94,.12)',   iconColor: '#22c55e', id: 'plStatPaid',
          barColor: 'linear-gradient(90deg,#22c55e,#56d364)', barValue: 0 },
        { icon: 'hourglass-split', label: 'Outstanding',   value: 'GH₵ 0', iconBg: 'rgba(88,166,255,.1)',   iconColor: '#58a6ff', id: 'plStatOut' },
        { icon: 'exclamation-triangle', label: 'Overdue',  value: '0',     iconBg: 'rgba(244,63,94,.1)',    iconColor: '#f43f5e', id: 'plStatOver' },
      ])}
    </div>

    <!-- Toolbar -->
    <div class="fin-toolbar animate-fade-up" style="animation-delay:200ms;">
      <div class="fin-search-wrap">
        <span class="bi bi-search"></span>
        <input class="fin-search-input" id="plSearch" type="text"
          placeholder="Search pledges…" aria-label="Search pledges">
      </div>
      <div class="fin-toolbar-actions">
        <div class="fin-sort-wrap">
          <span class="bi bi-arrow-down-up"></span>
          <select class="fin-sort-select" id="plSort" aria-label="Sort pledges">
            <option value="date_desc">Pledged (Newest)</option>
            <option value="date_asc">Pledged (Oldest)</option>
            <option value="total_desc">Total (High–Low)</option>
            <option value="total_asc">Total (Low–High)</option>
            <option value="pct_desc">Progress (High–Low)</option>
            <option value="pct_asc">Progress (Low–High)</option>
          </select>
        </div>
        <button class="fin-tbtn" id="plExport">
          <span class="bi bi-download"></span>
          <span class="fin-btn-label">Export</span>
        </button>
        <button class="fin-tbtn fin-tbtn-primary" id="plNewBtn">
          <span class="bi bi-plus-lg"></span>
          <span class="fin-btn-label">New Pledge</span>
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="fin-filter-row animate-fade-in" style="animation-delay:240ms;" id="plFilterRow">
      ${buildFilterChips()}
      <span class="fin-page-info" style="margin-left:auto;" id="plCountLabel"></span>
    </div>

    <!-- Pledge grid -->
    <div id="plGrid" class="fin-pledge-grid animate-fade-up" style="animation-delay:280ms;"></div>

    <!-- Pagination -->
    <div id="plPagination"></div>

    <!-- New pledge modal -->
    ${Modal('plModal', 'New Pledge', buildPledgeForm(), `
      <button class="fin-tbtn" data-modal-close="plModal">Cancel</button>
      <button class="fin-tbtn fin-tbtn-primary" id="plModalSave">Create Pledge</button>
    `)}

    <!-- Record payment modal -->
    ${Modal('plPayModal', 'Record Payment', buildPaymentForm(), `
      <button class="fin-tbtn" data-modal-close="plPayModal">Cancel</button>
      <button class="fin-tbtn fin-tbtn-primary" id="plPaySave">Record Payment</button>
    `)}
    `
  }

  function buildFilterChips(): string {
    const chips = [
      { key: 'all',       label: 'All',       icon: 'filter' },
      { key: 'active',    label: 'Active',    icon: 'check-circle' },
      { key: 'completed', label: 'Completed', icon: 'patch-check' },
      { key: 'defaulted', label: 'Defaulted', icon: 'exclamation-triangle' },
      { key: 'cancelled', label: 'Cancelled', icon: 'x-circle' },
    ]
    return chips.map(c => `
    <button class="fin-filter-chip ${c.key === activeFilter ? 'active-' + c.key : ''}"
      data-plfilter="${c.key}" aria-pressed="${c.key === activeFilter}">
      <span class="bi bi-${c.icon}" style="font-size:12px;"></span>
      ${c.label}
    </button>`).join('')
  }

  function buildPledgeForm(): string {
    return `
    <div id="plFormError" style="display:none;"></div>
    <div class="fin-form-group">
      <label class="fin-label" for="plFName">Pledge Name *</label>
      <input class="fin-input" id="plFName" type="text" placeholder="e.g. Building Fund" required>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="plFTotal">Total Amount (GHS) *</label>
        <input class="fin-input" id="plFTotal" type="number" min="0.01" step="0.01" placeholder="0.00" required>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="plFCurrency">Currency</label>
        <select class="fin-select" id="plFCurrency">
          <option value="GHS">GHS — Ghana Cedi</option>
          <option value="USD">USD — US Dollar</option>
        </select>
      </div>
    </div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="plFStart">Start Date</label>
        <input class="fin-input" id="plFStart" type="date">
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="plFEnd">End Date</label>
        <input class="fin-input" id="plFEnd" type="date">
      </div>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="plFNotes">Notes</label>
      <textarea class="fin-textarea" id="plFNotes" placeholder="Optional notes…"></textarea>
    </div>
    <input type="hidden" id="plFMemberId">
    <input type="hidden" id="plFEditId">
    `
  }

  function buildPaymentForm(): string {
    return `
    <div id="plPayError" style="display:none;"></div>
    <div id="plPaySummary" style="
      background:rgba(139,92,246,.08); border:1px solid rgba(139,92,246,.2);
      border-radius:10px; padding:12px 14px; margin-bottom:16px; font-size:13px; color:#c9d1d9;
    "></div>
    <div class="fin-form-row">
      <div class="fin-form-group">
        <label class="fin-label" for="plPayAmount">Amount (GHS) *</label>
        <input class="fin-input" id="plPayAmount" type="number" min="0.01" step="0.01" placeholder="0.00" required>
      </div>
      <div class="fin-form-group">
        <label class="fin-label" for="plPayMethod">Payment Method *</label>
        <select class="fin-select" id="plPayMethod" required>
          <option value="">Select…</option>
          <option value="cash">Cash</option>
          <option value="momo">Mobile Money</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="plPayCat">Income Category *</label>
      <select class="fin-select" id="plPayCat" required>
        <option value="">Select category…</option>
      </select>
    </div>
    <div class="fin-form-group">
      <label class="fin-label" for="plPayRef">Reference Number</label>
      <input class="fin-input" id="plPayRef" type="text" placeholder="Optional">
    </div>
    <input type="hidden" id="plPayPledgeId">
    `
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async function loadData(): Promise<void> {
    try {
      const [pl, ps, cats] = await Promise.all([
        listPledges(),
        getPledgeStats(),
        listCategories(),
      ])
      pledges    = pl
      stats      = ps
      categories = cats
      updateStats()
      updateView()
      populatePayCatSelect()
    } catch (err: any) {
      container.querySelector<HTMLElement>('#plGrid')!.innerHTML =
        `<div class="fin-empty-state">
          <span class="bi bi-exclamation-circle" style="font-size:2rem;color:#fb7185;"></span>
          <p class="fin-empty-title">${err?.message ?? 'Failed to load pledges.'}</p>
        </div>`
    }
  }

  function populatePayCatSelect(): void {
    const sel = container.querySelector<HTMLSelectElement>('#plPayCat')!
    const incCats = categories.filter(c => c.category_type === 'income')
    sel.innerHTML = `<option value="">Select category…</option>` +
      incCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  function updateStats(): void {
    setEl('plStatTotal', fmtCurrency(stats.totalPledged))
    setEl('plStatPaid',  fmtCurrency(stats.amountPaid))
    setEl('plStatOut',   fmtCurrency(stats.outstanding))
    setEl('plStatOver',  String(stats.overdueCount))

    const paidPct = stats.totalPledged > 0
      ? Math.round((stats.amountPaid / stats.totalPledged) * 100)
      : 0
    const barEl = container.querySelector<HTMLElement>('.fin-stat-bar-fill')
    if (barEl) {
      setTimeout(() => { barEl.style.width = `${paidPct}%` }, 400)
    }
  }

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  function getFiltered(): FinancePledge[] {
    const q = searchQ.toLowerCase()
    const today = new Date().toISOString().split('T')[0]

    let list = pledges.filter(p => {
      if (activeFilter !== 'all' && p.status !== activeFilter) return false
      if (!q) return true
      return (
        p.pledge_name.toLowerCase().includes(q) ||
        (p.member_name ?? '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })

    list.sort((a, b) => {
      if (sortVal === 'date_desc')  return b.start_date.localeCompare(a.start_date)
      if (sortVal === 'date_asc')   return a.start_date.localeCompare(b.start_date)
      if (sortVal === 'total_desc') return b.total_amount - a.total_amount
      if (sortVal === 'total_asc')  return a.total_amount - b.total_amount
      if (sortVal === 'pct_desc')   return (b.fulfilment_pct ?? 0) - (a.fulfilment_pct ?? 0)
      if (sortVal === 'pct_asc')    return (a.fulfilment_pct ?? 0) - (b.fulfilment_pct ?? 0)
      return 0
    })

    return list
  }

  // ── View ──────────────────────────────────────────────────────────────────

  function updateView(): void {
    const filtered   = getFiltered()
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
    if (page > totalPages) page = totalPages
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

    setEl('plCountLabel', `${filtered.length} of ${pledges.length}`)

    renderCards(paged)
    renderPagination(totalPages)
  }

  // ── Card rendering ────────────────────────────────────────────────────────

  function renderCards(list: FinancePledge[]): void {
    const grid = container.querySelector<HTMLElement>('#plGrid')!
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; display: flex; justify-content: center; width: 100%;">${EmptyState('handshake', 'No pledges found', 'Try adjusting your filters')}</div>`
      return
    }
    grid.innerHTML = list.map((p, i) => buildCard(p, i)).join('')
  }

  function buildCard(p: FinancePledge, i: number): string {
    const pct      = p.fulfilment_pct ?? 0
    const remaining = p.total_amount - p.amount_paid
    const canPay   = p.status === 'active' || p.status === 'defaulted'
    const statusColors: Record<string, { bg: string; color: string }> = {
      active:    { bg: 'rgba(34,197,94,.12)',  color: '#56d364' },
      completed: { bg: 'rgba(88,166,255,.1)',  color: '#58a6ff' },
      defaulted: { bg: 'rgba(244,63,94,.1)',   color: '#fb7185' },
      cancelled: { bg: 'rgba(139,148,158,.1)', color: '#8b949e' },
    }
    const sc       = statusColors[p.status] ?? statusColors.active
    const ringColor = p.status === 'defaulted' ? '#f43f5e' : '#22c55e'
    const ringDark  = p.status === 'defaulted' ? '#7b1d2e' : '#166534'
    const deg       = Math.round(pct * 3.6)

    return `
    <div
      class="fin-pledge-card animate-fade-up ${p.status === 'defaulted' ? 'overdue' : ''}"
      style="animation-delay:${i * 60}ms;"
      onmousemove="(function(e,el){const r=el.getBoundingClientRect();el.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');el.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');})(event,this)"
      onmouseleave="this.style.setProperty('--mx','50%');this.style.setProperty('--my','50%')"
    >
      <!-- Header: name + status -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:14px;">
        <div>
          <div style="font-size:13.5px;font-weight:700;color:#e6edf3;line-height:1.3;">${p.pledge_name}</div>
          <div style="font-size:10px;font-family:monospace;color:#484f58;margin-top:2px;">${p.id.slice(0,12)}…</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
            background:${sc.bg};color:${sc.color};
            border:1px solid ${sc.color}40;
          ">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
          <button class="fin-icon-btn fin-pl-menu" data-pledge-id="${p.id}"
            title="More options" aria-label="More options" style="width:30px;height:30px;">
            <span class="bi bi-three-dots-vertical" style="font-size:14px;"></span>
          </button>
        </div>
      </div>

      <!-- Member row with ring avatar -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="
          padding:2px;border-radius:50%;flex-shrink:0;
          background:conic-gradient(${ringColor} 0deg ${deg}deg, ${ringDark} ${deg}deg 360deg);
        ">
          <div style="
            width:38px;height:38px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:13px;font-weight:700;
            border:2.5px solid #0d1117;
            background:#1e3a5f;color:#93c5fd;
          ">
            ${(p.member_name ?? '?').split(' ').map(w => w[0]).slice(0,2).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:13px;font-weight:500;color:#e6edf3;">${p.member_name ?? 'Unknown'}</div>
          <div style="font-size:11px;color:#8b949e;">
            ${fmtDateShort(p.start_date)} → ${p.end_date ? fmtDateShort(p.end_date) : 'Open'}
          </div>
        </div>
      </div>

      <!-- Amounts -->
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Paid</div>
          <div style="font-size:20px;font-weight:800;color:${p.status === 'completed' ? '#58a6ff' : '#34d399'};font-variant-numeric:tabular-nums;">
            ${fmtCurrency(p.amount_paid)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Total</div>
          <div style="font-size:14px;font-weight:600;color:#8b949e;font-variant-numeric:tabular-nums;">
            ${fmtCurrency(p.total_amount)}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      ${PledgeProgressBar(pct, p.status, 0.3 + i * 0.04)}
      <div style="display:flex;justify-content:space-between;margin-top:4px;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:600;color:${sc.color};">${pct}% fulfilled</span>
        <span style="font-size:11px;color:#484f58;">
          ${p.status !== 'completed' ? `${fmtCurrency(remaining)} remaining` : 'Fully paid'}
        </span>
      </div>

      ${p.notes ? `
      <div style="
        font-size:11px;color:#484f58;font-style:italic;
        padding:8px 10px;background:#0d1117;border-radius:7px;
        margin-bottom:12px;line-height:1.5;
        overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
      ">${p.notes}</div>` : ''}

      <!-- Actions -->
      <div style="display:flex;gap:8px;padding-top:14px;border-top:1px solid #21262d;">
        <button class="fin-tbtn" style="flex:1;height:38px;font-size:12px;" data-pl-view="${p.id}">
          View
        </button>
        <button
          class="fin-tbtn ${canPay ? '' : 'fin-tbtn-disabled'}"
          style="flex:1;height:38px;font-size:12px;${canPay ? '' : 'opacity:.35;pointer-events:none;'}"
          data-pl-pay="${p.id}"
        >
          <span class="bi bi-cash-coin" style="font-size:13px;"></span>
          ${p.status === 'completed' ? 'Paid' : 'Record Payment'}
        </button>
      </div>
    </div>`
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  function renderPagination(totalPages: number): void {
    const el = container.querySelector<HTMLElement>('#plPagination')!
    el.innerHTML = PaginationControls(page, totalPages, 'plpage')
    el.querySelectorAll('[data-plpage]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number((btn as HTMLElement).dataset['plpage'])
        if (p < 1 || p > totalPages || p === page) return
        page = p
        updateView()
        container.scrollIntoView({ behavior: 'smooth' })
      })
    })
  }

  // ── Modals ────────────────────────────────────────────────────────────────

  function openPledgeModal(): void {
    const m = container.querySelector<HTMLElement>('#plModal')!
    m.style.display = 'flex'
    const startInput = container.querySelector<HTMLInputElement>('#plFStart')
    if (startInput && !startInput.value) {
      startInput.value = new Date().toISOString().split('T')[0]
    }
  }

  function openPayModal(pledgeId: string): void {
    const pledge = pledges.find(p => p.id === pledgeId)
    if (!pledge) return
    const remaining = pledge.total_amount - pledge.amount_paid
    const summaryEl = container.querySelector<HTMLElement>('#plPaySummary')!
    summaryEl.innerHTML = `
      <strong>${pledge.pledge_name}</strong> — ${pledge.member_name ?? 'Unknown'}<br>
      <span style="color:#a78bfa;">Remaining: ${fmtCurrency(remaining)}</span>
    `
    const amtInput = container.querySelector<HTMLInputElement>('#plPayAmount')
    if (amtInput) amtInput.max = String(remaining)
    container.querySelector<HTMLInputElement>('#plPayPledgeId')!.value = pledgeId
    container.querySelector<HTMLElement>('#plPayModal')!.style.display = 'flex'
  }

  async function savePledge(): Promise<void> {
    const name    = container.querySelector<HTMLInputElement>('#plFName')?.value ?? ''
    const total   = parseFloat(container.querySelector<HTMLInputElement>('#plFTotal')?.value ?? '0')
    const currency = container.querySelector<HTMLSelectElement>('#plFCurrency')?.value ?? 'GHS'
    const start   = container.querySelector<HTMLInputElement>('#plFStart')?.value || undefined
    const end     = container.querySelector<HTMLInputElement>('#plFEnd')?.value   || null
    const notes   = container.querySelector<HTMLTextAreaElement>('#plFNotes')?.value || null
    const editId  = container.querySelector<HTMLInputElement>('#plFEditId')?.value || null
    const memberId = container.querySelector<HTMLInputElement>('#plFMemberId')?.value || ''

    if (!name || !total) {
      showModalError('plFormError', 'Please fill in all required fields.')
      return
    }

    const btn = container.querySelector<HTMLButtonElement>('#plModalSave')!
    btn.disabled = true; btn.textContent = 'Saving…'

    try {
      const payload: CreatePledgePayload = {
        member_id:  memberId || 'PLACEHOLDER', // swap for member picker
        pledge_name: name,
        total_amount: total,
        currency,
        start_date: start,
        end_date:   end,
        notes,
      }
      if (editId) {
        await updatePledge(editId, payload)
      } else {
        await createPledge(payload)
      }
      container.querySelector<HTMLElement>('#plModal')!.style.display = 'none'
      clearPledgeForm()
      await loadData()
    } catch (err: any) {
      showModalError('plFormError', err?.message ?? 'Failed to save pledge.')
    } finally {
      btn.disabled = false; btn.textContent = 'Create Pledge'
    }
  }

  async function savePayment(): Promise<void> {
    const pledgeId  = container.querySelector<HTMLInputElement>('#plPayPledgeId')?.value ?? ''
    const amount    = parseFloat(container.querySelector<HTMLInputElement>('#plPayAmount')?.value ?? '0')
    const method    = container.querySelector<HTMLSelectElement>('#plPayMethod')?.value as any
    const catId     = container.querySelector<HTMLSelectElement>('#plPayCat')?.value ?? ''
    const ref       = container.querySelector<HTMLInputElement>('#plPayRef')?.value || null

    if (!pledgeId || !amount || !method || !catId) {
      showModalError('plPayError', 'Please fill in all required fields.')
      return
    }

    const btn = container.querySelector<HTMLButtonElement>('#plPaySave')!
    btn.disabled = true; btn.textContent = 'Saving…'

    try {
      await recordPledgePayment(pledgeId, amount, method, catId, ref)
      container.querySelector<HTMLElement>('#plPayModal')!.style.display = 'none'
      clearPaymentForm()
      await loadData()
    } catch (err: any) {
      showModalError('plPayError', err?.message ?? 'Failed to record payment.')
    } finally {
      btn.disabled = false; btn.textContent = 'Record Payment'
    }
  }

  function showModalError(elId: string, msg: string): void {
    const el = container.querySelector<HTMLElement>(`#${elId}`)
    if (!el) return
    el.textContent = msg
    el.style.cssText = `
      display:block; padding:10px 14px; border-radius:8px; font-size:13px;
      background:rgba(244,63,94,.1); border:1px solid rgba(244,63,94,.3); color:#fb7185; margin-bottom:12px;
    `
  }

  function clearPledgeForm(): void {
    ;['plFName','plFTotal','plFStart','plFEnd','plFNotes','plFEditId','plFMemberId'].forEach(id => {
      const el = container.querySelector<HTMLInputElement>(`#${id}`)
      if (el) el.value = ''
    })
    const err = container.querySelector<HTMLElement>('#plFormError')
    if (err) err.style.display = 'none'
  }

  function clearPaymentForm(): void {
    ;['plPayAmount','plPayMethod','plPayRef','plPayPledgeId'].forEach(id => {
      const el = container.querySelector<HTMLInputElement>(`#${id}`)
      if (el) el.value = ''
    })
    const err = container.querySelector<HTMLElement>('#plPayError')
    if (err) err.style.display = 'none'
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function attachListeners(): void {
    container.querySelector('#plSearch')?.addEventListener('input', (e) => {
      searchQ = (e.target as HTMLInputElement).value
      page    = 1
      updateView()
    })

    container.querySelector('#plSort')?.addEventListener('change', (e) => {
      sortVal = (e.target as HTMLSelectElement).value
      page    = 1
      updateView()
    })

    container.querySelector('#plFilterRow')?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-plfilter]')
      if (!chip) return
      activeFilter = chip.dataset['plfilter'] ?? 'all'
      page         = 1
      container.querySelectorAll<HTMLElement>('[data-plfilter]').forEach(c => {
        c.className = 'fin-filter-chip'
        if (c.dataset['plfilter'] === activeFilter) c.classList.add(`active-${activeFilter}`)
        c.setAttribute('aria-pressed', String(c.dataset['plfilter'] === activeFilter))
      })
      updateView()
    })

    container.querySelector('#plNewBtn')?.addEventListener('click', () => openPledgeModal())
    container.querySelector('#plModalSave')?.addEventListener('click', () => savePledge())
    container.querySelector('#plPaySave')?.addEventListener('click', () => savePayment())

    // Pledge card actions (delegated)
    container.querySelector('#plGrid')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const payBtn = target.closest<HTMLElement>('[data-pl-pay]')
      if (payBtn) {
        openPayModal(payBtn.dataset['plPay']!)
        return
      }
    })

    // Modal close (delegated)
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const closeAttr = target.closest<HTMLElement>('[data-modal-close]')?.dataset['modalClose']
      if (closeAttr === 'plModal')    { container.querySelector<HTMLElement>('#plModal')!.style.display    = 'none'; clearPledgeForm() }
      if (closeAttr === 'plPayModal') { container.querySelector<HTMLElement>('#plPayModal')!.style.display = 'none'; clearPaymentForm() }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      container.querySelector<HTMLElement>('#plModal')!.style.display    = 'none'
      container.querySelector<HTMLElement>('#plPayModal')!.style.display = 'none'
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setEl(id: string, val: string): void {
    const el = container.querySelector<HTMLElement>(`#${id}`)
    if (el) el.textContent = val
  }

  return { render, destroy: () => {} }
}