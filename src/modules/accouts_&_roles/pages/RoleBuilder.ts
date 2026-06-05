// src/modules/admin/pages/RoleBuilder.ts
// Admin page: Create and edit assembly-scoped roles and their permissions.
//
// Features:
//   - List all roles for the current assembly
//   - Create new roles
//   - Assign permissions grouped by module → category
//   - Only shows is_assignable = true permissions (backend also validates)
//   - Only admin may access this page (guarded by permission: admin.users.manage)
//
// NOTE: Uses `as any` for DB queries against system_permissions and
//       role_permissions until database.types is regenerated after migrations.

import type { PageModule }   from '../../../types/module.types'
import { supabase }          from '@core/supabase'
import { getCurrentUser }    from '@core/auth'
import { Toast }             from '@shared/components/Toast'

interface SystemPermission {
  key:           string
  label:         string
  description:   string | null
  module_name:   string
  category:      string
  is_assignable: boolean
}

interface AssemblyRole {
  id:          string
  name:        string
  description: string | null
  is_active:   boolean
  permissions: string[]  // permission keys assigned to this role
}

// ── State ─────────────────────────────────────────────────────────────────────

let _roles: AssemblyRole[] = []
let _allPermissions: SystemPermission[] = []
let _editingRole: AssemblyRole | null = null
let _isCreating = false
let _saving = false

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadRoles(assemblyId: string): Promise<void> {
  const { data: roles, error } = await (supabase as any)
    .from('assembly_roles')
    .select('id, name, description, is_active')
    .eq('assembly_id', assemblyId)
    .order('name')

  if (error) { Toast.error('Failed to load roles'); return }

  const roleIds = (roles ?? []).map((r: any) => r.id)
  const permMap: Record<string, string[]> = {}

  if (roleIds.length > 0) {
    // `as any` — role_permissions.permission_key column added in migration 000002
    // but database.types hasn't been re-generated yet
    const { data: rp } = await (supabase as any)
      .from('role_permissions')
      .select('role_id, permission_key')
      .in('role_id', roleIds)

    for (const row of (rp ?? []) as { role_id: string; permission_key: string }[]) {
      if (!permMap[row.role_id]) permMap[row.role_id] = []
      permMap[row.role_id].push(row.permission_key)
    }
  }

  _roles = (roles ?? []).map((r: any) => ({
    ...r,
    is_active:   (r as any).is_active ?? true,
    permissions: permMap[r.id] ?? [],
  }))
}

