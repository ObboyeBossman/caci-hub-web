// src/modules/membership/routes.ts
// All membership module routes.

import type { RouteDefinition } from '../../types/module.types'

export const membershipRoutes: RouteDefinition[] = [
  // ── Members ───────────────────────────────────────────────────────────────
  {
    path: '/members',
    page: () => import('./pages/MemberList'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/members/add',
    page: () => import('./pages/AddMember'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.create',
  },
  {
    path: '/members/success',
    page: () => import('./pages/AddMemberSuccess'),
    middleware: ['auth'],
  },
  {
    path: '/members/:id',
    page: () => import('./pages/MemberProfile'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/members/:id/edit',
    page: () => import('./pages/EditMember'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.edit',
  },
  {
    path: '/members/:id/pastoral-notes',
    page: () => import('./pages/EditPastoralNotes'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.edit',
  },
  {
    path: '/members/:id/flag',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },

  // ── Households ────────────────────────────────────────────────────────────
  {
    path: '/households',
    page: () => import('./pages/HouseholdList'),
    middleware: ['auth', 'permissions'],
    permission: 'households.view',
  },
  {
    path: '/households/new',
    page: () => import('./pages/HouseholdCreate'),
    middleware: ['auth', 'permissions'],
    permission: 'households.create',
  },
  {
    path: '/households/:id',
    page: () => import('./pages/HouseholdDetail'),
    middleware: ['auth', 'permissions'],
    permission: 'households.view',
  },
  {
    path: '/households/:id/edit',
    page: () => import('./pages/HouseholdEdit'),
    middleware: ['auth', 'permissions'],
    permission: 'households.edit',
  },

  // ── Groups ────────────────────────────────────────────────────────────────
  {
    path: '/groups',
    page: () => import('./pages/Groups'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/groups/new',
    page: () => import('./pages/GroupCreate'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  {
    path: '/attendance',
    page: () => import('./pages/Attendance'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/attendance/record',
    page: () => import('./pages/RecordAttendance'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },

  // ── Pastoral Care ─────────────────────────────────────────────────────────
  {
    path: '/pastoral-care',
    page: () => import('./pages/PastoralCare'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/flag-member',
    page: () => import('./pages/FlagMember'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    path: '/reports',
    page: () => import('./pages/Reports'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },
  {
    path: '/reports/:type',
    page: () => import('./pages/ReportDetail'),
    middleware: ['auth', 'permissions'],
    permission: 'membership.view',
  },

  // ── My Profile & Admin ────────────────────────────────────────────────────
  {
    path: '/my-profile',
    page: () => import('./pages/MyProfile'),
    middleware: ['auth'],
  },
  {
    path: '/audit-log',
    page: () => import('./pages/AuditLog'),
    middleware: ['auth', 'permissions'],
    permission: 'admin.view',
  },
]