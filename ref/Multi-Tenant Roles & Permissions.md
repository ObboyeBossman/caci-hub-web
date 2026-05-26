# Multi-Tenant Roles & Permissions

Each **Assembly** acts as its own tenant. Permissions are system-wide constants (defined by you, the developer). Roles are Assembly-defined buckets that map to those permissions — created and managed by each Assembly's Admin.

## Key Design Decisions

> [!IMPORTANT]
> **We are NOT replacing `user_profiles.role` (the existing `user_role` enum).** That column stays as a **system-level gate** for your existing RLS helper functions (`is_admin()`, `is_admin_or_pastor()`, etc.) and will always be set to `'admin'` for the Super Admin.
>
> We are **adding** a new `role_id UUID` column to `user_profiles` that points to an **Assembly's custom role**. The JWT sync will be driven by this new FK. Both coexist cleanly.

> [!NOTE]
> The new table is named `public.assembly_roles` (not `roles`) to avoid confusion with the existing `user_role` enum and to make the assembly scope explicit from the name.

---

## Proposed Changes

### Database — Single New Migration

#### [NEW] [20260526000004_create_roles_permissions.sql](file:///home/obboye/dev/caci-hub-web/supabase/migrations/20260526000004_create_roles_permissions.sql)

**Step 1 — System Permissions table**
```sql
CREATE TABLE public.permissions (
  id          TEXT PRIMARY KEY,  -- e.g. 'member:invite', 'financials:view'
  description TEXT
);
```
Seeded with the initial permission set below. Only you (the developer) can add/remove rows.

**Step 2 — Assembly Roles table (tenant-scoped)**
```sql
CREATE TABLE public.assembly_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  UUID NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  UNIQUE (assembly_id, name)
);
```

**Step 3 — Role ↔ Permission junction**
```sql
CREATE TABLE public.role_permissions (
  role_id       UUID REFERENCES public.assembly_roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES public.permissions(id)    ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

**Step 4 — Add `role_id` to `user_profiles`**
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN role_id UUID REFERENCES public.assembly_roles(id) ON DELETE SET NULL;
```
This sits alongside the existing `role` enum column — no existing policies break.

**Step 5 — JWT sync trigger**

When a user's `role_id` or `assembly_id` changes, the trigger collects all `permission_id` values for that role and pushes them (plus `assembly_id`) into `auth.users.raw_app_meta_data`:
```json
{
  "assembly_id": "<uuid>",
  "permissions": ["member:invite", "financials:view"]
}
```

**Step 6 — RLS on new tables**
- `permissions` — `SELECT` for all `authenticated`; no INSERT/UPDATE/DELETE via API.
- `assembly_roles` — `SELECT/INSERT/UPDATE/DELETE` scoped to `assembly_id = get_user_assembly_id()`, INSERT/UPDATE/DELETE restricted to `is_admin()`.
- `role_permissions` — same scope via join to `assembly_roles`.

**Permission seed data:**

| ID | Description |
|---|---|
| `member:invite` | Provision new user accounts |
| `member:view_all` | View full member directory |
| `member:edit` | Create and update member records |
| `financials:view` | View tithing and financial history |
| `financials:write` | Log tithes, offerings, and expenses |
| `attendance:mark` | Record service and event attendance |
| `sermon:edit` | Create, edit, or delete sermons |

---

### Frontend

#### [NEW] [usePermission.ts](file:///home/obboye/dev/caci-hub-web/src/shared/composables/usePermission.ts)
A Vue composable (since the project uses Vue) that reads `app_metadata.permissions` from the user's session: no extra DB calls needed.

```typescript
export function usePermission(permission: string): ComputedRef<boolean>
```

#### [NEW] [RoleManager.vue](file:///home/obboye/dev/caci-hub-web/src/modules/accounts/components/RoleManager.vue)
Admin UI panel to create and manage custom roles for the current assembly. Lists system permissions as checkboxes to bundle into a named role.

---

## Verification Plan

### Automated
```bash
supabase migration up
```
Verify tables exist and are seeded in the Supabase dashboard.

### Manual
1. As Admin, create a custom role, assign permissions.
2. Assign that role to a user profile (`role_id` FK).
3. Check `auth.users.raw_app_meta_data` in the Supabase Auth dashboard — confirm the `permissions` array is correct.
4. Log in as that user and verify the `usePermission()` hook returns the right values.
