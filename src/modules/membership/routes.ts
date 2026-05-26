// src/modules/membership/routes.ts
// All membership module routes.

import type { RouteDefinition } from '../../types/module.types'

export const membershipRoutes: RouteDefinition[] = [
  // ── Members ───────────────────────────────────────────────────────────────
  {
    path: '/members',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/members/add',
    page: () => import('./pages/AddMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.create',
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
    permission: 'membership.members.import',
  },
  {
    path: '/members/:id',
    page: () => import('./pages/MemberProfile'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/members/:id/edit',
    page: () => import('./pages/EditMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.edit',
  },
  {
    path: '/members/:id/pastoral-notes',
    page: () => import('./pages/EditPastoralNotes'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.edit',
  },
  {
    path: '/members/:id/flag',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
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
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/groups/new',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    path: '/attendance',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/attendance/record',
    page: () => import('./pages/RecordAttendance'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },

  // ── Pastoral Care ─────────────────────────────────────────────────────────
  {
    path: '/pastoral-care',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/flag-member',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    path: '/reports',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/reports/:type',
    page: () => import('./pages/ReportDetail'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'membership.view',
  },

  // ── My Profile & Admin ────────────────────────────────────────────────────
  {
    path: '/my-profile',
    page: () => import('./pages/MyProfile'),
    middleware: ['auth', 'mustChangePassword'],
  },
  {
    path: '/audit-log',
    page: () => import('./pages/AuditLog'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'admin.view',
  },
]