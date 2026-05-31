// src/modules/membership/pages/HouseholdList.ts
// Lists all households with search, member count, and "New Household" button.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { listHouseholds, deleteHousehold } from '../repository'
import type { HouseholdView } from '../../../types/member.types'
import { injectMembershipCSS } from '../utils/member-helpers'

let _container: HTMLElement | null = null
let _households: HouseholdView[] = []
let _filtered: HouseholdView[] = []
let _searchDebounce: ReturnType<typeof setTimeout> | null = null

const HouseholdList: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'table')
    injectMembershipCSS()

    try {
      _households = await listHouseholds()
      _filtered = _households
    } catch (err) {
      renderError(container, err, { retry: () => HouseholdList.render(container) })
      return
    }

    container.innerHTML = `
<div class="mm-root">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size: var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Households</h2>
      <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-top:2px;">Manage family households and their members</div>
    </div>
    <button class="mm-btn-primary" id="hl-newBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Household
    </button>
  </div>

  <div class="mm-toolbar" style="margin-bottom:16px;">
    <div class="mm-search-wrap" style="flex:1;max-width:320px;">
      <svg class="mm-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="mm-search-input" id="hl-search" placeholder="Search households…" autocomplete="off">
    </div>
    <div style="font-size: var(--text-base);color:var(--mm-text-secondary);margin-left:auto;">
      <span id="hl-count">0</span> households
    </div>
  </div>

  <div class="mm-list-view" id="hl-listView">
    <table class="mm-table">
      <thead>
        <tr>
          <th>Family Name</th>
          <th>Members</th>
          <th>Primary Contact</th>
          <th>Address</th>
          <th style="width:100px;">Actions</th>
        </tr>
      </thead>
      <tbody id="hl-tbody"></tbody>
    </table>
  </div>

  <div class="mm-empty-state" id="hl-empty" style="display:none;">
    <div class="mm-empty-icon">🏠</div>
    <div class="mm-empty-title">No households found</div>
    <div class="mm-empty-sub">Create your first household to get started.</div>
    <button class="mm-btn-primary" id="hl-emptyNewBtn">New Household</button>
  </div>
</div>`

    _renderRows()
    _bindEvents()
  },

  destroy() {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _container = null
    _households = []
    _filtered = []
  },
}

export default HouseholdList

function _renderRows(): void {
  if (!_container) return
  const tbody = _container.querySelector<HTMLElement>('#hl-tbody')
  const countEl = _container.querySelector('#hl-count')
  const emptyEl = _container.querySelector<HTMLElement>('#hl-empty')
  const listView = _container.querySelector<HTMLElement>('#hl-listView')

  if (countEl) countEl.textContent = String(_filtered.length)

  if (_filtered.length === 0) {
    if (emptyEl) emptyEl.style.display = ''
    if (listView) listView.style.display = 'none'
    return
  }

  if (emptyEl) emptyEl.style.display = 'none'
  if (listView) listView.style.display = ''

  if (tbody) {
    tbody.innerHTML = _filtered.map(h => `
<tr data-hh-row="${h.id}" style="cursor:pointer;">
  <td>
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--mm-blue);
        display:flex;align-items:center;justify-content:center;color:#fff;
        font-size: var(--text-base);font-weight:700;flex-shrink:0;">
        ${h.family_name[0]?.toUpperCase() ?? 'H'}
      </div>
      <div style="font-weight:600;color:var(--mm-text-primary);">${h.family_name}</div>
    </div>
  </td>
  <td><span class="mm-badge blue">${h.member_count} member${h.member_count === 1 ? '' : 's'}</span></td>
  <td style="font-size: var(--text-base);">${h.primary_contact_name ?? '—'}</td>
  <td style="font-size: var(--text-sm);color:var(--mm-text-secondary);">${h.address ?? '—'}</td>
  <td class="mm-col-actions">
    <div class="mm-table-actions">
      <button class="mm-btn-icon" data-hh-view="${h.id}" title="View">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="mm-btn-icon" data-hh-edit="${h.id}" title="Edit">
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="mm-btn-icon" data-hh-delete="${h.id}" title="Delete" style="color:var(--mm-red);">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  </td>
</tr>`).join('')

    // Row click → view detail
    tbody.querySelectorAll<HTMLElement>('[data-hh-row]').forEach(row => {
      row.addEventListener('click', e => {
        const btn = (e.target as Element).closest('[data-hh-view],[data-hh-edit],[data-hh-delete]')
        if (!btn) navigate(`/households/${row.dataset['hhRow']}`)
      })
    })

    tbody.querySelectorAll<HTMLElement>('[data-hh-view]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); navigate(`/households/${btn.dataset['hhView']}`) })
    })

    tbody.querySelectorAll<HTMLElement>('[data-hh-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); navigate(`/households/${btn.dataset['hhEdit']}/edit`) })
    })

    tbody.querySelectorAll<HTMLElement>('[data-hh-delete]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const id = btn.dataset['hhDelete']!
        const h = _households.find(x => x.id === id)
        if (!confirm(`Delete household "${h?.family_name}"? This cannot be undone.`)) return
        try {
          await deleteHousehold(id)
          Toast.success('Household deleted.')
          _households = _households.filter(x => x.id !== id)
          _filtered   = _filtered.filter(x => x.id !== id)
          _renderRows()
        } catch (err) {
          Toast.fromError(err)
        }
      })
    })
  }
}

function _bindEvents(): void {
  if (!_container) return

  _container.querySelector('#hl-newBtn')?.addEventListener('click', () => navigate('/households/new'))
  _container.querySelector('#hl-emptyNewBtn')?.addEventListener('click', () => navigate('/households/new'))

  _container.querySelector<HTMLInputElement>('#hl-search')?.addEventListener('input', e => {
    if (_searchDebounce) clearTimeout(_searchDebounce)
    _searchDebounce = setTimeout(() => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase()
      _filtered = q
        ? _households.filter(h => h.family_name.toLowerCase().includes(q) || (h.primary_contact_name ?? '').toLowerCase().includes(q))
        : _households
      _renderRows()
    }, 200)
  })
}
