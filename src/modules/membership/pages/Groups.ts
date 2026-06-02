import type { PageModule } from '../../../types/module.types'
import type { Group, GroupMemberWithMember, GroupType, GroupMemberRole } from '../../../types/group.types'
import type { MemberView } from '../../../types/member.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { injectMembershipCSS } from '../utils/member-helpers'
import {
  listGroups,
  softDeleteGroup,
  listGroupMembers,
  assignGroupMember,
  removeGroupMember,
} from '../groups.repository'
import { listMembers } from '../repository'
import { on, off } from '@core/events'

// ── State ─────────────────────────────────────────────────────────────────────
let _groups:       Group[]                    = []
let _activeTab:    GroupType | 'all'          = 'all'
let _panelGroupId: string | null              = null
let _panelMembers: GroupMemberWithMember[]    = []
let _memberSearch: MemberView[]               = []
let _searchDebounce: ReturnType<typeof setTimeout> | null = null
type Listener = (...args: any[]) => void
let _listeners: Array<[string, Listener]>     = []

// ── Filtered view ─────────────────────────────────────────────────────────────
function filtered(): Group[] {
  if (_activeTab === 'all') return _groups
  return _groups.filter(g => g.group_type === _activeTab)
}

// ── Render helpers ────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<GroupType, string> = {
  department: 'Department',
  age_group:  'Age Group',
}

const ROLE_LABELS: Record<GroupMemberRole, string> = {
  leader:           'Leader',
  assistant_leader: 'Asst. Leader',
  member:           'Member',
}

function typeColor(t: GroupType): string {
  return t === 'department' ? '#0969da' : '#7c3aed'
}

function renderGrid(groups: Group[]): string {
  if (groups.length === 0) {
    return `
<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--mm-text-secondary);">
  <svg viewBox="0 0 24 24" width="48" height="48" style="opacity:.25;margin-bottom:16px;">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
  <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:4px;">No groups yet</div>
  <div style="font-size:var(--text-sm);">Click <strong>+ New Group</strong> to create your first group.</div>
</div>`
  }
  return groups.map(g => `
<div class="mm-group-card" data-grp-id="${g.id}">
  <div class="mm-group-icon">
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  </div>
  <div class="mm-group-name">${g.name}</div>
  <div class="mm-group-type">
    <span class="mm-badge" style="background:${typeColor(g.group_type)}20;color:${typeColor(g.group_type)};border-color:${typeColor(g.group_type)}40;">
      ${TYPE_LABELS[g.group_type]}
    </span>
  </div>
  ${g.description ? `<div style="font-size:var(--text-sm);color:var(--mm-text-secondary);margin:6px 0;">${g.description}</div>` : ''}
  <div class="mm-group-meta">
    <span><strong>${g.member_count}</strong> members</span>
    ${g.leader_name ? `<span>Leader: ${g.leader_name}</span>` : ''}
  </div>
  <div class="mm-group-actions">
    <button class="mm-btn-outline" style="flex:1;justify-content:center;font-size:var(--text-sm);"
      data-grp-view="${g.id}">View Members</button>
    <button class="mm-btn-icon" data-grp-edit="${g.id}" title="Edit">
      <svg viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
    <button class="mm-btn-icon" data-grp-del="${g.id}" title="Delete"
      style="color:var(--mm-danger,#e53e3e);border-color:var(--mm-danger,#e53e3e)40;">
      <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/></svg>
    </button>
  </div>
</div>`).join('')
}

