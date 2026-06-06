// src/modules/admin/tabs/HouseholdsTab.ts
// Households tab — scaffold implementation.
// Future: Manage household records, link members to family units,
// set primary contacts, manage addresses.

import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import { injectWidgetCSS, renderScaffold } from '../widgets/adminWidgets'

export class HouseholdsTab implements WorkspaceTab {
    readonly id = 'households'
    readonly label = 'Households'
    readonly icon = 'house-fill'
    readonly permission = 'admin.households.view'

    render(container: HTMLElement): void {
        injectWidgetCSS()
        renderScaffold(
            container,
            'house-fill',
            'Household Management',
            'Organise members into family units, assign primary contacts, and manage household addresses. Linked to the Members module via the households table.',
            'In Development'
        )
    }

    destroy(): void { }
}