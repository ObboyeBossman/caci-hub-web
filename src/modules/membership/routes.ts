// src/modules/membership/routes.ts
// All membership module routes — permission strings updated to RBAC dot-notation.

import type { RouteDefinition } from '../../types/module.types'

export const membershipRoutes: RouteDefinition[] = [
  // ── Home ──────────────────────────────────────────────────────────────────
  {
    path: '/home',
    page: () => import('./pages/Home'),
    middleware: ['auth', 'mustChangePassword'],
  },

  // ── Members ───────────────────────────────────────────────────────────────
  {
    path: '/members',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },
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

  // ── Households ────────────────────────────────────────────────────────────
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

  // ── Groups ────────────────────────────────────────────────────────────────
  {
    path: '/groups',
    page: () => import('./pages/Groups'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.view',
  },
  {
    path: '/groups/new',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.create',
  },
  {
    path: '/groups/:id/edit',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'groups.edit',
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    path: '/attendance',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },
  {
    path: '/attendance/record',
    page: () => import('./pages/RecordAttendance'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },

  // ── Pastoral Care ─────────────────────────────────────────────────────────
  {
    path: '/pastoral-care',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },
  {
    path: '/flag-member',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'members.view',
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    path: '/reports',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'reports.view',
  },
  {
    path: '/reports/:type',
    page: () => import('./pages/ReportDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'reports.view',
  },

  // ── My Profile & Admin ────────────────────────────────────────────────────
  {
    path: '/my-profile',
    page: () => import('./pages/MyProfile'),
    middleware: ['auth', 'mustChangePassword'],
  },

]