// src/modules/services/pages/ServiceList.ts
import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'

// --- Types ---
interface AttSession {
  id: string; name: string; type: string; date: string; time: string;
  present: number; absent: number; excused: number;
}
interface DummyMember {
  id: string; name: string; status: string; role: string; 
}
interface State {
  attSessions: AttSession[];
  currentAttId: string | null;
  memberAtt: Record<string, 'present' | 'absent' | 'excused'>;
  members: DummyMember[];
}

let _container: HTMLElement | null = null
let _state: State | null = null

function _buildInitialState(): State {
  return {
    attSessions: [
      { id: 's1', name: 'Sunday Service', type: 'Sunday Service', date: 'May 4, 2025', time: '09:00', present: 284, absent: 28, excused: 12 },
      { id: 's2', name: 'Mid-week Prayer', type: 'Prayer Meeting', date: 'Apr 30, 2025', time: '18:30', present: 142, absent: 170, excused: 6 },
      { id: 's3', name: 'Youth Service', type: 'Special Event', date: 'Apr 26, 2025', time: '15:00', present: 68, absent: 12, excused: 4 },
      { id: 's4', name: 'Sunday Service', type: 'Sunday Service', date: 'Apr 20, 2025', time: '09:00', present: 268, absent: 44, excused: 10 },
    ],
    currentAttId: null,
    memberAtt: {},
    members: [
      { id: 'm1', name: 'James Osei', status: 'active', role: 'Member' },
      { id: 'm2', name: 'Mary Mensah', status: 'active', role: 'Deaconess' },
      { id: 'm3', name: 'John Appiah', status: 'visitor', role: 'Visitor' },
    ]
  }
}

function _buildHTML(): string {
  return `
<div class="mm-root" style="padding: 24px; max-width: 1200px; margin: 0 auto; color: var(--text-primary);">
<!-- ░░░ ATTENDANCE PAGE ░░░ -->
<div class="mm-section active" style="display:block; animation: fadeIn 0.3s ease;">
  <div class="mm-att-page-header" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px;">
    <div>
      <div class="mm-att-page-title" style="font-size:24px; font-weight:700;">Services & Events Attendance</div>
      <div style="font-size: var(--text-base);color:var(--text-secondary);margin-top:2px;">Track member attendance per service or event</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-outline" id="sv-newSessionBtn" style="padding: 6px 12px; border-radius:6px; border:1px solid var(--border-default); background:transparent; cursor:pointer;">
        New Session
      </button>
      <button class="mm-btn-primary" id="sv-markAttBtn" style="padding: 6px 16px; border-radius:6px; background:var(--caci-blue); color:#fff; border:none; cursor:pointer;">
        Mark Attendance
      </button>
    </div>
  </div>

  <div class="mm-stats-row" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
    <div class="mm-stat-card" style="background:var(--bg-card); border:1px solid var(--border-default); border-radius:8px; padding:16px;">
      <div class="mm-stat-label" style="font-size:13px; color:var(--text-secondary);">Last Sunday</div><div class="mm-stat-value" style="font-size:28px; font-weight:700;">284</div>
      <div class="mm-stat-sub" style="font-size:12px; color:var(--text-muted);">81.8% attendance</div>
      <div class="mm-stat-bar" style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:8px;"><div class="mm-stat-fill" style="height:100%; width:82%; background:var(--caci-blue); border-radius:2px;"></div></div>
    </div>
    <div class="mm-stat-card" style="background:var(--bg-card); border:1px solid var(--border-default); border-radius:8px; padding:16px;">
      <div class="mm-stat-label" style="font-size:13px; color:var(--text-secondary);">Avg (This Month)</div><div class="mm-stat-value" style="font-size:28px; font-weight:700;">271</div>
      <div class="mm-stat-sub" style="font-size:12px; color:var(--text-muted);">78.1% of active</div>
      <div class="mm-stat-bar" style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:8px;"><div class="mm-stat-fill" style="height:100%; width:78%; background:var(--caci-blue); border-radius:2px;"></div></div>
    </div>
    <div class="mm-stat-card" style="background:var(--bg-card); border:1px solid var(--border-default); border-radius:8px; padding:16px;">
      <div class="mm-stat-label" style="font-size:13px; color:var(--text-secondary);">Sessions (May)</div><div class="mm-stat-value" style="font-size:28px; font-weight:700;">5</div>
      <div class="mm-stat-sub" style="font-size:12px; color:var(--text-muted);">4 Sunday, 1 mid-week</div>
      <div class="mm-stat-bar" style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:8px;"><div class="mm-stat-fill" style="height:100%; width:60%; background:var(--caci-gold); border-radius:2px;"></div></div>
    </div>
  </div>

  <div style="font-size: 16px; font-weight:600; color:var(--text-primary); margin-bottom:12px;">Recent Sessions</div>
  <div class="mm-att-sessions-grid" id="sv-attSessionsGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; margin-bottom:32px;"></div>

  <div id="sv-attTableWrap" style="display:none; background:var(--bg-card); border:1px solid var(--border-default); border-radius:8px; padding:20px;">
    <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px;">
      <div>
        <div style="font-size: 18px; font-weight:600;" id="sv-attSessionLabel">—</div>
        <div style="font-size: 14px; color:var(--text-secondary); margin-top:4px;" id="sv-attSessionMeta">—</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="mm-btn-outline" id="sv-closeAttTableBtn" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-default); background:transparent; cursor:pointer;">← Back</button>
        <button class="mm-btn-primary" id="sv-saveAttendanceBtn" style="padding:6px 16px; border-radius:6px; background:var(--caci-blue); color:#fff; border:none; cursor:pointer;">Save Attendance</button>
      </div>
    </div>
    <div class="mm-table-wrap" style="width:100%; border:1px solid var(--border-default); border-radius:6px; overflow:hidden;">
      <table class="mm-att-table" style="width:100%; border-collapse:collapse; text-align:left;">
        <thead style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border-default);">
          <tr>
            <th style="padding:12px 16px; font-size:13px; font-weight:600; color:var(--text-secondary);">Member</th>
            <th style="padding:12px 16px; font-size:13px; font-weight:600; color:var(--text-secondary);">Role</th>
            <th style="padding:12px 16px; font-size:13px; font-weight:600; color:var(--text-secondary);">Attendance</th>
          </tr>
        </thead>
        <tbody id="sv-attTableBody"></tbody>
      </table>
    </div>
  </div>
</div>
<!-- END ATTENDANCE PAGE -->
</div>
`
}

