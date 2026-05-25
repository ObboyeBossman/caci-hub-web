// src/modules/membership/pages/RecordAttendance.ts
// Standalone attendance recording page.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { listMembers } from '../repository'
import { avatarColor, initials, statusBadge, injectMembershipCSS } from '../utils/member-helpers'
import type { MemberView } from '../../../types/member.types'

let _container: HTMLElement | null = null
let _members: MemberView[] = []
let _attendance: Record<string, 'present' | 'absent' | 'excused'> = {}

const RecordAttendance: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'table')
    injectMembershipCSS()

    try {
      _members = await listMembers({ includeDeleted: false }, { limit: 500, sortBy: 'last_name' })
      _members = _members.filter(m => m.membership_status !== 'inactive')
    } catch (err) {
      renderError(container, err, { retry: () => RecordAttendance.render(container) })
      return
    }

    // Default: all present
    _attendance = {}
    _members.forEach(m => { _attendance[m.id] = 'present' })

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Record Attendance</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);">
        ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        · <span id="ra-presentCount">0</span> present / <span id="ra-absentCount">0</span> absent / <span id="ra-excusedCount">0</span> excused
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="ra-saveBtn">Save Attendance</button>
      <button class="mm-btn-outline" onclick="history.back()">Cancel</button>
    </div>
  </div>

  <div style="margin-bottom:14px;display:flex;gap:8px;">
    <button class="mm-btn-outline" style="font-size:12px;padding:5px 12px;" id="ra-markAllPresent">All Present</button>
    <button class="mm-btn-outline" style="font-size:12px;padding:5px 12px;" id="ra-markAllAbsent">All Absent</button>
  </div>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
    <table class="mm-table">
      <thead>
        <tr>
          <th>Member</th>
          <th style="width:80px;">Role</th>
          <th style="width:80px;">Status</th>
          <th style="width:260px;">Attendance</th>
        </tr>
      </thead>
      <tbody id="ra-tbody"></tbody>
    </table>
  </div>
</div>`

    _renderTable()
    _bindEvents()
  },

  destroy() { _container = null; _members = []; _attendance = {} },
}

export default RecordAttendance

function _renderTable(): void {
  if (!_container) return
  const tbody = _container.querySelector('#ra-tbody')
  if (!tbody) return

  tbody.innerHTML = _members.map(m => {
    const s = statusBadge(m.membership_status)
    const bg = avatarColor(`${m.first_name} ${m.last_name}`)
    const ini = initials(m.first_name, m.last_name)
    const att = _attendance[m.id] ?? 'present'
    return `<tr>
      <td>
        <div class="mm-table-name-cell">
          <div class="mm-table-avatar" style="background:${bg}">${ini}</div>
          <div>
            <div class="mm-table-name">${m.first_name} ${m.last_name}</div>
            <div class="mm-table-email">${m.phone_number ?? '—'}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12px;">${m.occupation ?? '—'}</td>
      <td><span class="mm-badge ${s.cls}">${s.label}</span></td>
      <td>
        <div class="mm-att-toggle-wrap">
          <button class="mm-att-toggle ${att === 'present' ? 'present' : ''}" data-att="${m.id}" data-val="present">Present</button>
          <button class="mm-att-toggle ${att === 'absent'  ? 'absent'  : ''}" data-att="${m.id}" data-val="absent">Absent</button>
          <button class="mm-att-toggle ${att === 'excused' ? 'excused' : ''}" data-att="${m.id}" data-val="excused">Excused</button>
        </div>
      </td>
    </tr>`
  }).join('')

  tbody.querySelectorAll<HTMLButtonElement>('[data-att][data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const memberId = btn.dataset['att']!
      const val = btn.dataset['val'] as 'present' | 'absent' | 'excused'
      _attendance[memberId] = val
      const row = btn.closest('tr')!
      row.querySelectorAll('.mm-att-toggle').forEach(b => {
        b.className = 'mm-att-toggle'
        if ((b as HTMLElement).dataset['val'] === val) b.classList.add(val)
      })
      _updateCounts()
    })
  })

  _updateCounts()
}

function _updateCounts(): void {
  if (!_container) return
  const vals = Object.values(_attendance)
  const q = (v: string) => _container!.querySelector(`#ra-${v}Count`)
  const setCount = (v: string) => { const el = q(v); if (el) el.textContent = String(vals.filter(x => x === v).length) }
  setCount('present'); setCount('absent'); setCount('excused')
}

function _bindEvents(): void {
  if (!_container) return

  _container.querySelector('#ra-markAllPresent')?.addEventListener('click', () => {
    _members.forEach(m => { _attendance[m.id] = 'present' })
    _renderTable()
  })

  _container.querySelector('#ra-markAllAbsent')?.addEventListener('click', () => {
    _members.forEach(m => { _attendance[m.id] = 'absent' })
    _renderTable()
  })

  _container.querySelector('#ra-saveBtn')?.addEventListener('click', () => {
    const vals = Object.values(_attendance)
    const present = vals.filter(v => v === 'present').length
    const absent  = vals.filter(v => v === 'absent').length
    const excused = vals.filter(v => v === 'excused').length
    Toast.success(`Attendance saved: ${present} present, ${absent} absent, ${excused} excused.`)
    // TODO: Persist to an attendance_sessions table when backend table is available
    history.back()
  })
}
