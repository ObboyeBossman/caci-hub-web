// src/modules/admin/routes.ts
// Admin sub-routes have been consolidated into the single /admin workspace.
// The /admin route itself is declared in index.ts and renders AdminPage.ts
// which mounts AdminWorkspaceShell with all tabs (Accounts, Roles, Permissions,
// Households, Audit Log, Settings).
//
// Legacy old_pages/ routes have been removed — they are superseded by the
// tab-based workspace. Deep-link navigation (e.g. /admin/users/:id) can be
// added back here when individual account-detail pages are needed.

import type { RouteDefinition } from '../../types/module.types'

export const adminRoutes: RouteDefinition[] = []