function _renderAttSessions(): void {
  if (!_state || !_container) return
  const grid = _container.querySelector('#sv-attSessionsGrid')
  if (!grid) return
  grid.innerHTML = _state.attSessions.map(s => `
<div class="mm-att-session-card" data-att-session="${s.id}" style="background:var(--bg-card); border:1px solid var(--border-default); border-radius:8px; padding:16px; cursor:pointer; transition: transform 0.2s, box-shadow 0.2s;">
  <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">${s.date} · ${s.type}</div>
  <div style="font-size:16px; font-weight:600; color:var(--text-primary); margin-bottom:16px;">${s.name}</div>
  <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
    <div style="text-align:center;">
      <div style="font-size:18px; font-weight:700; color:#1a7f37;">${s.present}</div>
      <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Present</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:18px; font-weight:700; color:#cf222e;">${s.absent}</div>
      <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Absent</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:18px; font-weight:700; color:#d4a72c;">${s.excused}</div>
      <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Excused</div>
    </div>
  </div>
</div>`).join('')

  grid.querySelectorAll<HTMLElement>('[data-att-session]').forEach(card => {
    card.addEventListener('click', () => _openAttTable(card.dataset['attSession']!))
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--caci-blue)'; card.style.transform = 'translateY(-2px)' })
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border-default)'; card.style.transform = '' })
  })
}

function _openAttTable(sessionId: string): void {
  if (!_state || !_container) return
  const s = _state.attSessions.find(x => x.id === sessionId)
  if (!s) return
  _state.currentAttId = sessionId

  const label = _container.querySelector('#sv-attSessionLabel')
  const meta = _container.querySelector('#sv-attSessionMeta')
  if (label) label.textContent = `${s.name} — ${s.date}`
  if (meta) meta.textContent = `${s.type} · ${s.time}`

  const sessGrid = _container.querySelector<HTMLElement>('#sv-attSessionsGrid')
  const tableWrap = _container.querySelector<HTMLElement>('#sv-attTableWrap')
  if (sessGrid) sessGrid.style.display = 'none'
  if (tableWrap) tableWrap.style.display = 'block'

  // Pre-fill attendance state
  _state.memberAtt = {}
  _state.members.forEach(m => { _state!.memberAtt[m.id] = 'present' })
  _renderAttTable()
}

