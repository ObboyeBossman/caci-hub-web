// src/modules/admin/tabs/PermissionsTab.ts
// Permissions tab — scaffold implementation.
// Future: Permission matrix (role × permission toggle table),
// grouped by module_name and category from system_permissions.

import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import { injectWidgetCSS, renderScaffold } from '../widgets/adminWidgets'

export class PermissionsTab implements WorkspaceTab {
    readonly id = 'permissions'
    readonly label = 'Permissions'
    readonly icon = 'key-fill'
    readonly permission = 'admin.permissions.view'

    render(container: HTMLElement): void {
        injectWidgetCSS()
        renderScaffold(
            container,
            'key-fill',
            'Permission Matrix',
            'View and assign system permissions to assembly roles. Permissions are grouped by module — Members, Finance, Services, Groups, and more.',
            'In Development'
        )
    }

    destroy(): void { }
}