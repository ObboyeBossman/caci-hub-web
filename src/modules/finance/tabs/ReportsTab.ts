// src/modules/finance/tabs/ReportsTab.ts

import {
  getIncomeExpenseSummary,
  getCategoryBreakdown,
  getTopContributors,
  getPledgeSummary,
  getBudgetVarianceSummary,
  exportFinanceReport,
} from '../repository'
import {
  fmtCurrency, fmtShort,
  renderStatCards, EmptyState,
  DonutChart, BarChart, PeriodSwitcher,
} from '../widgets/index'
import type {
  IncomeExpenseSummary, CategoryBreakdown,
  TopContributor, PledgeSummary, BudgetVarianceSummary,
} from '../finance.types'

export function createReportsTab() {
  let container: HTMLElement
  let period    = 'annual' as 'monthly' | 'quarterly' | 'annual'
  let year      = new Date().getFullYear()

  const periodLabel: Record<string, string> = {
    annual:    `Full Year ${year}`,
    quarterly: `Q${Math.ceil((new Date().getMonth()+1)/3)} ${year}`,
    monthly:   new Date().toLocaleDateString('en-GB', { month:'long', year:'numeric' }),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(el: HTMLElement): void {
    container = el
    container.innerHTML = buildShell()
    attachListeners()
    loadAllData()
  }

  function buildShell(): string {
    return `
    <!-- Stats -->
    ${renderStatCards([
      { icon:'graph-up-arrow',   label:'YTD Income',   value:'GH₵ 0', iconBg:'rgba(16,185,129,.12)',  iconColor:'#10b981', id:'rpStatInc' },
      { icon:'graph-down-arrow', label:'YTD Expense',  value:'GH₵ 0', iconBg:'rgba(244,63,94,.1)',    iconColor:'#f43f5e', id:'rpStatExp' },
      { icon:'bank',             label:'Net Surplus',  value:'GH₵ 0', iconBg:'rgba(88,166,255,.12)',  iconColor:'#58a6ff', id:'rpStatNet' },
      { icon:'people',           label:'Avg/Member',   value:'GH₵ 0', iconBg:'rgba(139,92,246,.12)',  iconColor:'#a78bfa', id:'rpStatAvg' },
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
          'rp'
        )}
        <span class="fin-page-info" id="rpPeriodLabel" style="font-weight:600;">${periodLabel[period]}</span>
      </div>
      <div class="fin-toolbar-actions">
        <button class="fin-tbtn" id="rpPrint">
          <span class="bi bi-printer"></span>
          <span class="fin-btn-label">Print</span>
        </button>
        <button class="fin-tbtn fin-tbtn-primary" id="rpExportPdf">
          <span class="bi bi-file-earmark-pdf"></span>
          <span class="fin-btn-label">Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Charts row -->
    <div class="fin-charts-grid animate-fade-up" style="animation-delay:250ms;">
      <!-- Bar chart -->
      <div class="fin-chart-panel">
        <div class="fin-chart-title">Income vs Expense</div>
        <div class="fin-chart-sub" id="rpBarSub">Month-by-month comparison · ${year}</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:5px;">
            <div style="width:10px;height:10px;border-radius:3px;background:#34d399;"></div>
            <span style="font-size:11px;color:#8b949e;">Income</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <div style="width:10px;height:10px;border-radius:3px;background:#fb7185;"></div>
            <span style="font-size:11px;color:#8b949e;">Expense</span>
          </div>
        </div>
        <div id="rpBarChart">
          <div class="fin-empty-state" style="padding:32px 0;">
            <div class="fin-skeleton fin-sk-lg" style="height:100px;width:100%;border-radius:8px;"></div>
          </div>
        </div>
      </div>

      <!-- Donut chart -->
      <div class="fin-chart-panel">
        <div class="fin-chart-title">Income Breakdown</div>
        <div class="fin-chart-sub">By category · YTD ${year}</div>
        <div id="rpDonut">
          <div style="display:flex;justify-content:center;padding:20px;">
            <div class="fin-skeleton" style="width:140px;height:140px;border-radius:50%;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sparklines + Top contributors -->
    <div class="fin-charts-grid-2 animate-fade-up" style="animation-delay:300ms;">
      <!-- Pledge summary -->
      <div class="fin-chart-panel">
        <div class="fin-chart-title">Pledge Summary</div>
        <div class="fin-chart-sub">Commitment fulfilment · YTD ${year}</div>
        <div id="rpPledge"></div>
      </div>

      <!-- Top contributors -->
      <div class="fin-chart-panel">
        <div class="fin-chart-title">Top Contributors</div>
        <div class="fin-chart-sub">Highest giving members · YTD ${year}</div>
        <div id="rpGivers"></div>
      </div>
    </div>

    <!-- Budget variance + Summary table -->
    <div class="fin-chart-panel animate-fade-up" style="animation-delay:350ms;">
      <div class="fin-chart-title">Financial Summary</div>
      <div class="fin-chart-sub" id="rpSumSub">Full Year ${year} — all categories</div>
      <div style="overflow-x:auto;margin-top:12px;">
        <table class="fin-sum-table" id="rpSumTable">
          <thead><tr>
            <th>Category</th><th>Type</th><th>Budget</th>
            <th style="text-align:right;">Actual</th><th style="text-align:right;">Variance</th>
          </tr></thead>
          <tbody id="rpSumBody"></tbody>
        </table>
      </div>
    </div>
    `
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadAllData(): Promise<void> {
    await Promise.allSettled([
      loadBarChart(),
      loadDonut(),
      loadGivers(),
      loadPledgeSummary(),
      loadVarianceTable(),
    ])
  }

  async function loadBarChart(): Promise<void> {
    try {
      const data = await getIncomeExpenseSummary(period, year)
      updateStatsFromSummary(data)

      const subMap: Record<string, string> = {
        annual:    `Month-by-month comparison · ${year}`,
        quarterly: `Quarter-by-quarter comparison · ${year}`,
        monthly:   `Week-aggregated · ${new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})}`,
      }
      setEl('rpBarSub', subMap[period])

      const groups = data.map(d => ({
        label:   d.period,
        income:  d.income,
        expense: d.expense,
      }))

      const el = container.querySelector<HTMLElement>('#rpBarChart')!
      el.innerHTML = BarChart(groups, 150)
    } catch (err) {
      const el = container.querySelector<HTMLElement>('#rpBarChart')!
      el.innerHTML = EmptyState('bar-chart', 'Could not load chart data')
    }
  }

  function updateStatsFromSummary(data: IncomeExpenseSummary[]): void {
    const ytdIncome  = data.reduce((s, d) => s + d.income,  0)
    const ytdExpense = data.reduce((s, d) => s + d.expense, 0)
    const net        = ytdIncome - ytdExpense

    setEl('rpStatInc', fmtCurrency(ytdIncome))
    setEl('rpStatExp', fmtCurrency(ytdExpense))
    setEl('rpStatNet', fmtCurrency(net))

    const netEl = container.querySelector<HTMLElement>('#rpStatNet')
    if (netEl) netEl.style.color = net >= 0 ? '#58a6ff' : '#fb7185'
  }

  async function loadDonut(): Promise<void> {
    try {
      const cats = await getCategoryBreakdown('income', year)
      const total = cats.reduce((s, c) => s + c.total, 0)
      const colors = ['#fbbf24','#34d399','#a78bfa','#f9a8d4','#58a6ff','#fb7185','#6ee7b7']

      const segments = cats.slice(0, 7).map((c, i) => ({
        label: c.category_name,
        value: c.total,
        color: colors[i % colors.length],
      }))

      container.querySelector<HTMLElement>('#rpDonut')!.innerHTML =
        DonutChart(segments, 'YTD Income', fmtShort(total))

      setEl('rpStatAvg', fmtShort(Math.round(total / Math.max(cats.length, 1))))
    } catch {
      container.querySelector<HTMLElement>('#rpDonut')!.innerHTML =
        EmptyState('pie-chart', 'No income data')
    }
  }

  async function loadGivers(): Promise<void> {
    try {
      const givers = await getTopContributors(year, 8)
      const maxTotal = givers[0]?.total ?? 1
      const medals   = ['🥇','🥈','🥉']

      container.querySelector<HTMLElement>('#rpGivers')!.innerHTML = givers.length
        ? givers.map((g, i) => {
          const barW = Math.round((g.total / maxTotal) * 100)
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #21262d;" class="animate-fade-up" style="animation-delay:${i*50}ms;">
            <div style="
              width:24px;height:24px;border-radius:6px;flex-shrink:0;
              display:flex;align-items:center;justify-content:center;
              background:${i < 3 ? 'rgba(251,191,36,.12)' : '#21262d'};
              font-size:${i < 3 ? '14px' : '11px'};font-weight:700;
              color:${i < 3 ? '#fbbf24' : '#8b949e'};
            ">${i < 3 ? medals[i] : g.rank}</div>
            <div style="
              width:30px;height:30px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              font-size:10px;font-weight:700;flex-shrink:0;
              background:#1e3a5f;color:#93c5fd;border:2px solid #0d1117;
            ">${g.member_name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12.5px;font-weight:600;color:#c9d1d9;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.member_name}</div>
              <div style="height:4px;border-radius:99px;background:#21262d;margin-top:4px;overflow:hidden;">
                <div style="
                  height:100%;border-radius:99px;width:${barW}%;
                  background:linear-gradient(90deg,#1f6feb,#58a6ff);
                  animation:finBarGrow .8s ${.3 + i*.06}s cubic-bezier(.16,1,.3,1) both;
                "></div>
              </div>
            </div>
            <div style="font-size:12px;font-weight:700;font-family:monospace;color:#e6edf3;flex-shrink:0;">
              ${fmtShort(g.total)}
            </div>
          </div>`
        }).join('')
        : EmptyState('people', 'No contributor data')
    } catch {
      container.querySelector<HTMLElement>('#rpGivers')!.innerHTML =
        EmptyState('people', 'Could not load contributors')
    }
  }

  async function loadPledgeSummary(): Promise<void> {
    try {
      const ps = await getPledgeSummary()
      const fulPct = ps.fulfilment_pct
      const barW   = Math.min(100, fulPct)
      const barBg  = fulPct >= 80 ? 'linear-gradient(90deg,#22c55e,#56d364)'
                   : fulPct >= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                   : 'linear-gradient(90deg,#f43f5e,#fb7185)'

      container.querySelector<HTMLElement>('#rpPledge')!.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;color:#c9d1d9;">Total Pledged</span>
          <span style="font-size:14px;font-weight:700;color:#a78bfa;">${fmtCurrency(ps.total_pledged)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;color:#c9d1d9;">Total Collected</span>
          <span style="font-size:14px;font-weight:700;color:#34d399;">${fmtCurrency(ps.total_paid)}</span>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:11px;color:#8b949e;">Fulfilment</span>
            <span style="font-size:11px;font-weight:700;color:#e6edf3;">${fulPct}%</span>
          </div>
          <div style="height:8px;border-radius:99px;background:#21262d;overflow:hidden;">
            <div style="height:100%;border-radius:99px;width:${barW}%;background:${barBg};
              animation:finBarGrow 1s .4s cubic-bezier(.16,1,.3,1) both;"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:4px;">
          ${[
            { label:'Active',    val: ps.active,    col:'#34d399' },
            { label:'Completed', val: ps.completed, col:'#58a6ff' },
            { label:'Defaulted', val: ps.defaulted, col:'#fb7185' },
            { label:'Cancelled', val: ps.cancelled, col:'#8b949e' },
          ].map(s => `
          <div style="
            background:#0d1117;border:1px solid #30363d;border-radius:10px;
            padding:10px;text-align:center;
          ">
            <div style="font-size:18px;font-weight:800;color:${s.col};">${s.val}</div>
            <div style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:.06em;margin-top:2px;">${s.label}</div>
          </div>`).join('')}
        </div>
      </div>`
    } catch {
      container.querySelector<HTMLElement>('#rpPledge')!.innerHTML =
        EmptyState('handshake', 'No pledge data')
    }
  }

  async function loadVarianceTable(): Promise<void> {
    try {
      const summary = await getBudgetVarianceSummary('annual', year)
      const tbody   = container.querySelector<HTMLElement>('#rpSumBody')!

      if (!summary.length) {
        tbody.innerHTML = `<tr><td colspan="5">${EmptyState('wallet2', 'No budget data')}</td></tr>`
        return
      }

      let totalBudgeted = 0, totalActual = 0
      const rowsHtml = summary.map(s => {
        totalBudgeted += s.budgeted
        totalActual   += s.actual
        const isIncome   = s.category_type === 'income'
        const typeColor  = isIncome ? '#34d399' : '#fb7185'
        const actColor   = s.variance > 0 ? '#fb7185' : '#e6edf3'
        const varColor   = s.variance > 0 ? '#fb7185' : s.variance < 0 ? '#34d399' : '#8b949e'
        const varSign    = s.variance > 0 ? '+' : ''
        return `
        <tr>
          <td style="font-weight:500;">${s.category_name}</td>
          <td>
            <span style="
              display:inline-flex;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;
              background:${isIncome ? 'rgba(16,185,129,.1)' : 'rgba(244,63,94,.08)'};
              color:${typeColor};
            ">${s.category_type}</span>
          </td>
          <td style="font-variant-numeric:tabular-nums;">${fmtCurrency(s.budgeted)}</td>
          <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:${actColor};">
            ${fmtCurrency(s.actual)}
          </td>
          <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:${varColor};">
            ${varSign}${fmtCurrency(Math.abs(s.variance))}
          </td>
        </tr>`
      }).join('')

      const net = totalActual - totalBudgeted
      tbody.innerHTML = rowsHtml + `
      <tr style="border-top:1px solid #30363d;background:rgba(88,166,255,.04);">
        <td colspan="3" style="font-weight:700;color:#58a6ff;">Net Position</td>
        <td style="text-align:right;font-weight:800;font-variant-numeric:tabular-nums;font-size:14px;color:#e6edf3;">
          ${fmtCurrency(totalActual)}
        </td>
        <td style="text-align:right;font-weight:800;font-variant-numeric:tabular-nums;font-size:14px;
          color:${net > 0 ? '#fb7185' : net < 0 ? '#34d399' : '#8b949e'};">
          ${net > 0 ? '+' : ''}${fmtCurrency(Math.abs(net))}
        </td>
      </tr>`
    } catch {
      const tbody = container.querySelector<HTMLElement>('#rpSumBody')!
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#484f58;">Could not load summary</td></tr>`
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function attachListeners(): void {
    container.querySelector('.fin-period-bar')?.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-period]')
      if (!btn) return
      period = btn.dataset['period'] as 'monthly' | 'quarterly' | 'annual'
      container.querySelectorAll<HTMLElement>('[data-period]').forEach(b => {
        b.classList.toggle('active', b.dataset['period'] === period)
      })
      setEl('rpPeriodLabel',  periodLabel[period])
      setEl('rpSumSub', `${periodLabel[period]} — all categories`)
      await Promise.allSettled([loadBarChart(), loadVarianceTable()])
    })

    container.querySelector('#rpExportPdf')?.addEventListener('click', async () => {
      const csv  = await exportFinanceReport(
        period === 'monthly' ? 'monthly' : period === 'quarterly' ? 'quarterly' : 'annual',
        year
      )
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `finance-report-${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })

    container.querySelector('#rpPrint')?.addEventListener('click', () => window.print())
  }

  function setEl(id: string, val: string): void {
    const el = container.querySelector<HTMLElement>(`#${id}`)
    if (el) el.textContent = val
  }

  return { render, destroy: () => {} }
}