function _renderAttTable(): void {
  if (!_state || !_container) return
  const tbody = _container.querySelector('#sv-attTableBody')
  if (!tbody) return
  tbody.innerHTML = _state.members.map(m => {
    const status = _state!.memberAtt[m.id] ?? 'present'
    return `
<tr style="border-bottom:1px solid var(--border-default);">
  <td style="padding:12px 16px; font-size:14px; font-weight:500;">${m.name}</td>
  <td style="padding:12px 16px; font-size:13px; color:var(--text-secondary);">${m.role}</td>
  <td style="padding:12px 16px;">
    <div style="display:flex; gap:6px;">
      <button class="sv-att-toggle ${status === 'present' ? 'active-present' : ''}" data-att-member="${m.id}" data-att-status="present" style="${status === 'present' ? 'background:rgba(26,127,55,0.15); color:#2ea043; border-color:#2ea043;' : 'background:transparent; color:var(--text-secondary); border-color:var(--border-default);'} padding:4px 10px; border-radius:4px; border-width:1px; border-style:solid; font-size:12px; cursor:pointer;">Present</button>
      <button class="sv-att-toggle ${status === 'absent' ? 'active-absent' : ''}" data-att-member="${m.id}" data-att-status="absent" style="${status === 'absent' ? 'background:rgba(207,34,46,0.15); color:#fa4549; border-color:#fa4549;' : 'background:transparent; color:var(--text-secondary); border-color:var(--border-default);'} padding:4px 10px; border-radius:4px; border-width:1px; border-style:solid; font-size:12px; cursor:pointer;">Absent</button>
      <button class="sv-att-toggle ${status === 'excused' ? 'active-excused' : ''}" data-att-member="${m.id}" data-att-status="excused" style="${status === 'excused' ? 'background:rgba(212,167,44,0.15); color:#e3b341; border-color:#e3b341;' : 'background:transparent; color:var(--text-secondary); border-color:var(--border-default);'} padding:4px 10px; border-radius:4px; border-width:1px; border-style:solid; font-size:12px; cursor:pointer;">Excused</button>
    </div>
  </td>
</tr>`
  }).join('')

  // Bind toggle buttons
  tbody.querySelectorAll<HTMLButtonElement>('[data-att-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const memberId = btn.dataset['attMember']!
      const newStatus = btn.dataset['attStatus'] as 'present' | 'absent' | 'excused'
      _state!.memberAtt[memberId] = newStatus
      _renderAttTable() // Simple re-render
    })
  })
}

function _saveAttendance(): void {
  if (!_state) return
  const att = _state.memberAtt
  const present = Object.values(att).filter(v => v === 'present').length
  const absent = Object.values(att).filter(v => v === 'absent').length
  const excused = Object.values(att).filter(v => v === 'excused').length
  const s = _state.attSessions.find(x => x.id === _state!.currentAttId)
  if (s) { s.present = present; s.absent = absent; s.excused = excused }
  _closeAttTable()
  _renderAttSessions()
  Toast.success('Attendance saved successfully.')
}

function _closeAttTable(): void {
  if (!_container) return
  const sessGrid = _container.querySelector<HTMLElement>('#sv-attSessionsGrid')
  const tableWrap = _container.querySelector<HTMLElement>('#sv-attTableWrap')
  if (sessGrid) sessGrid.style.display = 'grid'
  if (tableWrap) tableWrap.style.display = 'none'
}

function _bindAll(): void {
  if (!_container) return
  _container.querySelector('#sv-newSessionBtn')?.addEventListener('click', () => Toast.info('Would create a new session here.'))
  _container.querySelector('#sv-markAttBtn')?.addEventListener('click', () => Toast.info('Select a session below to begin marking attendance.'))
  _container.querySelector('#sv-closeAttTableBtn')?.addEventListener('click', _closeAttTable)
  _container.querySelector('#sv-saveAttendanceBtn')?.addEventListener('click', _saveAttendance)
}

const ServiceList: PageModule = {
  render: async (container: HTMLElement) => {
    _container = container
    _state = _buildInitialState()
    container.innerHTML = _buildHTML()
    
    _renderAttSessions()
    _bindAll()
  },
  destroy: () => {
    _container = null
    _state = null
  }
}
export default ServiceList
