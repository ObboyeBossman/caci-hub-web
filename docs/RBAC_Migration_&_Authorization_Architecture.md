# RBAC Migration & Authorization Architecture

Refactor authorization from a static role-map in [permissions.ts](file:///home/obboye/dev/caci-hub-web/src/core/permissions.ts) to a modular RBAC model:
- `user_profiles.role` is restricted to `admin | member` (system roles only)
- Assembly-created custom roles live in `assembly_roles`
- Platform-defined permissions live in `system_permissions` (renamed from `permissions`)
- RLS enforces assembly isolation + admin override only — no custom role logic
- Application layer enforces fine-grained authorization via `authorization-service.ts`

> [!IMPORTANT]
> **Breaking Changes**:
> - `user_profiles.role` enum values `pastor`, `secretary`, `volunteer`, `national_admin`, `district_overseer` will be **removed**. All existing rows with those roles must be migrated to `member` before the constraint is applied.
> - `permissions` table renamed to `system_permissions`. The FK in `role_permissions` changes from `permission_id text` to `permission_key text`.
> - `user_profiles.role_id` renamed to `assembly_role_id`.
> - RLS helper functions `is_admin_or_pastor()`, `is_admin_or_secretary()`, `can_read_directory()` will be removed. Any code depending on them will break.
> - `members_view` emergency-contact and pastoral-notes column masking logic will be simplified (admin sees all, member sees own, others see limited).
> - Route permission strings stay dotted format but will be aligned to new manifest keys.

---

## Proposed Changes

### Phase 1 — Database Migrations

#### [NEW] `20260530000001_rbac_rename_permissions_table.sql`
- Rename `public.permissions` → `public.system_permissions`
- Add columns: `key text PK`, `label text`, `module_name text`, `category text`, `is_assignable bool DEFAULT true`, `is_active bool DEFAULT true`
- Migrate old [id](file:///home/obboye/dev/caci-hub-web/src/core/registry.ts#49-58) → `key`, copy `description` as-is
- Drop old RLS policies on `permissions`, recreate on `system_permissions`

#### [NEW] `20260530000002_rbac_update_role_permissions.sql`
- Drop FK on `role_permissions.permission_id` → `permissions(id)`
- Add FK `role_permissions.permission_key` → `system_permissions(key)`
- Rename column `permission_id` → `permission_key`
- Update PK to [(role_id, permission_key)](file:///home/obboye/dev/caci-hub-web/src/modules/membership/routes.ts#77-78)

#### [NEW] `20260530000003_rbac_update_assembly_roles.sql`
- Add `is_active boolean NOT NULL DEFAULT true` to `assembly_roles`
- Add `is_system boolean NOT NULL DEFAULT false` to `assembly_roles`

#### [NEW] `20260530000004_rbac_rename_user_profiles_role_id.sql`
- Rename `user_profiles.role_id` → `user_profiles.assembly_role_id`

#### [NEW] `20260530000005_rbac_restrict_user_profiles_role.sql`
- Migrate any rows with roles other than `admin`/`member` → set `role = 'member'`  
- Drop `user_role` enum and replace `user_profiles.role` with `text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))`
- Update `get_user_role()` return type from `public.user_role` → [text](file:///home/obboye/dev/caci-hub-web/src/core/registry.ts#45-48)
- Update `is_admin()` to use text comparison

#### [NEW] `20260530000006_rbac_seed_system_permissions.sql`
- Upsert all platform permissions into `system_permissions`:
  ```
  members.view, members.create, members.edit, members.deactivate
  households.view, households.create, households.edit
  reports.view, reports.export
  finance.offerings.view, finance.offerings.edit
  admin.view, admin.users.manage
  ```
- Use `ON CONFLICT (key) DO UPDATE`

#### [NEW] `20260530000007_rbac_refactor_rls.sql`
- Drop `is_admin_or_pastor()`, `is_admin_or_secretary()`, `can_read_directory()` functions  
- Recreate `members_select` RLS policy: admin sees all in assembly; member sees own row
- Recreate `members_view` without hardcoded role names in CASE expressions (admin sees all columns; member sees own; others see non-sensitive only)
- Update `enforce_member_update_columns()` trigger: remove pastor/secretary/volunteer branches; admin = full access, member = deny all, NULL = allow (internal)
- Update JWT sync trigger column: `role_id` → `assembly_role_id`, `permission_id` → `permission_key`

---

### Phase 2 — TypeScript: Authorization Core

#### [NEW] `src/core/authorization/permissions.ts`
- Exported typed constants:
  ```ts
  export const PERMISSIONS = {
    MEMBERS_VIEW: 'members.view',
    MEMBERS_CREATE: 'members.create',
    MEMBERS_EDIT: 'members.edit',
    // ... etc
  } as const
  export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
  ```

#### [NEW] `src/core/authorization/permission-registry.ts`
- Class `PermissionRegistry` with:
  - [register(module: ModulePermissionManifest): void](file:///home/obboye/dev/caci-hub-web/src/core/registry.ts#20-36) — validates no duplicate keys, no invalid formats
  - `getAll(): PermissionDefinition[]`
  - `getByModule(moduleName: string): PermissionDefinition[]`
  - `validate(): void` — throws if duplicates or bad naming found
- Singleton `permissionRegistry` export

#### [NEW] `src/core/authorization/authorization-service.ts`
- Function [can(user: AppUser, permission: Permission): boolean](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#63-66)
  - If `user.role === 'admin'` → return `true`
  - Else check `user.permissions.includes(permission)`
- Function [hasPermission(user: AppUser, permission: Permission): boolean](file:///home/obboye/dev/caci-hub-web/src/core/permissions.ts#90-107) (alias)
- Function `requirePermission(user: AppUser, permission: Permission): void` (throws if not allowed)

---

### Phase 3 — Module Manifests

#### [NEW] `src/modules/membership/manifest.ts`
```ts
export const MembershipModule = {
  name: 'membership',
  permissions: [
    { key: 'members.view', label: 'View Members', category: 'Members', ... },
    { key: 'members.create', label: 'Create Members', category: 'Members', ... },
    { key: 'members.edit', label: 'Edit Members', category: 'Members', ... },
    { key: 'members.deactivate', label: 'Deactivate Members', category: 'Members', ... },
    { key: 'households.view', ... },
    { key: 'households.create', ... },
    { key: 'households.edit', ... },
  ]
}
```

#### [NEW] `src/modules/admin/manifest.ts`
```ts
export const AdminModule = {
  name: 'admin',
  permissions: [
    { key: 'admin.view', label: 'View Admin', category: 'Admin', ... },
    { key: 'admin.users.manage', label: 'Manage Users', category: 'Admin', ... },
  ]
}
```

---

### Phase 4 — Auth Types Update

#### [MODIFY] [src/types/auth.types.ts](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts)
- Change `UserRole = 'admin' | 'member'` (plain union type, remove DB enum reference)
- Add `permissions: string[]` field to [AppUser](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#30-48)
- Add `assemblyRoleId: string | null` to [AppUser](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#30-48)
- Remove legacy helpers: [canManageMembers](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#49-54), [canEditPastoralNotes](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#55-58), [canViewAuditLog](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#59-62), [canManageUsers](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#63-66), [hasDashboardAccess](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#67-70)
- Remove `PHASE1_ROLES` constant

---

### Phase 5 — Core Auth Update

#### [MODIFY] [src/core/auth.ts](file:///home/obboye/dev/caci-hub-web/src/core/auth.ts)
- In [loadCurrentUser()](file:///home/obboye/dev/caci-hub-web/src/core/auth.ts#22-82): select `assembly_role_id` from profile
- Join `role_permissions` + `system_permissions` to load user's permissions array
- Populate `_currentUser.permissions` and `_currentUser.assemblyRoleId`
- Remove `national_admin`/`district_overseer` special-casing (no longer valid roles)

---

### Phase 6 — Permission Guard Update

#### [MODIFY] [src/core/guards/permissionGuard.ts](file:///home/obboye/dev/caci-hub-web/src/core/guards/permissionGuard.ts)
- Import and use [can()](file:///home/obboye/dev/caci-hub-web/src/types/auth.types.ts#63-66) from `authorization-service.ts` instead of [hasPermission()](file:///home/obboye/dev/caci-hub-web/src/core/permissions.ts#90-107) from [permissions.ts](file:///home/obboye/dev/caci-hub-web/src/core/permissions.ts)

#### [MODIFY] [src/core/permissions.ts](file:///home/obboye/dev/caci-hub-web/src/core/permissions.ts)
- Replace entire file body with a re-export shim pointing to `authorization-service.ts`, or delete and update all imports

---

### Phase 7 — Route Permission String Alignment

#### [MODIFY] [src/modules/membership/routes.ts](file:///home/obboye/dev/caci-hub-web/src/modules/membership/routes.ts)
- Rename `membership.view` → `members.view`, `membership.create` → `members.create`, `membership.edit` → `members.edit`, `membership.members.import` → `members.import`
- `households.view`, `households.create`, `households.edit` stay as-is

#### [MODIFY] [src/modules/admin/routes.ts](file:///home/obboye/dev/caci-hub-web/src/modules/admin/routes.ts)
- `admin.view` stays

---

### Phase 8 — UI: Role Builder Admin Page

#### [NEW] `src/modules/admin/pages/RoleBuilder.ts`
- Lists `assembly_roles` for current assembly
- Allows creating/editing roles with permission toggles
- Reads `system_permissions WHERE is_assignable = true AND is_active = true ORDER BY module_name, category`
- Grouped by module_name → category → permissions
- On save: upsert into `role_permissions`

#### [MODIFY] [src/modules/admin/routes.ts](file:///home/obboye/dev/caci-hub-web/src/modules/admin/routes.ts)
- Add route `/admin/roles` → `RoleBuilder`
- Add route `/admin/roles/new` → `RoleBuilder` (create mode)
- Add route `/admin/roles/:id` → `RoleBuilder` (edit mode)

#### [MODIFY] [src/modules/admin/index.ts](file:///home/obboye/dev/caci-hub-web/src/modules/admin/index.ts)
- Add sidebar item for "Roles" linking to `/admin/roles`

---

## Verification Plan

### Automated
```bash
# TypeScript type check (no test suite currently exists)
cd /home/obboye/dev/caci-hub-web && npm run build
```

### DB Migration Check
```bash
cd /home/obboye/dev/caci-hub-web && npx supabase db push
```
Expected: all 7 new migrations apply cleanly; verify in Supabase dashboard SQL editor:
```sql
SELECT key, module_name, category FROM system_permissions ORDER BY module_name, category;
SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles';
SELECT CHECK_CLAUSE FROM information_schema.check_constraints WHERE constraint_name LIKE '%role%';
```

### Manual Browser Verification
1. `npm run dev` is already running. Open `http://localhost:5173`
2. Login as **admin** → verify all pages accessible, no permission errors
3. Login as **member** → verify `/members` is blocked (redirects to `/unauthorized`)
4. As admin: navigate to `/admin/roles` → create a new role "Secretary" with `members.view`, `members.edit`
5. As admin: provisioned a new test user → assign the "Secretary" role
6. Login as that user → verify `/members` is accessible, `/admin/roles` is blocked