function renderPanel(g: Group | undefined, members: GroupMemberWithMember[]): string {
  if (!g) return ''
  return `
<div id="grp-panel-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;" data-panel-close></div>
<div id="grp-panel" style="
  position:fixed;top:0;right:0;height:100%;width:min(420px,100%);
  background:var(--mm-bg-card);border-left:1px solid var(--mm-border);
  z-index:9999;overflow-y:auto;display:flex;flex-direction:column;
  box-shadow:-4px 0 24px rgba(0,0,0,.15);
">
  <div style="padding:24px 24px 16px;border-bottom:1px solid var(--mm-border);display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:var(--text-lg);font-weight:700;color:var(--mm-text-primary);">${g.name}</div>
      <div style="font-size:var(--text-sm);color:var(--mm-text-secondary);">${TYPE_LABELS[g.group_type]} · ${g.member_count} members</div>
    </div>
    <button class="mm-btn-icon" id="grp-panel-close" data-panel-close>
      <svg viewBox="0 0 24 24" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div style="padding:16px 24px;border-bottom:1px solid var(--mm-border);">
    <div style="font-size:var(--text-sm);font-weight:600;color:var(--mm-text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Add Member</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <input class="mm-form-input" id="grp-member-search" placeholder="Search members…" autocomplete="off">
      <div id="grp-search-results" style="display:none;background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:8px;max-height:160px;overflow-y:auto;"></div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select class="mm-form-select" id="grp-role-select" style="flex:1;">
          <option value="member">Member</option>
          <option value="assistant_leader">Asst. Leader</option>
          <option value="leader">Leader</option>
        </select>
        <button class="mm-btn-primary" id="grp-add-member-btn" disabled style="white-space:nowrap;">Add</button>
      </div>
      <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);" id="grp-selected-member-label"></div>
    </div>
  </div>

  <div style="flex:1;padding:16px 24px;overflow-y:auto;">
    <div style="font-size:var(--text-sm);font-weight:600;color:var(--mm-text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">
      Current Members (${members.length})
    </div>
    <div id="grp-member-list">
      ${members.length === 0 ? `
        <div style="text-align:center;padding:32px 0;color:var(--mm-text-secondary);font-size:var(--text-sm);">
          No members yet. Use the search above to add members.
        </div>` : members.map(m => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--mm-border);">
          <div style="width:36px;height:36px;border-radius:50%;background:#0969da22;color:#0969da;
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-sm);flex-shrink:0;">
            ${m.member_name.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:var(--text-sm);color:var(--mm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.member_name}</div>
            <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);">${ROLE_LABELS[m.role]}</div>
          </div>
          <button class="mm-btn-icon" data-grp-remove-member="${m.member_id}" title="Remove"
            style="color:var(--mm-danger,#e53e3e);border-color:var(--mm-danger,#e53e3e)30;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('')}
    </div>
  </div>
</div>`
}

// ── Page module ───────────────────────────────────────────────────────────────
const Groups: PageModule = {
  async render(container) {
    injectMembershipCSS()

    // ── Initial skeleton ───────────────────────────────────────────────────
    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:1100px;margin:0 auto;" id="grp-root">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:var(--text-2xl);font-weight:700;color:var(--mm-text-primary);">Groups & Units</h2>
      <div style="font-size:var(--text-base);color:var(--mm-text-secondary);" id="grp-subtitle">Loading…</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="grp-newBtn">+ New Group</button>
      <button class="mm-btn-outline" onclick="history.back()">← Back</button>
    </div>
  </div>

  <!-- Type filter tabs -->
  <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--mm-border);padding-bottom:0;">
    <button class="grp-tab ${_activeTab === 'all' ? 'active' : ''}" data-tab="all"
      style="padding:8px 18px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:var(--text-sm);font-weight:600;
             color:${_activeTab === 'all' ? 'var(--mm-accent)' : 'var(--mm-text-secondary)'};
             border-bottom:2px solid ${_activeTab === 'all' ? 'var(--mm-accent)' : 'transparent'};margin-bottom:-2px;transition:all .15s;">
      All
    </button>
    <button class="grp-tab ${_activeTab === 'department' ? 'active' : ''}" data-tab="department"
      style="padding:8px 18px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:var(--text-sm);font-weight:600;
             color:${_activeTab === 'department' ? 'var(--mm-accent)' : 'var(--mm-text-secondary)'};
             border-bottom:2px solid ${_activeTab === 'department' ? 'var(--mm-accent)' : 'transparent'};margin-bottom:-2px;transition:all .15s;">
      Departments
    </button>
    <button class="grp-tab ${_activeTab === 'age_group' ? 'active' : ''}" data-tab="age_group"
      style="padding:8px 18px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:var(--text-sm);font-weight:600;
             color:${_activeTab === 'age_group' ? 'var(--mm-accent)' : 'var(--mm-text-secondary)'};
             border-bottom:2px solid ${_activeTab === 'age_group' ? 'var(--mm-accent)' : 'transparent'};margin-bottom:-2px;transition:all .15s;">
      Age Groups
    </button>
  </div>

  <div id="grp-error" style="display:none;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;margin-bottom:16px;"></div>
  <div class="mm-groups-grid" id="grp-grid">
    <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--mm-text-secondary);">
      <div class="mm-spinner" style="margin:0 auto 12px;"></div>Loading groups…
    </div>
  </div>
  <div id="grp-panel-slot"></div>
