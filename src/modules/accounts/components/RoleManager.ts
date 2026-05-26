// src/modules/accounts/components/RoleManager.ts
// Component that manages assembly roles and their permissions.
// Exported as a render function that mounts into a container.

import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { listPermissions, listAssemblyRoles, createAssemblyRole, updateAssemblyRole, deleteAssemblyRole, setRolePermissions } from '../repository'
import type { Permission, AssemblyRole } from '../repository'

let _container: HTMLElement | null = null
let _permissions: Permission[] = []
let _roles: AssemblyRole[] = []
let _editingRoleId: string | null = null
let _isCreatingRole: boolean = false

export async function renderRoleManager(container: HTMLElement): Promise<void> {
  _container = container
  renderSkeleton(container, 'table')

  try {
    [_permissions, _roles] = await Promise.all([
      listPermissions(),
      listAssemblyRoles()
    ])
  } catch (err) {
    renderError(container, err, { retry: () => renderRoleManager(container) })
    return
  }

  renderUI()
}

function renderUI() {
  if (!_container) return

  _container.innerHTML = `
    <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div class="mm-detail-section-title" style="margin:0;">Custom Assembly Roles</div>
        <button id="rm-createBtn" class="mm-btn-primary">Create Role</button>
      </div>

      <!-- Create Form (Hidden by default) -->
      <div id="rm-createForm" style="display:${_isCreatingRole ? 'block' : 'none'};background:var(--mm-bg-main);border:1px solid var(--mm-border);border-radius:8px;padding:16px;margin-bottom:20px;">
        <h4 style="margin:0 0 12px;font-size:14px;">New Role</h4>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <input type="text" id="rm-newName" placeholder="Role Name e.g. Finance Team"
                 style="flex:1;padding:8px;border:1px solid var(--mm-border);border-radius:6px;background:var(--mm-bg-card);color:var(--mm-text-primary);">
          <input type="text" id="rm-newDesc" placeholder="Description (optional)"
                 style="flex:2;padding:8px;border:1px solid var(--mm-border);border-radius:6px;background:var(--mm-bg-card);color:var(--mm-text-primary);">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="rm-cancelCreate" class="mm-btn-outline">Cancel</button>
          <button id="rm-saveNew" class="mm-btn-primary">Save Role</button>
        </div>
      </div>

      <!-- Roles List -->
      ${_roles.length === 0 ? `
        <div style="text-align:center;padding:40px 0;color:var(--mm-text-secondary);font-size:14px;">
          No custom roles defined for this assembly yet.
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${_roles.map(r => renderRoleCard(r)).join('')}
        </div>
      `}
    </div>
  `

  attachEvents()
}