async function loadPermissions(): Promise<void> {
  // `as any` — system_permissions table added in migration 000001
  const { data, error } = await (supabase as any)
    .from('system_permissions')
    .select('key, label, description, module_name, category, is_assignable')
    .eq('is_assignable', true)
    .eq('is_active', true)
    .order('module_name')
    .order('category')
    .order('key')

  if (error) { Toast.error('Failed to load permissions'); return }
  _allPermissions = (data ?? []) as SystemPermission[]
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveRole(
  assemblyId: string,
  roleId: string | null,
  name: string,
  description: string,
  selectedPerms: string[]
): Promise<boolean> {
  if (!name.trim()) { Toast.error('Role name is required'); return false }
  _saving = true

  let resolvedRoleId = roleId

  if (!roleId) {
    // `as any` — is_active column added in migration 000003
    const { data: newRole, error: createErr } = await supabase
      .from('assembly_roles')
      .insert({ assembly_id: assemblyId, name: name.trim(), description: description.trim() || null } as any)
      .select('id')
      .single()

    if (createErr || !newRole) {
      Toast.error(createErr?.message ?? 'Failed to create role')
      _saving = false; return false
    }
    resolvedRoleId = (newRole as any).id
  } else {
    const { error: updateErr } = await supabase
      .from('assembly_roles')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', roleId)

    if (updateErr) { Toast.error(updateErr.message); _saving = false; return false }

    // Clear existing permissions
    await (supabase as any).from('role_permissions').delete().eq('role_id', roleId)
  }

  if (selectedPerms.length > 0) {
    const rows = selectedPerms.map(key => ({ role_id: resolvedRoleId!, permission_key: key }))
    const { error: permErr } = await (supabase as any).from('role_permissions').insert(rows)
    if (permErr) { Toast.error(permErr.message); _saving = false; return false }
  }

  _saving = false
  Toast.success(roleId ? 'Role updated' : 'Role created')
  return true
}

async function toggleRoleActive(roleId: string, current: boolean): Promise<void> {
  const { error } = await supabase
    .from('assembly_roles')
    .update({ is_active: !current } as any)
    .eq('id', roleId)

  if (error) { Toast.error(error.message); return }
  Toast.success(!current ? 'Role activated' : 'Role deactivated')
}

// ── Render helpers ────────────────────────────────────────────────────────────

function groupPermissions(): Record<string, Record<string, SystemPermission[]>> {
  const grouped: Record<string, Record<string, SystemPermission[]>> = {}
  for (const p of _allPermissions) {
    if (!grouped[p.module_name]) grouped[p.module_name] = {}
    if (!grouped[p.module_name][p.category]) grouped[p.module_name][p.category] = []
    grouped[p.module_name][p.category].push(p)
  }
  return grouped
}

function renderPermissionGroups(selected: Set<string>): string {
  const groups = groupPermissions()
  return Object.entries(groups).map(([moduleName, categories]) => `
    <div class="perm-module">
      <div class="perm-module-header">
        <span class="perm-module-name">${moduleName}</span>
      </div>
      ${Object.entries(categories).map(([category, perms]) => `
        <div class="perm-category">
          <div class="perm-category-header">
            <label class="perm-category-select-all">
              <input type="checkbox" class="perm-category-cb"
                data-module="${moduleName}" data-category="${category}"
                ${perms.every(p => selected.has(p.key)) ? 'checked' : ''} />
              <span>${category}</span>
            </label>
          </div>
          <div class="perm-items">
            ${perms.map(p => `
              <label class="perm-item ${!p.is_assignable ? 'perm-item--locked' : ''}">
                <input type="checkbox" class="perm-cb" data-key="${p.key}"
                  ${selected.has(p.key) ? 'checked' : ''}
                  ${!p.is_assignable ? 'disabled' : ''} />
                <div class="perm-item-info">
                  <span class="perm-item-label">${p.label}</span>
                  ${p.description ? `<span class="perm-item-desc">${p.description}</span>` : ''}
                </div>
              </label>`).join('')}
          </div>
        </div>`).join('')}
    </div>`).join('')
}

function renderRoleForm(role: Omit<AssemblyRole, 'permissions'> | null, selected: Set<string>): string {
  const isNew = !role
  return `
    <div class="role-form card">
      <div class="role-form-header">
        <h3>${isNew ? 'New Role' : 'Edit Role'}</h3>
        <button class="btn btn--ghost btn--sm" id="role-form-cancel">Cancel</button>
      </div>
      <div class="role-form-fields">
        <div class="form-group">
          <label class="form-label" for="role-name">Role Name <span class="required">*</span></label>
          <input id="role-name" class="form-control" type="text"
            placeholder="e.g. Secretary, Treasurer, Choir Leader"
            value="${role?.name ?? ''}" maxlength="64" />
        </div>
        <div class="form-group">
          <label class="form-label" for="role-desc">Description</label>
          <input id="role-desc" class="form-control" type="text"
            placeholder="Optional description" value="${role?.description ?? ''}" />
        </div>
      </div>
      <div class="perm-section">
        <div class="perm-section-header">
          <span class="perm-section-title">Permissions</span>
          <span class="perm-count" id="perm-count">${selected.size} selected</span>
        </div>
        <div class="perm-groups" id="perm-groups">${renderPermissionGroups(selected)}</div>
      </div>
      <div class="role-form-actions">
        <button class="btn btn--ghost btn--sm" id="role-form-cancel-2">Cancel</button>
        <button class="btn btn--primary" id="role-form-save" ${_saving ? 'disabled' : ''}>
          ${_saving ? '<span class="spinner"></span> Saving…' : isNew ? 'Create Role' : 'Save Changes'}
        </button>
      </div>
    </div>`
}

function renderRoleCard(role: AssemblyRole): string {
  return `
    <div class="role-card ${!role.is_active ? 'role-card--inactive' : ''}" data-role-id="${role.id}">
      <div class="role-card-header">
        <div class="role-card-info">
          <span class="role-card-name">${role.name}</span>
          ${!role.is_active ? '<span class="badge badge--warning">Inactive</span>' : ''}
        </div>
        <div class="role-card-actions">
          <button class="rm-edit-btn" data-action="edit" data-role-id="${role.id}">Edit</button>
          <button class="rm-deactivate-btn"
            data-action="toggle" data-role-id="${role.id}" data-active="${role.is_active}">
            ${role.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
      ${role.description ? `<p class="role-card-desc">${role.description}</p>` : ''}
      <div class="role-card-perms">
        ${role.permissions.length === 0
          ? '<span class="role-no-perms">No permissions assigned</span>'
          : role.permissions.map(k => `<span class="perm-badge">${k}</span>`).join('')}
      </div>
    </div>`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `<style>
.role-builder { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
.role-builder-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; }
.role-builder-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.role-builder-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem; }
.btn-new-role { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem; padding: 0.5rem 0; font-weight: 500; transition: color 0.15s; }
.btn-new-role:hover { color: var(--text-primary); }
.role-list { display: flex; flex-direction: column; }
.role-card { padding: 1.5rem 0; border-bottom: 1px solid var(--border-default); transition: opacity 0.15s; }
.role-card:last-child { border-bottom: none; }
.role-card--inactive { opacity: 0.6; }
.role-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.role-card-info { display: flex; align-items: center; gap: 0.75rem; }
.role-card-name { font-weight: 600; font-size: 1.05rem; color: var(--text-primary); }
.role-card-actions { display: flex; gap: 1.25rem; flex-shrink: 0; align-items: center; }
.rm-edit-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.88rem; padding: 0; }
.rm-edit-btn:hover { color: var(--text-primary); }
.rm-deactivate-btn { background: transparent; border: none; color: var(--text-danger); cursor: pointer; font-size: 0.88rem; padding: 0; }
.rm-deactivate-btn:hover { filter: brightness(1.2); }
.role-card-desc { font-size: 0.88rem; color: var(--text-muted); margin: 0 0 1.25rem; }
.role-card-perms { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.role-no-perms { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
.perm-badge { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; background: var(--bg-hover); color: var(--text-secondary); border: 1px solid var(--border-default); font-family: var(--font-mono); }

/* Overrides strictly for GitHub-style dark mode */
[data-theme="dark"] .role-builder-subtitle { color: #8b949e; }
[data-theme="dark"] .btn-new-role { color: #8b949e; }
[data-theme="dark"] .btn-new-role:hover { color: #c9d1d9; }
[data-theme="dark"] .role-card { border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="dark"] .rm-edit-btn { color: #8b949e; }
[data-theme="dark"] .rm-edit-btn:hover { color: #c9d1d9; }
[data-theme="dark"] .role-card-desc { color: #8b949e; }
[data-theme="dark"] .role-no-perms { color: #8b949e; }
[data-theme="dark"] .perm-badge { background: rgba(110, 118, 129, 0.1); color: #8b949e; border: none; }
[data-theme="dark"] .form-control { background-color: var(--bg-input); border-color: var(--border-default); color: var(--text-primary); }
[data-theme="dark"] .form-control::placeholder { color: var(--text-placeholder); }
[data-theme="dark"] .perm-category-select-all { color: var(--text-primary); }
[data-theme="dark"] .perm-item-label { color: var(--text-primary); }
[data-theme="dark"] .perm-item-desc { color: var(--text-muted); }
[data-theme="dark"] .role-form { background: var(--bg-card); border-color: var(--border-default); }
[data-theme="dark"] .role-form-header h3 { color: var(--text-primary); }
[data-theme="dark"] .form-label { color: var(--text-primary); }
[data-theme="dark"] .perm-section-title { color: var(--text-primary); }
.role-form { padding: 1.5rem; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border); margin-bottom: 2rem; }
.role-form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.role-form-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; }
.role-form-fields { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; margin-bottom: 1.5rem; }
@media (max-width: 600px) { .role-form-fields { grid-template-columns: 1fr; } }
.role-form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.perm-section { border-top: 1px solid var(--border); padding-top: 1.25rem; }
.perm-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.perm-section-title { font-weight: 600; font-size: 0.95rem; }
.perm-count { font-size: 0.82rem; color: var(--accent); font-weight: 500; }
.perm-module { margin-bottom: 1.25rem; }
.perm-module-header { margin-bottom: 0.5rem; }
.perm-module-name { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.perm-category { margin-bottom: 0.75rem; padding-left: 0.5rem; border-left: 2px solid var(--border); }
.perm-category-header { margin-bottom: 0.4rem; }
.perm-category-select-all { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--text); }
.perm-items { display: flex; flex-direction: column; gap: 0.35rem; padding-left: 1.25rem; }
.perm-item { display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer; padding: 0.35rem 0; }
.perm-item--locked { opacity: 0.5; cursor: not-allowed; }
.perm-item-info { display: flex; flex-direction: column; gap: 0.1rem; }
.perm-item-label { font-size: 0.88rem; color: var(--text); font-weight: 500; }
.perm-item-desc { font-size: 0.78rem; color: var(--text-muted); }
.empty-roles { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }
.empty-roles-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.4; }
.empty-roles-text { font-size: 0.95rem; }
.btn--danger-ghost { color: var(--danger, #e53e3e); }
.btn--danger-ghost:hover { background: rgba(229,62,62,0.08); }
</style>`

// ── Render ────────────────────────────────────────────────────────────────────

function renderPage(container: HTMLElement, assemblyId: string): void {
  const selected = new Set<string>(_isCreating ? [] : (_editingRole?.permissions ?? []))

  let html = STYLES + `
    <div class="role-builder">
      <div class="role-builder-header">
        <div>
          <h1 class="role-builder-title">Roles</h1>
          <p class="role-builder-subtitle">Create custom roles and assign permissions for your assembly members.</p>
        </div>
        ${!_editingRole && !_isCreating ? `<button class="btn-new-role" id="new-role-btn">+ New Role</button>` : ''}
      </div>`

  if (_editingRole || _isCreating) html += renderRoleForm(_editingRole, selected)

  if (_roles.length === 0 && !_isCreating) {
    html += `<div class="empty-roles">
      <div class="empty-roles-icon">🔑</div>
      <p class="empty-roles-text">No roles yet. Create a role to define custom permissions for your assembly members.</p>
    </div>`
  } else {
    html += `<div class="role-list">${_roles.map(renderRoleCard).join('')}</div>`
  }

  html += '</div>'
  container.innerHTML = html
  bindEvents(container, assemblyId)
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents(container: HTMLElement, assemblyId: string): void {
  container.querySelector('#new-role-btn')?.addEventListener('click', () => {
    _isCreating = true; _editingRole = null; renderPage(container, assemblyId)
  })

  const cancelFn = () => { _isCreating = false; _editingRole = null; renderPage(container, assemblyId) }
  container.querySelector('#role-form-cancel')?.addEventListener('click', cancelFn)
  container.querySelector('#role-form-cancel-2')?.addEventListener('click', cancelFn)

  container.querySelector('#role-form-save')?.addEventListener('click', async () => {
    const name = (container.querySelector<HTMLInputElement>('#role-name'))?.value ?? ''
    const desc = (container.querySelector<HTMLInputElement>('#role-desc'))?.value ?? ''
    const selected = getSelectedPerms(container)
    const ok = await saveRole(assemblyId, _editingRole?.id ?? null, name, desc, selected)
    if (ok) {
      _isCreating = false; _editingRole = null
      await loadRoles(assemblyId)
      renderPage(container, assemblyId)
    }
  })

  container.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset['action']!
      const roleId = btn.dataset['roleId']!
      if (action === 'edit') {
        _editingRole = _roles.find(r => r.id === roleId) ?? null
        _isCreating  = false
        renderPage(container, assemblyId)
      }
      if (action === 'toggle') {
        const current = btn.dataset['active'] === 'true'
        await toggleRoleActive(roleId, current)
        await loadRoles(assemblyId)
        renderPage(container, assemblyId)
      }
    })
  })

  container.querySelectorAll<HTMLInputElement>('.perm-cb').forEach(cb => {
    cb.addEventListener('change', () => updatePermCount(container))
  })

  container.querySelectorAll<HTMLInputElement>('.perm-category-cb').forEach(catCb => {
    catCb.addEventListener('change', () => {
      const mod = catCb.dataset['module']!
      const cat = catCb.dataset['category']!
      container.querySelectorAll<HTMLInputElement>('.perm-cb').forEach(cb => {
        const p = _allPermissions.find(x => x.key === cb.dataset['key'])
        if (p && p.module_name === mod && p.category === cat) cb.checked = catCb.checked
      })
      updatePermCount(container)
    })
  })
}

function getSelectedPerms(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLInputElement>('.perm-cb:checked')]
    .map(cb => cb.dataset['key']!).filter(Boolean)
}

function updatePermCount(container: HTMLElement): void {
  const el = container.querySelector('#perm-count')
  if (el) el.textContent = `${getSelectedPerms(container).length} selected`
}

// ── PageModule export ─────────────────────────────────────────────────────────

const RoleBuilder: PageModule = {
  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user?.assemblyId) { container.innerHTML = '<p>Access denied.</p>'; return }
    container.innerHTML = '<div class="loading-spinner"></div>'
    await Promise.all([loadRoles(user.assemblyId), loadPermissions()])
    renderPage(container, user.assemblyId)
  },

  destroy(): void {
    _editingRole = null
    _isCreating  = false
  },
}

export default RoleBuilder
