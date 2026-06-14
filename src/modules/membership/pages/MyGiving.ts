// src/modules/membership/pages/MyGiving.ts
// Member's personal giving history — contributions, tithes, and pledges.
// Route: /my-giving  (auth only, no permission required)

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { renderSkeleton, renderError, renderEmpty } from '@shared/utils/pageHelpers'

// ── Listener cleanup ──────────────────────────────────────────────────────────
const _listeners: [EventTarget, string, EventListener][] = []
function _on<K extends keyof HTMLElementEventMap>(el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}
function _cleanup(): void {
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners.length = 0
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_ID = 'mygiving-css'
const CSS = /* css */`
.mg-wrap {
  padding: 20px 0 64px;
  display: flex; flex-direction: column; gap: 20px;
  animation: mg-fade 0.3s ease both;
}
@keyframes mg-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Summary cards ───────────────────────────────────────────────────────── */
.mg-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.mg-stat-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 14px; padding: 16px 18px;
  display: flex; flex-direction: column; gap: 6px;
  transition: box-shadow 0.18s;
}
.mg-stat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.07); }
.mg-stat-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
.mg-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); line-height: 1.1; font-family: var(--font-mono); }
.mg-stat-sub   { font-size: 11.5px; color: var(--text-muted); }

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.mg-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mg-search-wrap { position: relative; flex: 1; min-width: 180px; }
.mg-search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; pointer-events: none; }
.mg-search {
  width: 100%; padding: 8px 12px 8px 34px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 10px; font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); outline: none; transition: border-color 0.15s;
  box-sizing: border-box;
}
.mg-search:focus { border-color: var(--caci-blue); }
.mg-select {
  padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 10px; font-size: 12.5px; color: var(--text-primary);
  font-family: var(--font-sans); outline: none; cursor: pointer;
}
.mg-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* ── Table / list ────────────────────────────────────────────────────────── */
.mg-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 14px; overflow: hidden;
}
.mg-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.015);
}
[data-theme="dark"] .mg-card-head { background: rgba(255,255,255,0.015); }
.mg-card-title { font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin: 0; }

.mg-table { width: 100%; border-collapse: collapse; }
.mg-table th {
  padding: 10px 18px; text-align: left;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-muted); border-bottom: 1px solid var(--border-default);
  white-space: nowrap;
}
.mg-table td { padding: 13px 18px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border-default); }
.mg-table tr:last-child td { border-bottom: none; }
.mg-table tr:hover td { background: var(--bg-hover); }

.mg-amount   { font-weight: 700; color: var(--caci-success); font-family: var(--font-mono); white-space: nowrap; }
.mg-type-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 600;
}
.mg-pm-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11.5px; color: var(--text-muted);
}
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function _fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function _fmtAmt(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function _typeStyle(type: string): string {
  const map: Record<string, string> = {
    income:   'background:rgba(34,197,94,0.1);color:#22c55e;',
    expense:  'background:rgba(239,68,68,0.1);color:#ef4444;',
    tithe:    'background:rgba(245,158,11,0.1);color:#f59e0b;',
    offering: 'background:rgba(139,92,246,0.1);color:#8b5cf6;',
    pledge:   'background:rgba(59,130,246,0.1);color:#3b82f6;',
  }
  return map[type] ?? 'background:var(--bg-page);color:var(--text-muted);'
}
function _pmIcon(pm: string): string {
  if (pm === 'mobile_money') return 'bi-phone'
  if (pm === 'cash')         return 'bi-cash'
  if (pm === 'bank_transfer')return 'bi-bank'
  if (pm === 'cheque')       return 'bi-receipt'
  if (pm === 'card')         return 'bi-credit-card-2-front'
  return 'bi-dash-circle'
}
function _pmLabel(pm: string): string {
  return pm.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function _renderRow(t: any): string {
  return `
    <tr>
      <td>${_fmtDate(t.transaction_date)}</td>
      <td>
        <div style="font-weight:600;font-size:13.5px;">${t.category_name ?? 'General'}</div>
        ${t.description ? `<div style="font-size:11.5px;color:var(--text-muted);">${t.description}</div>` : ''}
      </td>
      <td>
        <span class="mg-type-chip" style="${_typeStyle(t.transaction_type)}">
          ${t.transaction_type.charAt(0).toUpperCase() + t.transaction_type.slice(1)}
        </span>
      </td>
      <td>
        <span class="mg-pm-chip">
          <i class="bi ${_pmIcon(t.payment_method)}"></i> ${_pmLabel(t.payment_method)}
        </span>
      </td>
      <td class="mg-amount">${_fmtAmt(t.amount, t.currency)}</td>
    </tr>
  `
}

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS
      document.head.appendChild(s)
    }

    renderSkeleton(container, 'table')

    try {
      const user = getCurrentUser()
      if (!user) return

      const { data: m, error: mErr } = await supabase
        .from('members_view')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (mErr) throw mErr
      if (!m) {
        return renderEmpty(container, {
          icon: 'person-exclamation',
          title: 'No member record',
          message: 'Your account is not linked to a member profile yet.',
        })
      }

      const { data: raw, error: txErr } = await supabase
        .from('finance_transactions')
        .select('id, amount, currency, transaction_date, transaction_type, payment_method, description, category:finance_categories(name)')
        .eq('member_id', m.id!)
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
      if (txErr) throw txErr

      const all: any[] = (raw ?? []).map((t: any) => ({
        ...t,
        category_name: t.category?.name ?? null,
      }))

      // Compute stats
      const total     = all.reduce((s, t) => s + Number(t.amount), 0)
      const thisYear  = all.filter(t => new Date(t.transaction_date).getFullYear() === new Date().getFullYear())
      const yearTotal = thisYear.reduce((s, t) => s + Number(t.amount), 0)
      const currency  = all[0]?.currency ?? 'GHS'

      if (all.length === 0) {
        return renderEmpty(container, {
          icon: 'receipt',
          title: 'No transactions yet',
          message: 'Your giving history will appear here once transactions are recorded.',
        })
      }

      container.innerHTML = `
        <div class="mg-wrap">
          <!-- Stats -->
          <div class="mg-stats">
            <div class="mg-stat-card">
              <div class="mg-stat-label">Total Given</div>
              <div class="mg-stat-value">${currency} ${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div class="mg-stat-sub">${all.length} transaction${all.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="mg-stat-card">
              <div class="mg-stat-label">This Year</div>
              <div class="mg-stat-value">${currency} ${Number(yearTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div class="mg-stat-sub">${thisYear.length} transaction${thisYear.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="mg-stat-card">
              <div class="mg-stat-label">Most Recent</div>
              <div class="mg-stat-value" style="font-size:1.1rem;">${all[0] ? _fmtDate(all[0].transaction_date) : '—'}</div>
              <div class="mg-stat-sub">${all[0]?.category_name ?? ''}</div>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="mg-toolbar">
            <div class="mg-search-wrap">
              <i class="bi bi-search"></i>
              <input class="mg-search" id="mg-search" type="search" placeholder="Search category or description…">
            </div>
            <select class="mg-select" id="mg-type-filter">
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="tithe">Tithe</option>
              <option value="offering">Offering</option>
              <option value="pledge">Pledge</option>
            </select>
            <span class="mg-count" id="mg-count">${all.length} records</span>
          </div>

          <!-- Table -->
          <div class="mg-card">
            <div class="mg-card-head">
              <h2 class="mg-card-title">Transaction History</h2>
            </div>
            <div style="overflow-x:auto;">
              <table class="mg-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody id="mg-tbody">
                  ${all.map(_renderRow).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'My Giving' }])
      _wireFilters(container, all)

    } catch (err) {
      console.error('[MyGiving] load error:', err)
      renderError(container, err, { retry: () => this.render(container) })
    }
  },

  destroy() { _cleanup() },
} satisfies PageModule

function _wireFilters(container: HTMLElement, all: any[]): void {
  let q = '', type = ''

  function apply(): void {
    const tbody   = container.querySelector<HTMLElement>('#mg-tbody')
    const countEl = container.querySelector<HTMLElement>('#mg-count')
    if (!tbody) return
    const filtered = all.filter(t => {
      if (type && t.transaction_type !== type) return false
      if (q && !t.category_name?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false
      return true
    })
    tbody.innerHTML = filtered.length > 0 ? filtered.map(_renderRow).join('') : `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No matching transactions.</td></tr>`
    if (countEl) countEl.textContent = `${filtered.length} records`
  }

  const searchEl = container.querySelector<HTMLInputElement>('#mg-search')
  _on(searchEl, 'input', e => { q = (e.target as HTMLInputElement).value.toLowerCase().trim(); apply() })

  const typeEl = container.querySelector<HTMLSelectElement>('#mg-type-filter')
  _on(typeEl, 'change', e => { type = (e.target as HTMLSelectElement).value; apply() })
}
