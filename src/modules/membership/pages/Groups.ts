// src/modules/membership/pages/Groups.ts
// Groups & Units listing page.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { injectMembershipCSS } from '../member-helpers'

interface Group { id: string; name: string; type: string; leader: string; members: number; day: string; desc: string }

// TODO: Replace with real backend groups table when available
const MOCK_GROUPS: Group[] = [
  { id:'g1', name:'Worship Team',       type:'Department', leader:'Ama Osei',       members:24, day:'Sunday',    desc:'Leads congregational worship.' },
  { id:'g2', name:'Ushers',             type:'Department', leader:'Nana Adjei',     members:18, day:'Sunday',    desc:'Manages seating and reception.' },
  { id:'g3', name:"Men's Fellowship",   type:'Fellowship', leader:'Kwame Mensah',   members:98, day:'Saturday',  desc:'Monthly fellowship for men.' },
  { id:'g4', name:"Women's Fellowship", type:'Fellowship', leader:'Ama Osei',       members:112,day:'Saturday',  desc:'Monthly fellowship for women.' },
  { id:'g5', name:'Youth Ministry',     type:'Ministry',   leader:'Efua Mensah',    members:72, day:'Saturday',  desc:'Weekly youth meetings.' },
  { id:'g6', name:"Children's Ministry",type:'Ministry',   leader:'Grace Amponsah', members:55, day:'Sunday',    desc:'Sunday school and holiday programs.' },
  { id:'g7', name:'Admin Committee',    type:'Committee',  leader:'Grace Amponsah', members:8,  day:'Wednesday', desc:'Records and administrative coordination.' },
  { id:'g8', name:'Couples Fellowship', type:'Fellowship', leader:'Kwame Mensah',   members:34, day:'',          desc:'Monthly meetings for married couples.' },
  { id:'g9', name:'Evangelism Team',    type:'Ministry',   leader:'Emmanuel Asante',members:15, day:'',          desc:'Outreach and community engagement.' },
]

const Groups: PageModule = {
  async render(container) {
    injectMembershipCSS()

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:1000px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Groups & Units</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);">${MOCK_GROUPS.length} groups</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="grp-newBtn">+ New Group</button>
      <button class="mm-btn-outline" onclick="history.back()">← Back</button>
    </div>
  </div>

  <div class="mm-groups-grid" id="grp-grid">
    ${MOCK_GROUPS.map(g => `
<div class="mm-group-card">
  <div class="mm-group-icon">
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  </div>
  <div class="mm-group-name">${g.name}</div>
  <div class="mm-group-type"><span class="mm-badge">${g.type}</span></div>
  <div style="font-size:12px;color:var(--mm-text-secondary);margin:6px 0;">${g.desc}</div>
  <div class="mm-group-meta">
    <span>${g.members} members</span>
    ${g.day ? `<span>${g.day}s</span>` : ''}
    <span>Leader: ${g.leader}</span>
  </div>
  <div class="mm-group-actions">
    <button class="mm-btn-outline" style="flex:1;justify-content:center;font-size:12px;"
      data-grp-view="${g.id}">View Members</button>
    <button class="mm-btn-icon" data-grp-edit="${g.id}" title="Edit">
      <svg viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  </div>
</div>`).join('')}
  </div>
</div>`

    container.querySelector('#grp-newBtn')?.addEventListener('click', () => navigate('/groups/new'))

    container.querySelectorAll<HTMLElement>('[data-grp-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = MOCK_GROUPS.find(x => x.id === btn.dataset['grpView'])
        Toast.info(`${g?.name ?? 'Group'} member list — coming soon.`)
      })
    })

    container.querySelectorAll<HTMLElement>('[data-grp-edit]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/groups/new?id=${btn.dataset['grpEdit']}`))
    })
  },

  destroy() {},
}

export default Groups
