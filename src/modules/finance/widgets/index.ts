// src/modules/finance/widgets/index.ts
// Reusable widget primitives for the Finance module.
// All widgets are pure functions that return HTML strings or DOM elements.
// They carry NO state — callers own state and re-render as needed.

import type { FinanceTransaction, FinancePledge, FinanceBudget } from '../finance.types'

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtCurrency(amount: number, currency = 'GHS'): string {
  const symbol = currency === 'GHS' ? 'GH₵' : currency
  return `${symbol} ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

export function fmtShort(amount: number, currency = 'GHS'): string {
  const symbol = currency === 'GHS' ? 'GH₵' : currency
  if (amount >= 1_000_000) return `${symbol} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `${symbol} ${(amount / 1_000).toFixed(1)}k`
  return `${symbol} ${amount.toFixed(0)}`
}

// ── TransactionStatusBadge ────────────────────────────────────────────────────

export function TransactionTypeBadge(type: string, categoryType: 'income' | 'expense'): string {
  const isIncome = categoryType === 'income'
  return `
  <span style="
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:99px; font-size:11px; font-weight:600;
    background:${isIncome ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.1)'};
    color:${isIncome ? '#34d399' : '#fb7185'};
    border:1px solid ${isIncome ? 'rgba(16,185,129,.25)' : 'rgba(244,63,94,.22)'};
  ">
    <span class="bi bi-${isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}" style="font-size:10px;"></span>
    ${type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
  </span>`
}

export function PaymentMethodBadge(method: string): string {
  const iconMap: Record<string, string> = {
    cash:          'cash-stack',
    momo:          'phone',
    bank_transfer: 'bank',
    cheque:        'receipt',
    other:         'three-dots',
  }
  const icon = iconMap[method] ?? 'three-dots'
  const label = method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return `
  <span style="
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:6px; font-size:11px; font-weight:500;
    background:#21262d; border:1px solid #30363d; color:#8b949e;
  ">
    <span class="bi bi-${icon}" style="font-size:11px;"></span>
    ${label}
  </span>`
}

// ── PledgeProgressCard ────────────────────────────────────────────────────────

export function PledgeProgressBar(
  pct: number,
  status: string,
  delayS = 0.3
): string {
  const colorMap: Record<string, string> = {
    active:    'linear-gradient(90deg,#22c55e,#56d364)',
    completed: 'linear-gradient(90deg,#388bfd,#58a6ff)',
    defaulted: 'linear-gradient(90deg,#f43f5e,#fb7185)',
    cancelled: '#484f58',
  }
  const fill = colorMap[status] ?? colorMap.active
  const clamped = Math.min(100, Math.max(0, pct))

  return `
  <div style="height:6px; border-radius:99px; background:#21262d; overflow:hidden; position:relative;">
    <div style="
      height:100%; border-radius:99px;
      width:${clamped}%;
      background:${fill};
      animation:finBarGrow .9s cubic-bezier(.16,1,.3,1) ${delayS}s both;
    "></div>
  </div>`
}

// ── BudgetVarianceBadge ───────────────────────────────────────────────────────

export function BudgetVarianceBadge(variance: number, budgeted: number): string {
  if (budgeted === 0) {
    return `<span style="font-size:11px;color:#484f58;">—</span>`
  }
  const over  = variance > 0
  const exact = Math.abs(variance) < 0.01
  const label = exact ? '±0'
    : `${over ? '+' : '−'}${fmtCurrency(Math.abs(variance)).replace('GH₵ ', '')}`
  const bg    = exact ? 'rgba(88,166,255,.1)' : over ? 'rgba(244,63,94,.1)' : 'rgba(16,185,129,.12)'
  const color = exact ? '#58a6ff'             : over ? '#fb7185'            : '#34d399'
  const icon  = exact ? 'dash'                : over ? 'arrow-up'          : 'arrow-down'

  return `
  <span style="
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;
    background:${bg}; color:${color};
  ">
    <span class="bi bi-${icon}" style="font-size:10px;"></span>
    ${label}
  </span>`
}

