// src/modules/finance/pages/Pledges.ts
// Pledges listing page.
import type { PageModule } from '../../../types/module.types'
import type { FinancePledge } from '../../../types/finance.types'
import { listPledges, softDeletePledge, updatePledgeStatus } from '../repository'
import { Toast } from '@shared/components/Toast'

const fmt = (n: number) => `GHS ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const STATUS_COLORS: Record<string, string> = {
  active:    '#0969da',
  completed: '#1a7f37',
  defaulted: '#b91c1c',
  cancelled: '#656d76',
}

let _pledges: FinancePledge[] = []

const Pledges: PageModule = {
  async render(container) {
    container.innerHTML = `
<div style="padding:24px;max-width:1000px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:var(--text-2xl);font-weight:700;">Pledges</h2>
      <div id="pl-subtitle" style="color:var(--mm-text-secondary);">Loading…</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" onclick="location.hash='#/finance/pledges/new'">+ New Pledge</button>
      <button class="mm-btn-outline" onclick="location.hash='#/finance'">← Back</button>
    </div>
  </div>

  <div id="pl-list" style="display:flex;flex-direction:column;gap:12px;">
    <div style="padding:40px;text-align:center;color:var(--mm-text-secondary);">Loading…</div>
  </div>
</div>`

    try {
      _pledges = await listPledges()
      render()
    } catch (err: any) {
      container.querySelector('#pl-list')!.innerHTML = `<div style="color:#b91c1c;">${err.message}</div>`
    }

    function render() {
      const sub = container.querySelector<HTMLElement>('#pl-subtitle')
      if (sub) sub.textContent = `${_pledges.length} pledge${_pledges.length !== 1 ? 's' : ''}`
      const list = container.querySelector<HTMLElement>('#pl-list')!

      if (_pledges.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:60px;color:var(--mm-text-secondary);">No pledges yet.</div>`
        return
      }

      list.innerHTML = _pledges.map(p => `
<div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:16px 20px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
    <div>
      <div style="font-weight:700;font-size:var(--text-base);color:var(--mm-text-primary);">${p.pledge_name}</div>
      <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);">
        ${p.start_date}${p.end_date ? ` → ${p.end_date}` : ''} &nbsp;·&nbsp;
        <span style="color:${STATUS_COLORS[p.status] ?? '#000'};font-weight:600;">${p.status}</span>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:700;font-size:var(--text-lg);">${fmt(Number(p.amount_paid))} <span style="color:var(--mm-text-secondary);font-size:var(--text-sm);font-weight:400;">/ ${fmt(Number(p.total_amount))}</span></div>
      <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);">${p.fulfilment_pct ?? 0}% fulfilled</div>
    </div>
  </div>
  <div style="height:6px;background:var(--mm-border);border-radius:3px;overflow:hidden;">
    <div style="height:100%;width:${p.fulfilment_pct ?? 0}%;background:${STATUS_COLORS[p.status] ?? '#0969da'};border-radius:3px;"></div>
  </div>
  ${p.status === 'active' ? `
  <div style="margin-top:10px;display:flex;gap:6px;">
    <button class="mm-btn-outline" data-complete-pledge="${p.id}" style="font-size:var(--text-xs);">Mark Completed</button>
    <button class="mm-btn-icon" data-del-pledge="${p.id}" title="Delete" style="color:#b91c1c;border-color:#fecaca;">
      <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
    </button>
  </div>` : ''}
</div>`).join('')

      // Bind actions
      list.querySelectorAll<HTMLElement>('[data-complete-pledge]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['completePledge']!
          try {
            await updatePledgeStatus(id, 'completed')
            _pledges = await listPledges()
            render()
            Toast.success('Pledge marked as completed.')
          } catch (err: any) { Toast.error(err.message) }
        })
      })
      list.querySelectorAll<HTMLElement>('[data-del-pledge]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['delPledge']!
          if (!confirm('Delete this pledge?')) return
          try {
            await softDeletePledge(id)
            _pledges = _pledges.filter(p => p.id !== id)
            render()
            Toast.success('Pledge deleted.')
          } catch (err: any) { Toast.error(err.message) }
        })
      })
    }
  },
  destroy() { _pledges = [] },
}

export default Pledges