function renderRoleCard(role: AssemblyRole): string {
  const isEditing = _editingRoleId === role.id
  
  // Group permissions by prefix (e.g. "member:invite" -> "member")
  const permGroups = _permissions.reduce((acc, p) => {
    const [prefix] = p.id.split(':')
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(p)
    return acc
  }, {} as Record<string, Permission[]>)

  return `
    <div style="border:1px solid var(--mm-border);border-radius:8px;overflow:hidden;background:var(--mm-bg-main);">
      <!-- Header -->
      <div class="rm-role-header" data-id="${role.id}"
           style="padding:16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:${isEditing ? 'var(--mm-bg-hover)' : 'transparent'};">
        <div>
          <div style="font-weight:600;color:var(--mm-text-primary);font-size:14px;">${role.name}</div>
          <div style="font-size:12px;color:var(--mm-text-secondary);margin-top:2px;">
            ${role.description || 'No description'} • ${role.permissions.length} permission(s)
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="rm-deleteBtn mm-btn-danger" data-id="${role.id}" style="padding:4px 8px;font-size:12px;">Delete</button>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mm-text-secondary)" stroke-width="2"
               style="transform: ${isEditing ? 'rotate(180deg)' : 'none'}; transition: transform 0.2s;">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      <!-- Editor Panel -->
      ${isEditing ? `
        <div style="padding:20px;border-top:1px solid var(--mm-border);background:var(--mm-bg-card);">
          <div style="margin-bottom:20px;">
             <label style="display:block;font-size:12px;color:var(--mm-text-secondary);margin-bottom:4px;">Role Name</label>
             <div style="display:flex;gap:8px;">
               <input type="text" id="rm-editName-${role.id}" value="${role.name}"
                      style="flex:1;padding:8px;border:1px solid var(--mm-border);border-radius:6px;background:var(--mm-bg-main);color:var(--mm-text-primary);">
               <button class="rm-saveNameBtn mm-btn-outline" data-id="${role.id}">Rename</button>
             </div>
          </div>

          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--mm-text-primary);">Permissions</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:24px;">
            ${Object.entries(permGroups).map(([group, perms]) => `
              <div>
                <div style="font-size:11px;text-transform:uppercase;color:var(--mm-text-secondary);font-weight:600;margin-bottom:8px;letter-spacing:0.5px;">
                  ${group}
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${perms.map(p => `
                    <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">
                      <input type="checkbox" class="rm-perm-cb-${role.id}" value="${p.id}"
                             ${role.permissions.includes(p.id) ? 'checked' : ''}
                             style="margin-top:3px;accent-color:var(--caci-accent);">
                      <div style="font-size:13px;color:var(--mm-text-primary);line-height:1.4;">
                        <span style="font-family:monospace;font-size:12px;display:block;color:var(--caci-accent);">${p.id}</span>
                        ${p.description}
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid var(--mm-border);">
            <button class="rm-savePermsBtn mm-btn-primary" data-id="${role.id}">Save Permissions</button>
          </div>
        </div>
      ` : ''}
    </div>
  `
}

function attachEvents() {
  if (!_container) return

  const createBtn = _container.querySelector('#rm-createBtn')
  
  createBtn?.addEventListener('click', () => {
    _isCreatingRole = true
    _editingRoleId = null
    renderUI()
  })
  
  _container.querySelector('#rm-cancelCreate')?.addEventListener('click', () => {
    _isCreatingRole = false
    renderUI()
  })

  _container.querySelector('#rm-saveNew')?.addEventListener('click', async () => {
    const name = (_container!.querySelector('#rm-newName') as HTMLInputElement).value.trim()
    const desc = (_container!.querySelector('#rm-newDesc') as HTMLInputElement).value.trim()
    if (!name) { Toast.error('Role name is required'); return }

    try {
      await createAssemblyRole({ name, description: desc })
      Toast.success(`Role "${name}" created.`)
      _isCreatingRole = false
      await renderRoleManager(_container!) // reload
    } catch (err) { Toast.fromError(err) }
  })

  // Headers (expand/collapse)
  _container.querySelectorAll('.rm-role-header').forEach(el => {
    el.addEventListener('click', (e) => {
      // Ignore clicks on the delete button
      if ((e.target as HTMLElement).closest('.rm-deleteBtn')) return
      
      const id = (el as HTMLElement).dataset['id']
      _editingRoleId = _editingRoleId === id ? null : id || null
      renderUI()
    })
  })

  // Delete
  _container.querySelectorAll('.rm-deleteBtn').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset['id']!
      const role = _roles.find(r => r.id === id)
      if (!confirm(`Delete role "${role?.name}"? Any users assigned this role will lose its permissions.`)) return
      
      try {
        await deleteAssemblyRole(id)
        Toast.success('Role deleted.')
        if (_editingRoleId === id) _editingRoleId = null
        await renderRoleManager(_container!)
      } catch (err) { Toast.fromError(err) }
    })
  })

  // Rename
  _container.querySelectorAll('.rm-saveNameBtn').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset['id']!
      const name = (_container!.querySelector(`#rm-editName-${id}`) as HTMLInputElement).value.trim()
      if (!name) { Toast.error('Name cannot be empty'); return }
      
      try {
        await updateAssemblyRole(id, { name })
        Toast.success('Role renamed.')
        await renderRoleManager(_container!)
      } catch (err) { Toast.fromError(err) }
    })
  })

  // Save Permissions
  _container.querySelectorAll('.rm-savePermsBtn').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset['id']!
      const checkboxes = _container!.querySelectorAll(`.rm-perm-cb-${id}:checked`)
      const selectedPerms = Array.from(checkboxes).map(cb => (cb as HTMLInputElement).value)
      
      try {
        await setRolePermissions(id, selectedPerms)
        Toast.success('Permissions saved.')
        await renderRoleManager(_container!)
      } catch (err) { Toast.fromError(err) }
    })
  })
}
