// src/modules/membership/pages/MyGroups.ts
// Member's view of their joined departments and age groups.
// Route: /my-groups  (auth only, no permission required)

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { renderSkeleton, renderError, renderEmpty } from '@shared/utils/pageHelpers'
import { listMemberGroups }  from '../groups.repository'
import { formatDate }        from '../../../shared/utils/format'
import type { MemberGroupWithGroup } from '../../../types/group.types'

// ── Cleanup ───────────────────────────────────────────────────────────────────
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
const CSS_ID = 'mg-css'
const CSS = /* css */`
.mg-wrap { padding: 20px 0 64px; display: flex; flex-direction: column; gap: 24px; animation: mg-fade 0.3s ease both; }
@keyframes mg-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.mg-section { display: flex; flex-direction: column; gap: 14px; }
.mg-section-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px; }

.mg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

.mg-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 14px; padding: 20px;
  display: flex; flex-direction: column; transition: box-shadow 0.18s, border-color 0.18s;
}
.mg-card:hover { border-color: var(--border-strong); box-shadow: 0 4px 14px rgba(0,0,0,0.06); }

.mg-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
.mg-group-name { font-size: 15px; font-weight: 600; color: var(--text-primary); line-height: 1.3; margin: 0; }
.mg-role-badge {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 4px 10px; border-radius: 99px; flex-shrink: 0;
  background: rgba(139,92,246,0.1); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.25);
}
.mg-role-badge.leader, .mg-role-badge.assistant_leader {
  background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25);
}

.mg-desc { font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px; flex: 1; }

.mg-meta {
  display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-muted);
  padding-top: 16px; border-top: 1px dashed var(--border-default);
}
.mg-meta i { font-size: 14px; }
`

function _formatRole(role: string): string {
  if (role === 'leader') return 'Leader'
  if (role === 'assistant_leader') return 'Asst. Leader'
  return 'Member'
}

function _renderGroupCard(g: MemberGroupWithGroup): string {
  const roleClass = (g.role === 'leader' || g.role === 'assistant_leader') ? 'leader' : ''
  const roleText = _formatRole(g.role)

  return /* html */`
    <div class="mg-card">
      <div class="mg-card-header">
        <h3 class="mg-group-name">${g.group_name}</h3>
        <div class="mg-role-badge ${roleClass}">${roleText}</div>
      </div>
      <div class="mg-desc">${g.description || 'No description available.'}</div>
      <div class="mg-meta">
        <i class="bi bi-calendar3"></i> Joined ${formatDate(g.joined_at)}
      </div>
    </div>
  `
}

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS
      document.head.appendChild(s)
    }

    renderSkeleton(container, 'card')

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

      const groups = await listMemberGroups(m.id!)

      if (groups.length === 0) {
        container.innerHTML = ''
        renderBreadcrumbs(container, [{ label: 'My Groups' }])
        renderEmpty(container, {
          icon: 'people',
          title: 'No Groups Yet',
          message: 'You are not part of any departments or age groups.',
          action: { label: 'Explore Groups', onClick: () => window.location.hash = '#/groups' }
        })
        return
      }

      const departments = groups.filter(g => g.group_type === 'department')
      const ageGroups = groups.filter(g => g.group_type === 'age_group')

      container.innerHTML = `
        <div class="mg-wrap">
          ${departments.length > 0 ? `
            <div class="mg-section">
              <h2 class="mg-section-title"><i class="bi bi-briefcase-fill" style="color:var(--caci-blue)"></i> Departments</h2>
              <div class="mg-grid">
                ${departments.map(_renderGroupCard).join('')}
              </div>
            </div>
          ` : ''}

          ${ageGroups.length > 0 ? `
            <div class="mg-section">
              <h2 class="mg-section-title"><i class="bi bi-people-fill" style="color:var(--caci-red)"></i> Age Groups</h2>
              <div class="mg-grid">
                ${ageGroups.map(_renderGroupCard).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'My Groups' }])

    } catch (err) {
      console.error('[MyGroups] load error:', err)
      renderError(container, err, { retry: () => this.render(container) })
    }
  },

  destroy() { _cleanup() },
} satisfies PageModule