// ── StatsCardGroup ────────────────────────────────────────────────────────────

export interface StatCard {
  icon:       string    // Bootstrap Icons name
  label:      string
  value:      string
  iconBg:     string
  iconColor:  string
  barColor?:  string
  barValue?:  number    // 0-100
  trend?:     string
  trendUp?:   boolean
  id?:        string
}

export function renderStatCards(cards: StatCard[]): string {
  return `
  <div class="fin-stat-grid">
    ${cards.map((c, i) => `
    <div class="fin-stat-card animate-fade-up" style="animation-delay:${50 + i * 50}ms;" ${c.id ? `id="${c.id}"` : ''}>
      <div class="fin-stat-header">
        <div class="fin-stat-icon" style="background:${c.iconBg};">
          <span class="bi bi-${c.icon}" style="font-size:16px;color:${c.iconColor};"></span>
        </div>
        <span class="fin-stat-label">${c.label}</span>
      </div>
      <div class="fin-stat-value">${c.value}</div>
      ${c.trend ? `
      <div class="fin-stat-trend" style="color:${c.trendUp ? '#34d399' : '#fb7185'};">
        <span class="bi bi-arrow-${c.trendUp ? 'up' : 'down'}" style="font-size:10px;"></span>
        ${c.trend}
      </div>` : ''}
      ${c.barColor != null ? `
      <div class="fin-stat-bar-track">
        <div class="fin-stat-bar-fill" style="width:${c.barValue ?? 0}%;background:${c.barColor};animation:finBarGrow .8s .3s cubic-bezier(.16,1,.3,1) both;"></div>
      </div>` : ''}
    </div>`).join('')}
  </div>`
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState(icon: string, title: string, subtitle = ''): string {
  return `
  <div class="fin-empty-state">
    <span class="bi bi-${icon}" style="font-size:2.5rem;color:#30363d;"></span>
    <p class="fin-empty-title">${title}</p>
    ${subtitle ? `<p class="fin-empty-sub">${subtitle}</p>` : ''}
  </div>`
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

export function SkeletonRows(count = 5): string {
  return Array.from({ length: count }, (_, i) => `
  <div class="fin-skeleton-row" style="animation-delay:${i * 60}ms;">
    <div class="fin-skeleton fin-sk-sm"></div>
    <div class="fin-skeleton fin-sk-md"></div>
    <div class="fin-skeleton fin-sk-lg"></div>
    <div class="fin-skeleton fin-sk-sm"></div>
    <div class="fin-skeleton fin-sk-md"></div>
  </div>`).join('')
}

// ── PaginationControls ────────────────────────────────────────────────────────

export function PaginationControls(
  currentPage: number,
  totalPages:  number,
  onPageId:    string   // data attribute prefix, e.g. "txPage"
): string {
  if (totalPages <= 1) return ''

  let html = `
  <div class="fin-pagination">
    <span class="fin-page-info">Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong></span>
    <div class="fin-page-btns">`

  html += `<button class="fin-page-btn" data-${onPageId}="${currentPage - 1}"
    ${currentPage <= 1 ? 'disabled' : ''}>
    <span class="bi bi-chevron-left"></span>
  </button>`

  for (let p = 1; p <= totalPages; p++) {
    if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      html += `<button class="fin-page-btn ${p === currentPage ? 'active' : ''}"
        data-${onPageId}="${p}">${p}</button>`
    } else if (Math.abs(p - currentPage) === 2) {
      html += `<span class="fin-page-ellipsis">…</span>`
    }
  }

  html += `<button class="fin-page-btn" data-${onPageId}="${currentPage + 1}"
    ${currentPage >= totalPages ? 'disabled' : ''}>
    <span class="bi bi-chevron-right"></span>
  </button>`

  html += `</div></div>`
  return html
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────

export function BulkActionBar(selectedCount: number): string {
  return `
  <div class="fin-bulk-bar ${selectedCount > 0 ? 'visible' : ''}" id="finBulkBar">
    <span class="bi bi-check-square-fill" style="font-size:16px;color:#58a6ff;"></span>
    <span class="fin-bulk-count"><span id="finBulkCount">${selectedCount}</span> selected</span>
    <div class="fin-bulk-divider"></div>
    <button class="fin-tbtn" id="finBulkExport" style="height:34px;font-size:12px;">
      <span class="bi bi-download"></span> Export
    </button>
    <button class="fin-tbtn fin-tbtn-danger" id="finBulkVoid" style="height:34px;font-size:12px;">
      <span class="bi bi-x-circle"></span> Void
    </button>
    <button class="fin-icon-btn" id="finBulkClear" style="margin-left:auto;">
      <span class="bi bi-x-lg"></span>
    </button>
  </div>`
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────

export interface DonutSegment {
  label:  string
  value:  number
  color:  string
}

export function DonutChart(
  segments: DonutSegment[],
  centerLabel: string,
  centerValue: string
): string {
  const total = segments.reduce((s, c) => s + c.value, 0)
  if (total === 0) return EmptyState('pie-chart', 'No data available')

  const cx = 70, cy = 70, r = 52, strokeW = 18
  const circumference = 2 * Math.PI * r
  let offset = 0
  let svgContent = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#21262d" stroke-width="${strokeW}"/>`

  segments.forEach((seg, i) => {
    const pct  = seg.value / total
    const dash = pct * circumference
    const gap  = circumference - dash
    svgContent += `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset * circumference / (2 * Math.PI) + circumference * 0.25).toFixed(2)}"
      style="animation:finDrawLine 1s ${i * 0.12}s cubic-bezier(.16,1,.3,1) both;"
      transform="rotate(-90 ${cx} ${cy})">
      <title>${seg.label}: ${fmtCurrency(seg.value)}</title>
    </circle>`
    offset += pct * 2 * Math.PI
  })

  const legend = segments.map(seg => `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0;">
    <div style="display:flex;align-items:center;gap:6px;min-width:0;">
      <div style="width:8px;height:8px;border-radius:2px;background:${seg.color};flex-shrink:0;"></div>
      <span style="font-size:11px;color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${seg.label}</span>
    </div>
    <span style="font-size:11px;font-weight:600;color:#e6edf3;flex-shrink:0;">${Math.round((seg.value/total)*100)}%</span>
  </div>`).join('')

  return `
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
      <svg viewBox="0 0 140 140" style="width:140px;height:140px;">${svgContent}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
        <span style="font-size:11px;color:#8b949e;">${centerLabel}</span>
        <span style="font-size:14px;font-weight:700;color:#e6edf3;">${centerValue}</span>
      </div>
    </div>
    <div style="flex:1;min-width:120px;">${legend}</div>
  </div>`
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

export interface BarGroup {
  label:   string
  income:  number
  expense: number
}

export function BarChart(groups: BarGroup[], height = 140): string {
  const maxVal = Math.max(...groups.flatMap(g => [g.income, g.expense]), 1)

  const bars = groups.map((g, i) => {
    const incH = Math.max(3, Math.round((g.income  / maxVal) * height))
    const expH = Math.max(3, Math.round((g.expense / maxVal) * height))
    const d1   = i * 0.055
    const d2   = i * 0.055 + 0.025

    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
      <div style="display:flex;align-items:flex-end;gap:3px;height:${height}px;">
        <div title="${g.label} Income: ${fmtCurrency(g.income)}" style="
          width:16px; min-height:3px; border-radius:3px 3px 0 0;
          height:${incH}px;
          background:linear-gradient(180deg,#34d399,#22c55e);
          transform-origin:bottom;
          animation:finBarRise .8s ${d1}s cubic-bezier(.16,1,.3,1) both;
        "></div>
        <div title="${g.label} Expense: ${fmtCurrency(g.expense)}" style="
          width:16px; min-height:3px; border-radius:3px 3px 0 0;
          height:${expH}px;
          background:linear-gradient(180deg,#fb7185,#f43f5e);
          transform-origin:bottom;
          animation:finBarRise .8s ${d2}s cubic-bezier(.16,1,.3,1) both;
        "></div>
      </div>
      <span style="font-size:10px;color:#484f58;white-space:nowrap;">${g.label}</span>
    </div>`
  }).join('')

  return `
  <div style="overflow-x:auto;padding-bottom:4px;">
    <div style="display:flex;align-items:flex-end;gap:4px;min-width:${groups.length * 50}px;">
      ${bars}
    </div>
  </div>`
}

// ── Modal scaffold ────────────────────────────────────────────────────────────

export function Modal(id: string, title: string, body: string, actions: string): string {
  return `
  <div id="${id}" class="fin-modal-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
    <div class="fin-modal-box animate-scale-in">
      <div class="fin-modal-header">
        <h2 id="${id}-title" class="fin-modal-title">${title}</h2>
        <button class="fin-icon-btn fin-modal-close" data-modal-close="${id}" aria-label="Close">
          <span class="bi bi-x-lg"></span>
        </button>
      </div>
      <div class="fin-modal-body">${body}</div>
      <div class="fin-modal-footer">${actions}</div>
    </div>
  </div>`
}

// ── Drawer scaffold ───────────────────────────────────────────────────────────

export function Drawer(id: string, title: string, body: string): string {
  return `
  <div id="${id}" class="fin-drawer-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
    <div class="fin-drawer-backdrop fin-drawer-close" data-drawer-close="${id}"></div>
    <div class="fin-drawer-panel">
      <div class="fin-drawer-header">
        <h2 id="${id}-title" class="fin-drawer-title">${title}</h2>
        <button class="fin-icon-btn fin-drawer-close" data-drawer-close="${id}" aria-label="Close">
          <span class="bi bi-x-lg"></span>
        </button>
      </div>
      <div class="fin-drawer-body">${body}</div>
    </div>
  </div>`
}

// ── Context menu ──────────────────────────────────────────────────────────────

export function ContextMenu(id: string, items: Array<{ label: string; icon: string; action: string; danger?: boolean }>): string {
  return `
  <div id="${id}" class="fin-ctx-menu" style="display:none;" role="menu">
    ${items.map(item => `
    <button class="fin-ctx-item ${item.danger ? 'danger' : ''}" data-action="${item.action}" role="menuitem">
      <span class="bi bi-${item.icon}" style="font-size:14px;"></span>
      ${item.label}
    </button>`).join('')}
  </div>`
}

// ── WorkspaceTabs ─────────────────────────────────────────────────────────────

export interface WorkspaceTab {
  id:          string
  label:       string
  icon:        string    // Bootstrap Icons name
  badgeId?:    string
}

export function WorkspaceTabs(tabs: WorkspaceTab[], activeId: string): string {
  return `
  <div class="fin-tab-bar" role="tablist" aria-label="Finance workspace">
    ${tabs.map(t => `
    <button
      class="fin-tab-btn ${t.id === activeId ? 'active' : ''}"
      data-tab="${t.id}"
      role="tab"
      aria-selected="${t.id === activeId}"
      aria-controls="fin-tab-panel-${t.id}"
    >
      <span class="bi bi-${t.icon}" style="font-size:16px;"></span>
      ${t.label}
      ${t.badgeId ? `<span class="fin-tab-count" id="${t.badgeId}">0</span>` : ''}
    </button>`).join('')}
  </div>`
}

// ── PeriodSwitcher ────────────────────────────────────────────────────────────

export function PeriodSwitcher(
  options: Array<{ value: string; label: string }>,
  activeValue: string,
  idPrefix: string
): string {
  return `
  <div class="fin-period-bar" role="group" aria-label="Period selector">
    ${options.map(o => `
    <button
      class="fin-period-btn ${o.value === activeValue ? 'active' : ''}"
      data-period="${o.value}"
      data-prefix="${idPrefix}"
    >${o.label}</button>`).join('')}
  </div>`
}