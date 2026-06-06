// src/modules/admin/tabs/RolesTab.ts
// Roles tab — scaffold implementation.
// Future: CRUD for assembly_roles, permission assignment matrix.

import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import { injectWidgetCSS, renderScaffold } from '../widgets/adminWidgets'

export class RolesTab implements WorkspaceTab {
    readonly id = 'roles'
    readonly label = 'Roles'
    readonly icon = 'shield-fill'
    readonly permission = 'admin.roles.view'

    render(container: HTMLElement): void {
        injectWidgetCSS()
        renderScaffold(
            container,
            'shield-fill',
            'Role Management',
            'Create and manage assembly roles. Assign permissions to each role to control what members can access within CACI Hub.',
            'In Development'
        )
    }

    destroy(): void { }
}