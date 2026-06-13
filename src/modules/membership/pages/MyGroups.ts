import { supabase } from '@core/supabase'
import { getCurrentUser } from '@core/auth'
import { formatDate } from '../../../shared/utils/format'
import { renderSkeleton, renderEmpty, renderError } from '../../../shared/utils/pageHelpers'
import { listMemberGroups } from '../groups.repository'
import type { MemberGroupWithGroup } from '../../../types/group.types'

const CSS = /* css */ `
.mg-wrap {
  padding: var(--sp-x2l);
  max-width: 900px;
  margin: 0 auto;
  animation: mg-fade-up 0.4s cubic-bezier(0.175,0.885,0.32,1.1) both;
}
@keyframes mg-fade-up {
  from { opacity: 0; transform: translateY(15px); }
  to   { opacity: 1; transform: translateY(0); }
}

.mg-header { margin-bottom: var(--sp-x2l); }
.mg-title { 
  font-size: 1.75rem; font-weight: 700; color: var(--text-primary); 
  margin-bottom: 8px; letter-spacing: -0.01em; 
}
.mg-subtitle { font-size: 1rem; color: var(--text-secondary); }

.mg-section { margin-top: var(--sp-x2l); }
.mg-section-title { 
  font-size: 1.125rem; font-weight: 600; color: var(--text-primary); 
  margin-bottom: var(--sp-md); display: flex; align-items: center; gap: 8px;
}

.mg-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
  gap: var(--sp-lg); 
}

.mg-card { 
  background: var(--bg-card); 
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); 
  padding: var(--sp-xl);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column;
}
.mg-card:hover { 
  transform: translateY(-3px); 
  box-shadow: 0 12px 32px rgba(0,0,0,0.08); 
  border-color: color-mix(in srgb, var(--caci-blue) 40%, transparent);
}

.mg-card-header { 
  display: flex; justify-content: space-between; align-items: flex-start; 
  margin-bottom: 12px;
}
.mg-group-name { 
  font-size: 1.125rem; font-weight: 600; color: var(--text-primary); 
  line-height: 1.3;
}
.mg-role-badge { 
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 4px 8px; border-radius: 9999px; 
  background: color-mix(in srgb, var(--caci-blue) 12%, transparent); 
  color: var(--caci-blue);
  flex-shrink: 0; margin-left: 12px;
}
.mg-role-badge.leader, .mg-role-badge.assistant_leader { 
  background: color-mix(in srgb, var(--caci-red) 12%, transparent); 
  color: var(--caci-red); 
}

.mg-desc { 
  font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 20px; 
  line-height: 1.5; flex: 1;
}

.mg-meta { 
  display: flex; align-items: center; gap: 6px; 
  font-size: 0.8125rem; color: var(--text-tertiary);
  padding-top: 16px; border-top: 1px dashed var(--border-default);
}
.mg-meta i { font-size: 0.9375rem; }
`

function _injectCSS() {
  if (document.getElementById('caci-my-groups-css')) return
  const style = document.createElement('style')
  style.id = 'caci-my-groups-css'
  style.textContent = CSS
  document.head.appendChild(style)
}

function _formatRole(role: string): string {
  if (role === 'leader') return 'Leader'
  if (role === 'assistant_leader') return 'Asst. Leader'
  return 'Member'
}

function _renderGroupCard(g: MemberGroupWithGroup): string {
  const roleClass = g.role === 'leader' || g.role === 'assistant_leader' ? 'leader' : ''
  const roleText = _formatRole(g.role)
  
  return /* html */`
    <div class="mg-card">
      <div class="mg-card-header">
        <div class="mg-group-name">${g.group_name}</div>
        <div class="mg-role-badge ${roleClass}">${roleText}</div>
      </div>
      <div class="mg-desc">${g.description || 'No description available for this group.'}</div>
      <div class="mg-meta">
        <i class="bi bi-calendar3"></i> Joined ${formatDate(g.joined_at)}
      </div>
    </div>
  `
}

const MyGroups = {
  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    renderSkeleton(container, 'card')

    try {
      const user = getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch member mapping
      const { data: m, error: mErr } = await supabase
        .from('members_view')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
        
      if (mErr) throw mErr
      if (!m) {
        return renderEmpty(container, {
          icon: 'person-exclamation',
          title: 'Profile Not Found',
          message: 'Your account is not linked to a member profile.',
          action: { label: 'Go to Home', onClick: () => window.location.hash = '/home' }
        })
      }

      const groups = await listMemberGroups(m.id!)

      if (groups.length === 0) {
        return renderEmpty(container, {
          icon: 'people',
          title: 'No Groups Yet',
          message: 'You are not part of any departments or age groups.',
          action: { label: 'Explore Groups', onClick: () => window.location.hash = '/groups' } // Assuming there's a group catalog route
        })
      }

      const departments = groups.filter(g => g.group_type === 'department')
      const ageGroups = groups.filter(g => g.group_type === 'age_group')

      container.innerHTML = /* html */`
        <div class="mg-wrap">
          <div class="mg-header">
            <h1 class="mg-title">My Groups</h1>
            <div class="mg-subtitle">View the departments and age groups you belong to.</div>
          </div>

          ${departments.length > 0 ? /* html */`
            <div class="mg-section">
              <h2 class="mg-section-title"><i class="bi bi-briefcase-fill" style="color:var(--caci-blue)"></i> Departments</h2>
              <div class="mg-grid">
                ${departments.map(_renderGroupCard).join('')}
              </div>
            </div>
          ` : ''}

          ${ageGroups.length > 0 ? /* html */`
            <div class="mg-section">
              <h2 class="mg-section-title"><i class="bi bi-people-fill" style="color:var(--caci-red)"></i> Age Groups</h2>
              <div class="mg-grid">
                ${ageGroups.map(_renderGroupCard).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `

    } catch (err) {
      renderError(container, err)
    }
  },

  dispose(): void {
    // Nothing to dispose
  }
}

export default MyGroups

