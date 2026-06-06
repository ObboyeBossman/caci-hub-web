import { navigate } from '@core/router'

const CSS = /* css */`
/* ── Tab bar ────────────────────────────────────────────────────── */
.ml-tab-bar {
  display: inline-flex; align-items: center;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 999px; padding: 4px; gap: 2px;
  overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.08);
  max-width: 100%;
}
.ml-tab-bar::-webkit-scrollbar { display: none; }
.ml-tab-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; border-radius: 999px; border: none;
  background: transparent; color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  font-family: var(--font-sans); flex-shrink: 0;
}
.ml-tab-btn:hover:not(.active) { color: var(--text-primary); background: var(--bg-hover); }
.ml-tab-btn.active {
  background: var(--bg-page); color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06);
}
.ml-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; padding: 0 5px; border-radius: 99px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  font-size: 10.5px; font-weight: 600; color: var(--text-secondary);
}
.ml-tab-btn.active .ml-tab-count {
  background: rgba(0,75,160,0.1); border-color: rgba(0,75,160,0.25);
  color: var(--caci-blue);
}
`

function injectCSS(): void {
  if (document.getElementById('membership-tab-css')) return
  const s = document.createElement('style')
  s.id = 'membership-tab-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

export type MembershipTabKey = 'members' | 'groups' | 'pastoral' | 'reports' | 'audit'

export function renderMembershipTab(activeTab: MembershipTabKey, countMap?: { members?: number }): string {
  injectCSS()
  const membersCount = countMap?.members !== undefined ? countMap.members : '—'
  return /* html */`
    <!-- Unified Membership Tab Bar -->
    <div style="display:flex;justify-content:center;margin-bottom:20px;">
      <div class="ml-tab-bar membership-tab-bar">
        <button class="ml-tab-btn ${activeTab === 'members' ? 'active' : ''}" data-tab="members">
          <i class="bi bi-people-fill" style="font-size:15px;"></i>
          All Members
          <span class="ml-tab-count" id="ml-total-tab-count">${membersCount}</span>
        </button>
        <button class="ml-tab-btn ${activeTab === 'groups' ? 'active' : ''}" data-tab="groups">
          <i class="bi bi-diagram-3-fill" style="font-size:15px;"></i>
          Groups &amp; Units
        </button>
        <button class="ml-tab-btn ${activeTab === 'pastoral' ? 'active' : ''}" data-tab="pastoral">
          <i class="bi bi-heart-fill" style="font-size:15px;"></i>
          Pastoral Care
        </button>
        <button class="ml-tab-btn ${activeTab === 'reports' ? 'active' : ''}" data-tab="reports" style="display: none;">
          <i class="bi bi-bar-chart-fill" style="font-size:15px;"></i>
          Reports
        </button>
        <button class="ml-tab-btn ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit">
          <i class="bi bi-clock-history" style="font-size:15px;"></i>
          Audit Logs
        </button>
      </div>
    </div>
  `
}

export function bindMembershipTabEvents(container: HTMLElement | Document): void {
  container.querySelectorAll<HTMLElement>('.membership-tab-bar .ml-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.membership-tab-bar .ml-tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const tab = btn.dataset.tab
      if (tab === 'members')  navigate('/members')
      if (tab === 'groups')   navigate('/groups')
      if (tab === 'pastoral') navigate('/pastoral-care')
      if (tab === 'reports')  navigate('/reports')
      if (tab === 'audit')    navigate('/audit-logs')  // adjust path as needed later
    })
  })
}
