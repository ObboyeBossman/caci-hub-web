// src/modules/membership/routes.ts
// All membership module routes — permission strings updated to RBAC dot-notation.
// Member-portal routes (home, my-profile, my-attendance, etc.) require no permission.

import type { RouteDefinition } from '../../types/module.types'

export const membershipRoutes: RouteDefinition[] = [

  // ── Member portal: self-service ───────────────────────────────────────────
  {
    path: '/home',
    page: () => import('./pages/Home'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/my-profile',
    page: () => import('./pages/MyProfile'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/my-attendance',
    page: () => import('./pages/MyAttendance'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/my-giving',
    page: () => import('./pages/MyGiving'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/my-groups',
    page: () => import('./pages/MyGroups'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/announcements',
    page: () => import('./pages/Announcements'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/calendar',
    page: () => import('./pages/Calendar'),
    middleware: ['auth', 'mustChangePassword'],
  },

  // ── Admin: Membership workspace (shell) ──────────────────────────────────
  {
    path: '/membership',
    page: () => import('./pages/MembershipWorkspacePage'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },

  // ── Admin: Members (deep links only — base route lives in /membership) ────
  {
    path: '/members/add',
    page: () => import('./pages/AddMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.create',
  },
  {
    path: '/members/success',
    page: () => import('./pages/AddMemberSuccess'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/members/bulk-import',
    page: () => import('./pages/BulkImport'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.import',
  },
  {
    path: '/members/:id',
    page: () => import('./pages/MemberProfile'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },
  {
    path: '/members/:id/edit',
    page: () => import('./pages/EditMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.edit',
  },
  {
    path: '/members/:id/pastoral-notes',
    page: () => import('./pages/EditPastoralNotes'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.edit',
  },
  {
    path: '/members/:id/flag',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },

  // ── Admin: Households ─────────────────────────────────────────────────────
  {
    path: '/households',
    page: () => import('./pages/HouseholdList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'households.view',
  },
  {
    path: '/households/new',
    page: () => import('./pages/HouseholdCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'households.create',
  },
  {
    path: '/households/:id',
    page: () => import('./pages/HouseholdDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'households.view',
  },
  {
    path: '/households/:id/edit',
    page: () => import('./pages/HouseholdEdit'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'households.edit',
  },

  // ── Admin: Groups (deep links only — base route lives in /membership) ─────
  {
    path: '/groups/new',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.create',
  },
  {
    path: '/groups/:id',
    page: () => import('./pages/GroupDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.view',
  },
  {
    path: '/groups/:id/edit',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.edit',
  },

  // ── Admin: Pastoral Care (deep links only — base route lives in /membership)
  {
    path: '/flag-member',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },

  // ── Admin: Reports (deep links only — base route lives in /membership) ─────
  {
    path: '/reports/:type',
    page: () => import('./pages/ReportDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'reports.view',
  },

  // ── Admin: Audit Logs (deep links only — base route lives in /membership) ──

  // ── Admin: Attendance (tab in /membership workspace) ─────────────────────
]
