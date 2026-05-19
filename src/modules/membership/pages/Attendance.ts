// src/modules/membership/pages/Attendance.ts
// Attendance sessions listing page.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { injectMembershipCSS } from '../member-helpers'

interface AttSession { id: string; name: string; type: string; date: string; time: string; present: number; absent: number; excused: number }

// TODO: Replace with real backend attendance_sessions table when available
const MOCK_SESSIONS: AttSession[] = [
  { id:'s1', name:'Sunday Service',   type:'Sunday Service',  date:'May 18, 2025', time:'09:00', present:284, absent:28,  excused:12 },
  { id:'s2', name:'Mid-week Prayer',  type:'Prayer Meeting',  date:'May 14, 2025', time:'18:30', present:142, absent:170, excused:6  },
  { id:'s3', name:'Sunday Service',   type:'Sunday Service',  date:'May 11, 2025', time:'09:00', present:271, absent:41,  excused:8  },
  { id:'s4', name:'Youth Service',    type:'Youth Service',   date:'May 10, 2025', time:'15:00', present:68,  absent:12,  excused:4  },
  { id:'s5', name:'Sunday Service',   type:'Sunday Service',  date:'May 4, 2025',  time:'09:00', present:268, absent:44,  excused:10 },
]

const Attendance: PageModule = {
  async render(container) {
    injectMembershipCSS()

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:960px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Attendance</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);">Past sessions — click to view breakdown</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="att-recordBtn">Record Attendance</button>
      <button class="mm-btn-outline" onclick="history.back()">← Back</button>
    </div>
  </div>

  <div class="mm-att-session-grid" id="att-grid">
    ${MOCK_SESSIONS.map(s => {
      const total = s.present + s.absent + s.excused
      const pct = total ? Math.round(s.present / total * 100) : 0
      return `
<div class="mm-att-session-card" data-att-session="${s.id}" style="cursor:pointer;">
  <div class="mm-att-session-date">${s.date} · ${s.type}</div>
  <div class="mm-att-session-name">${s.name}</div>
  <div style="font-size:11px;color:var(--mm-text-muted);margin-bottom:8px;">${s.time}</div>
  <div class="mm-att-session-stats">
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-green)">${s.present}</div>
      <div class="mm-att-session-stat-lbl">Present</div>
    </div>
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-red)">${s.absent}</div>
      <div class="mm-att-session-stat-lbl">Absent</div>
    </div>
    <div class="mm-att-session-stat">
      <div class="mm-att-session-stat-val" style="color:var(--mm-gold)">${s.excused}</div>
      <div class="mm-att-session-stat-lbl">Excused</div>
    </div>
  </div>
  <div style="margin-top:10px;background:var(--mm-border);border-radius:4px;height:4px;">
    <div style="background:var(--mm-green);width:${pct}%;height:4px;border-radius:4px;"></div>
  </div>
  <div style="font-size:11px;color:var(--mm-text-muted);margin-top:4px;">${pct}% attendance rate</div>
</div>`}).join('')}
  </div>
</div>`

    container.querySelector('#att-recordBtn')?.addEventListener('click', () => navigate('/attendance/record'))

    container.querySelectorAll<HTMLElement>('[data-att-session]').forEach(card => {
      card.addEventListener('click', () => {
        const s = MOCK_SESSIONS.find(x => x.id === card.dataset['attSession'])
        if (s) Toast.info(`${s.name} (${s.date}) — detailed breakdown view coming soon.`)
      })
    })
  },

  destroy() {},
}

export default Attendance
