# Permissions Architecture

## Overview

CACI Hub Web uses a **role-based, permission-string** access control model. The user's `role` is stored in the database and loaded once at login. It acts as a lookup key into a static `rolePermissions` map. No permissions are assigned at runtime — the role *implies* the permission set.

There is **no separate permissions module**. Permissions are cross-cutting infrastructure that lives in `src/core/` alongside `router.ts` and `auth.ts`. A `src/modules/permissions/` would violate the architecture rule that allows only `core/` and `shared/` to be imported across module boundaries.

---

## The Three Enforcement Layers

Access control is applied at three independent layers. All three must hold — bypassing the UI layer (e.g. via direct URL) still hits RLS at the DB.

| # | Layer | Where | What it blocks |
|---|---|---|---|
| 1 | **Router guard** | `permissionGuard.ts` | Navigation to an entire route |
| 2 | **In-page check** | `hasPermission()` in render() | Individual buttons / UI sections |
| 3 | **Supabase RLS** | Database level | Data access regardless of UI |

---

## Boot Flow: How Role Gets Loaded

```
main.ts boots
     ↓
loadCurrentUser()  ← src/core/auth.ts
     │
     ├── supabase.auth.getUser()           → Supabase Auth session
     └── supabase.from('user_profiles')    → joins user_profiles row
              │
              └── maps to AppUser {
                    id, email, fullName,
                    role,          ← "secretary", "pastor", etc.
                    assemblyId,
                    isActive,
                    isMfaEnrolled, isMfaVerified
                  }
     ↓
_currentUser stored in module-level singleton
     ↓
startRouter()  ← router reads role via getCurrentUser() on every navigation
```

`super_admin` (`national_admin`, `district_overseer`) has no `assembly_id` in RLS — they must select an assembly via the Toolbar. `getActiveAssemblyId()` returns `null` until they do.

---

## The Middleware Pipeline

Every protected route declares a `middleware` array. Guards run **in order**; the first denial short-circuits the rest.

```
navigation triggered
     ↓
runMiddleware(route, path)   ← src/core/middleware.ts
     │
     ├── authGuard()         → is there a valid, active session?
     │      NO  → redirect /login
     │
     ├── onboardingGuard()   → has the user completed MFA enrollment?
     │      NO  → redirect /totp-enroll   (currently disabled, fails open)
     │
     └── permissionGuard()   → does the user's role satisfy route.permission?
            NO  → redirect /unauthorized
            YES → page.render()
```

Guards are registered in `guardMap` inside `middleware.ts`. Adding a new guard is one file + one map entry — no other files change.

---

## The `rolePermissions` Map

**Source of truth:** `src/core/permissions.ts`

The map translates `role → string[]` of permission tokens. The format is `'module.action'`.

```
Wildcard rules (evaluated in order):
  '*'          → super-wildcard, grants everything
  'module.*'   → namespace wildcard, grants all actions in that module
  'module.action' → exact match
  (no permission declared on route) → always allowed
```

### Phase 1 Active Roles

| Role | Permission summary |
|---|---|
| `admin` | `['*']` — full access to everything |
| `pastor` | `membership.*`, `communication.*`, `pastoral-care.*`, `events.*`, `groups.*`, `reports.view`, `dashboard.view` |
| `secretary` | `membership.view/create/edit`, `households.view/create/edit`, `groups.view`, `attendance.view`, `profile.view` |
| `volunteer` | `membership.view`, `households.view`, `groups.view`, `events.view`, `attendance.view`, `profile.view` |
| `member` | `profile.view`, `events.view`, `media.view`, `giving.view` |

### Future Roles (declared in DB, minimal defaults until activated)

| Role | Intended scope |
|---|---|
| `finance_officer` | `finance.*`, `giving.*`, `reports.*`, `membership.view` |
| `welfare_officer` | `membership.view`, `pastoral-care.*`, `groups.view` |
| `cell_leader` | `groups.*`, `attendance.*`, `membership.view` |
| `elder` | `membership.view`, `pastoral-care.view`, `reports.view` |
| `children_worker` | `membership.view`, `groups.view`, `attendance.*` |
| `media_officer` | `media.*`, `events.view` |
| `district_overseer` | `['*']` — cross-assembly oversight |
| `national_admin` | `['*']` — full national access |

---

## How a Route Declares Its Permission

In a module's `routes` array inside its `ModuleManifest`:

```ts
{
  path:       '/members',
  page:       () => import('./pages/MemberList'),
  middleware: ['auth', 'permissions'],
  permission: 'membership.view',
}
```

The `permission` field is read by `permissionGuard`. If absent, all authenticated users can access the route. `presentation` defaults to `'shell'` (full sidebar + toolbar layout).

---

## In-Page Permission Checks

Beyond route-level guards, individual UI elements use `hasPermission()` directly:

```ts
import { hasPermission } from '@core/permissions'
import { getCurrentUser } from '@core/auth'

const user = getCurrentUser()!
if (hasPermission(user.role, 'membership.edit')) {
  // render Edit button
}
```

This is layer 2 — it hides buttons the user cannot act on, independently of whether the router already blocked access at the route level.

---

## Role Capability Helpers

`src/types/auth.types.ts` exports named helpers that mirror `user_role.dart` for common coarse checks. These are used in UI rendering, not in the router:

```ts
canManageMembers(role)       // admin | secretary
canEditPastoralNotes(role)   // admin | pastor
canViewAuditLog(role)        // admin only
canManageUsers(role)         // admin only
hasDashboardAccess(role)     // admin | pastor | national_admin | district_overseer
requiresMfa(role)            // currently always false; enable in Phase 3
```

> **Note:** These are intentionally separate from `hasPermission()`. They encode business-level capability semantics (e.g. "who can see pastoral notes") rather than module-action access. Prefer `hasPermission()` for routing and data access; use these helpers for UI-level feature flags.

---

## Sidebar Filtering

Sidebar items also declare a `permission` field. The shell reads all registered `SidebarItem[]` from the registry, filters by `hasPermission(user.role, item.permission)`, sorts by `order`, and renders. No sidebar item is ever visible to a role that lacks its permission.

---

## Assembly Scoping

All data queries are assembly-scoped. For most roles, `assembly_id` is set in their `user_profiles` row and enforced by Supabase RLS automatically. For `national_admin` / `district_overseer`:

- `assemblyId` in `AppUser` may be `null`
- `getActiveAssemblyId()` reads from `localStorage` after Toolbar selection
- All repositories call `getActiveAssemblyId()` before querying — they skip or warn if null

Permissions do **not** change with assembly context. A `secretary` in Assembly A has the same permission set if they switch to Assembly B.

---

## How to Add a New Role

1. Add the role string to the DB `user_role` enum (migration)
2. Add one entry to `rolePermissions` in `src/core/permissions.ts`
3. Add it to `PHASE1_ROLES` in `auth.types.ts` if it becomes active in Phase 1
4. If it needs capability helpers, add to `auth.types.ts`

**Zero router changes.** Every guard and in-page check picks up the new role automatically.

---

## When Would a Permissions Admin UI Make Sense?

Only if admins need to **view or manage** roles through a UI — seeing what each role can do, or assigning roles to users. That page would live in `src/modules/admin/pages/` and read from `core/permissions.ts`. The logic does **not** move out of core. The data stays static unless the system evolves to dynamic, DB-stored permission sets (a future major architectural change, not needed in Phase 1–3).