</div>`

    // ── Event: New group ───────────────────────────────────────────────────
    container.querySelector('#grp-newBtn')?.addEventListener('click', () => navigate('/groups/new'))

    // ── Event: Type tabs ───────────────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.grp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = (btn.dataset['tab'] ?? 'all') as GroupType | 'all'
        refreshGrid()
        // Update tab styles
        container.querySelectorAll<HTMLElement>('.grp-tab').forEach(t => {
          const isActive = t.dataset['tab'] === _activeTab
          t.style.color       = isActive ? 'var(--mm-accent)' : 'var(--mm-text-secondary)'
          t.style.borderBottom = isActive ? '2px solid var(--mm-accent)' : '2px solid transparent'
        })
      })
    })

    // ── Load groups ────────────────────────────────────────────────────────
    await loadGroups()

    // ── Realtime refresh ───────────────────────────────────────────────────
    const _reload: Listener = () => void loadGroups()
    on('group:updated', _reload)
    on('group:created', _reload)
    on('group:deleted', _reload)
    _listeners = [['group:updated', _reload], ['group:created', _reload], ['group:deleted', _reload]]

    // ── Helper: load & refresh ─────────────────────────────────────────────
    async function loadGroups() {
      try {
        _groups = await listGroups()
        refreshGrid()
        const sub = container.querySelector('#grp-subtitle')
        if (sub) sub.textContent = `${_groups.length} group${_groups.length !== 1 ? 's' : ''}`
        const errEl = container.querySelector<HTMLElement>('#grp-error')
        if (errEl) errEl.style.display = 'none'
      } catch (err: any) {
        const errEl = container.querySelector<HTMLElement>('#grp-error')
        if (errEl) { errEl.textContent = err.message ?? 'Failed to load groups.'; errEl.style.display = 'block' }
      }
    }

    function refreshGrid() {
      const grid = container.querySelector('#grp-grid')
      if (!grid) return
      grid.innerHTML = renderGrid(filtered())
      bindGridEvents()
    }

    function bindGridEvents() {
      // View Members
      container.querySelectorAll<HTMLElement>('[data-grp-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset['grpView']!
          const g  = _groups.find(x => x.id === id)
          if (!g) return
          await openPanel(g)
        })
      })

      // Edit
      container.querySelectorAll<HTMLElement>('[data-grp-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate(`/groups/${btn.dataset['grpEdit']}/edit`)
        })
      })

      // Delete
      container.querySelectorAll<HTMLElement>('[data-grp-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id   = btn.dataset['grpDel']!
          const name = _groups.find(g => g.id === id)?.name ?? 'this group'
          if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
          try {
            await softDeleteGroup(id)
            Toast.success('Group deleted.')
            await loadGroups()
          } catch (err: any) {
            Toast.error(err.message ?? 'Failed to delete group.')
          }
        })
      })
    }

    // ── Panel helpers ──────────────────────────────────────────────────────
    async function openPanel(g: Group) {
      _panelGroupId = g.id
      const slot = container.querySelector('#grp-panel-slot')
      if (!slot) return

      // Show loading state immediately
      slot.innerHTML = renderPanel(g, [])
      bindPanelEvents(g)

      try {
        _panelMembers = await listGroupMembers(g.id)
        const listEl = slot.querySelector('#grp-member-list')
        if (listEl) {
          listEl.innerHTML = _panelMembers.length === 0
            ? `<div style="text-align:center;padding:32px 0;color:var(--mm-text-secondary);font-size:var(--text-sm);">No members yet.</div>`
            : _panelMembers.map(m => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--mm-border);">
                <div style="width:36px;height:36px;border-radius:50%;background:#0969da22;color:#0969da;
                  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-sm);flex-shrink:0;">
                  ${m.member_name.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:var(--text-sm);color:var(--mm-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.member_name}</div>
                  <div style="font-size:var(--text-xs);color:var(--mm-text-secondary);">${ROLE_LABELS[m.role]}</div>
                </div>
                <button class="mm-btn-icon" data-grp-remove-member="${m.member_id}" title="Remove"
                  style="color:var(--mm-danger,#e53e3e);border-color:var(--mm-danger,#e53e3e)30;flex-shrink:0;">
                  <svg viewBox="0 0 24 24" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`).join('')
          bindRemoveButtons(g)
        }
      } catch (err: any) {
        Toast.error(err.message ?? 'Failed to load group members.')
      }
    }

    function bindPanelEvents(g: Group) {
      const slot = container.querySelector('#grp-panel-slot')
      if (!slot) return

      // Close handlers
      slot.querySelectorAll<HTMLElement>('[data-panel-close]').forEach(el => {
        el.addEventListener('click', closePanel)
      })

      // Member search
      let _selectedMemberId: string | null = null
      const searchInput = slot.querySelector<HTMLInputElement>('#grp-member-search')
      const resultsEl   = slot.querySelector<HTMLElement>('#grp-search-results')
      const addBtn      = slot.querySelector<HTMLButtonElement>('#grp-add-member-btn')
      const labelEl     = slot.querySelector<HTMLElement>('#grp-selected-member-label')

      searchInput?.addEventListener('input', () => {
        const q = searchInput.value.trim()
        _selectedMemberId = null
        if (addBtn) addBtn.disabled = true
        if (labelEl) labelEl.textContent = ''

        if (_searchDebounce) clearTimeout(_searchDebounce)
        if (!q) {
          if (resultsEl) resultsEl.style.display = 'none'
          return
        }
        _searchDebounce = setTimeout(async () => {
          try {
            _memberSearch = await listMembers({ searchQuery: q }, { limit: 8 })
            if (!resultsEl) return
            if (_memberSearch.length === 0) {
              resultsEl.innerHTML = `<div style="padding:10px 12px;color:var(--mm-text-secondary);font-size:var(--text-sm);">No members found.</div>`
            } else {
              resultsEl.innerHTML = _memberSearch.map(m => `
                <div class="grp-search-item" data-mid="${m.id}" style="
                  padding:9px 12px;cursor:pointer;font-size:var(--text-sm);
                  border-bottom:1px solid var(--mm-border);transition:background .1s;">
                  <span style="font-weight:600;">${m.first_name} ${m.last_name}</span>
                  <span style="color:var(--mm-text-secondary);margin-left:6px;">${m.membership_status}</span>
                </div>`).join('')
              resultsEl.querySelectorAll<HTMLElement>('.grp-search-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--mm-bg-hover,rgba(0,0,0,.05))')
                item.addEventListener('mouseleave', () => item.style.background = '')
                item.addEventListener('click', () => {
                  const mid = item.dataset['mid']!
                  const member = _memberSearch.find(x => x.id === mid)
                  if (!member) return
                  _selectedMemberId = mid
                  if (searchInput) searchInput.value = `${member.first_name} ${member.last_name}`
                  if (resultsEl) resultsEl.style.display = 'none'
                  if (addBtn) addBtn.disabled = false
                  if (labelEl) labelEl.textContent = `Selected: ${member.first_name} ${member.last_name}`
                })
              })
            }
            resultsEl.style.display = 'block'
          } catch {
            // silent
          }
        }, 300)
      })

      // Add member
      addBtn?.addEventListener('click', async () => {
        if (!_selectedMemberId) return
        const role = (slot.querySelector<HTMLSelectElement>('#grp-role-select')?.value ?? 'member') as GroupMemberRole
        try {
          if (addBtn) addBtn.disabled = true
          await assignGroupMember(g.id, _selectedMemberId, role)
          Toast.success('Member added to group.')
          // Reset search
          if (searchInput) searchInput.value = ''
          if (resultsEl) resultsEl.style.display = 'none'
          if (labelEl) labelEl.textContent = ''
          _selectedMemberId = null
          // Reload panel
          await openPanel({ ..._groups.find(x => x.id === g.id)!, member_count: _panelMembers.length + 1 })
          await loadGroups()
        } catch (err: any) {
          Toast.error(err.message ?? 'Failed to add member.')
          if (addBtn) addBtn.disabled = false
        }
      })

      bindRemoveButtons(g)
    }

    function bindRemoveButtons(g: Group) {
      const slot = container.querySelector('#grp-panel-slot')
      if (!slot) return
      slot.querySelectorAll<HTMLElement>('[data-grp-remove-member]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const memberId = btn.dataset['grpRemoveMember']!
          const name = _panelMembers.find(m => m.member_id === memberId)?.member_name ?? 'this member'
          if (!confirm(`Remove ${name} from the group?`)) return
          try {
            await removeGroupMember(g.id, memberId)
            Toast.success('Member removed.')
            await openPanel({ ..._groups.find(x => x.id === g.id)!, member_count: _panelMembers.length - 1 })
            await loadGroups()
          } catch (err: any) {
            Toast.error(err.message ?? 'Failed to remove member.')
          }
        })
      })
    }

    function closePanel() {
      _panelGroupId = null
      _panelMembers = []
      const slot = container.querySelector('#grp-panel-slot')
      if (slot) slot.innerHTML = ''
    }
  },

  destroy() {
    _listeners.forEach(([event, fn]) => off(event, fn))
    _listeners    = []
    _groups       = []
    _panelGroupId = null
    _panelMembers = []
    _memberSearch = []
    _activeTab    = 'all'
    if (_searchDebounce) clearTimeout(_searchDebounce)
  },
}

export default Groups
