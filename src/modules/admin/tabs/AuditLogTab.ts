// src/modules/admin/tabs/AuditLogTab.ts
// Audit Log tab — scaffold implementation.
// Future: Unified view across member_audit_log and service_audit_log,
// filterable by entity type, changed_by user, date range.

import type { WorkspaceTab } from '../workspace/AdminWorkspaceShell'
import { injectWidgetCSS, renderScaffold } from '../widgets/adminWidgets'

export class AuditLogTab implements WorkspaceTab {
    readonly id = 'audit'
    readonly label = 'Audit Log'
    readonly icon = 'clock-history'
    readonly permission = 'admin.audit.view'

    render(container: HTMLElement): void {
        injectWidgetCSS()
        renderScaffold(
            container,
            'clock-history',
            'Audit Log',
            'A full history of changes made within this assembly — member updates, account provisioning, role changes, and service edits. Filter by user, entity type, or date range.',
            'In Development'
        )
    }

    destroy(): void { }
}