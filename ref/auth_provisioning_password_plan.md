# CACI Hub — Auth Provisioning & Password Management
## Full Implementation Plan

**Version:** 1.0.0
**Stack:** TypeScript · Vite · Bootstrap 5 · Supabase
**Architecture:** `church-app-architecture-v3.md` — Modular Monolith · Vertical Slice · Manifest-Driven
**Builds on:** `member_first_bulk_import_plan_v2.md`
**Status:** To be implemented

---

## What this plan covers

1. Force password change on first login (`must_change_password` flag)
2. Admin account management — reset to default, delete auth account
3. Voluntary password change from Settings
4. Member contact fields migration (phone + email both optional, at least one required)
5. Provision flow — invite / default / custom password, enforced contact validation
6. Phone sign-in on the login page
7. Bulk CSV import (carried forward from previous plan, integrated here)

---

## Table of contents

1. [Database migrations](#1-database-migrations)
2. [Supabase Edge Functions](#2-supabase-edge-functions)
3. [Types & Zod schemas](#3-types--zod-schemas)
4. [Permissions](#4-permissions)
5. [Core layer changes](#5-core-layer-changes)
6. [Auth module changes](#6-auth-module-changes)
7. [Settings module](#7-settings-module)
8. [Membership module changes](#8-membership-module-changes)
9. [Admin module — activate & implement](#9-admin-module--activate--implement)
10. [Module manifests & routes](#10-module-manifests--routes)
11. [Testing](#11-testing)
12. [File map](#12-file-map)
13. [Dependency order](#13-dependency-order)
14. [Timeline estimate](#14-timeline-estimate)

---

## 1. Database migrations

> Run via Supabase SQL editor or `supabase db push`.
> After every migration run:
> `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`

---

### 1.1 `20260520000001_add_assembly_default_password.sql`

```sql
ALTER TABLE public.assemblies
  ADD COLUMN IF NOT EXISTS default_member_password text;

COMMENT ON COLUMN public.assemblies.default_member_password IS
  'Assembly-level temporary password for members with no email.
   Set once by admin via the set-assembly-default-password Edge Function.
   NULL means not yet configured. Never stored per-member.';
```

---

### 1.2 `20260520000002_add_must_change_password.sql`

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.must_change_password IS
  'True when account was provisioned with a default or custom password.
   Forces a non-dismissable password change screen on first login.
   Cleared to false after the member sets their own password.';
```

---

### 1.3 `20260520000003_member_contact_optional.sql`

Makes both `phone_number` and `email` nullable but enforces that at least
one is always present via a CHECK constraint.

```sql
-- Both columns are already nullable in the current schema.
-- This migration adds the at-least-one constraint and removes
-- any NOT NULL constraint if present on either column.

ALTER TABLE public.members
  ALTER COLUMN phone_number DROP NOT NULL,
  ALTER COLUMN email        DROP NOT NULL;

-- Enforce: at least one contact method must be provided.
ALTER TABLE public.members
  ADD CONSTRAINT chk_members_contact_required
  CHECK (
    phone_number IS NOT NULL
    OR email IS NOT NULL
  );

COMMENT ON CONSTRAINT chk_members_contact_required ON public.members IS
  'At least one of phone_number or email must be provided.
   Enforced here and mirrored in the CreateMemberSchema Zod schema.';
```

---

### 1.4 Regenerate types after all three migrations

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > src/types/database.types.ts
```

All three new columns appear automatically in the generated types.
No manual edits to `database.types.ts`.

---

## 2. Supabase Edge Functions

All functions live in `supabase/functions/`. Deploy individually:
`supabase functions deploy <function-name>`

---

### 2.1 Update `provision-user/index.ts` — three paths + deletion guard

Replace the existing single-password implementation.

#### Request shape

```typescript
type ProvisionPath = 'invite' | 'default_password' | 'custom_password'

interface ProvisionUserRequest {
  memberId:  string
  role:      string
  path:      ProvisionPath
  email?:    string    // optional override for invite/custom_password
  password?: string    // required for custom_password only
}
```

#### Shared guards — run in this order for ALL paths

```
1. Caller auth.uid() must resolve to a user_profiles row with role = 'admin'
   → 401 if no session, 403 if not admin

2. Fetch member row (id = memberId) using service role
   → 404 if not found

3. member.assembly_id !== admin's assembly_id
   → 403 "Member is not in your assembly"

4. !member.is_active || member.deleted_at IS NOT NULL
   → 400 "Member record is not active"

5. member.auth_user_id IS NOT NULL
   → 409 "This member already has a login account.
          Use Reset Account to clear it first."

6. Contact validation — checked per-path (see below)
```

#### Path A — `invite` (send magic link email)

Contact requirement: email must be available (from `body.email` or `member.email`).
Return 400 `"Member has no email address. Enter one or choose a different
provisioning method."` if neither is set.

```typescript
const emailFinal = (body.email ?? member.email)?.trim().toLowerCase()
if (!emailFinal) { /* 400 */ }

// Create auth user — email_confirm: false so the invite link confirms it
const { data: created } = await supabaseAdmin.auth.admin.createUser({
  email: emailFinal,
  email_confirm: false,
})

// Send Supabase built-in invite email
await supabaseAdmin.auth.admin.generateLink({
  type: 'invite',
  email: emailFinal,
})

// Insert user_profiles — must_change_password: false (they set their own)
await supabaseAdmin.from('user_profiles').insert({
  id: created.user.id,
  assembly_id: adminAssemblyId,
  role: roleRaw,
  full_name: fullName,
  is_active: true,
  must_change_password: false,
})

// Link auth account to member record
await supabaseAdmin.from('members')
  .update({ auth_user_id: created.user.id, email: emailFinal })
  .eq('id', memberId)

return { userId: created.user.id, email: emailFinal, fullName, role: roleRaw, path: 'invite' }
```

#### Path B — `default_password` (phone identifier, assembly default password)

Contact requirement: phone must be set on the member record.
Return 400 `"Member has no phone number. A phone number is required
for this provisioning method."` if null.

```typescript
// Read assembly default password
const { data: assembly } = await supabaseAdmin
  .from('assemblies')
  .select('default_member_password')
  .eq('id', adminAssemblyId)
  .single()

if (!assembly?.default_member_password) {
  return 400 "Assembly default password is not configured.
              Set it in Assembly Settings before using this option."
}

// Enable phone+password in Supabase Auth settings first (dashboard toggle)
const { data: created } = await supabaseAdmin.auth.admin.createUser({
  phone: member.phone_number,
  password: assembly.default_member_password,
  phone_confirm: true,   // admin-provisioned — skip OTP
})

await supabaseAdmin.from('user_profiles').insert({
  id: created.user.id,
  assembly_id: adminAssemblyId,
  role: roleRaw,
  full_name: fullName,
  is_active: true,
  must_change_password: true,   // forced change on first login
})

await supabaseAdmin.from('members')
  .update({ auth_user_id: created.user.id })
  .eq('id', memberId)

return { userId: created.user.id, phone: member.phone_number, fullName, role: roleRaw, path: 'default_password' }
```

#### Path C — `custom_password` (admin sets a one-off password)

Use case: staff accounts (admin, secretary, pastor) where the person is
present and the admin sets a specific password communicated directly.

Contact requirement: email must be available (same as Path A).
Password requirement: minimum 8 characters.

```typescript
const emailFinal = (body.email ?? member.email)?.trim().toLowerCase()
if (!emailFinal) { /* 400 */ }
if (!body.password || body.password.length < 8) {
  return 400 "Password must be at least 8 characters."
}

const { data: created } = await supabaseAdmin.auth.admin.createUser({
  email: emailFinal,
  password: body.password,
  email_confirm: true,
})

await supabaseAdmin.from('user_profiles').insert({
  id: created.user.id,
  assembly_id: adminAssemblyId,
  role: roleRaw,
  full_name: fullName,
  is_active: true,
  must_change_password: true,   // forced change on first login
})

await supabaseAdmin.from('members')
  .update({ auth_user_id: created.user.id, email: emailFinal })
  .eq('id', memberId)

return { userId: created.user.id, email: emailFinal, fullName, role: roleRaw, path: 'custom_password' }
```

#### Rollback — all paths

If `user_profiles` insert or `members` update fails after auth user creation:

```typescript
try {
  // ... profile insert + member update
} catch (e) {
  // Best-effort rollback — delete the dangling auth user
  await supabaseAdmin.auth.admin.deleteUser(newUserId)
  return 500 `Provisioning failed and was rolled back: ${e.message}`
}
```

---

### 2.2 New: `reset-member-password/index.ts`

Resets a provisioned member's auth account back to the assembly default password
and re-flags `must_change_password`. Handles the "forgot password" case without
deleting and re-provisioning the account.

```
POST /functions/v1/reset-member-password
body: { memberId: string }
```

```typescript
// Guards:
// 1. Caller must be admin in own assembly
// 2. member.auth_user_id must be non-null (must have an account to reset)
// 3. Read assembly default_member_password — 400 if null

await supabaseAdmin.auth.admin.updateUserById(member.auth_user_id, {
  password: assembly.default_member_password,
})

await supabaseAdmin.from('user_profiles').update({
  must_change_password: true,
}).eq('id', member.auth_user_id)

return { success: true }
```

**File:** `supabase/functions/reset-member-password/index.ts`

---

### 2.3 New: `delete-member-auth/index.ts`

Deletes the auth account linked to a member without touching the member
record itself. Clears `auth_user_id` on the member row and deletes the
`user_profiles` row. The member can be re-provisioned cleanly afterwards.

Use cases:
- Failed invite — member never received/clicked the link.
- Admin provisioned with wrong email or role.
- Account needs to be fully reset.

```
POST /functions/v1/delete-member-auth
body: { memberId: string }
```

```typescript
// Guards:
// 1. Caller must be admin in own assembly
// 2. member.auth_user_id must be non-null (nothing to delete otherwise)

const authUserId = member.auth_user_id

// Order matters: clear the FK before deleting the auth user
// to avoid FK violation on user_profiles.id -> auth.users.id
await supabaseAdmin.from('members')
  .update({ auth_user_id: null })
  .eq('id', memberId)

await supabaseAdmin.from('user_profiles')
  .delete()
  .eq('id', authUserId)

await supabaseAdmin.auth.admin.deleteUser(authUserId)

return { success: true }
```

**File:** `supabase/functions/delete-member-auth/index.ts`

---

### 2.4 New: `set-assembly-default-password/index.ts`

```
POST /functions/v1/set-assembly-default-password
body: { password: string }
```

```typescript
// Guards:
// 1. Caller must be admin
// 2. Validate password strength:
//    - min 8 characters
//    - at least one uppercase letter
//    - at least one digit
//    - at least one special character
//    Return 400 with specific message for each failed rule.

await supabaseAdmin.from('assemblies')
  .update({ default_member_password: password })
  .eq('id', adminAssemblyId)

return { success: true }
```

**File:** `supabase/functions/set-assembly-default-password/index.ts`

---

### 2.5 New: `bulk-import-members/index.ts`

```
POST /functions/v1/bulk-import-members
body: { members: BulkMemberRow[] }
```

```typescript
// Guards:
// 1. Caller must be admin or secretary
// 2. Validate each row with BulkMemberRowSchema
// 3. Deduplicate phone_number against existing members in the assembly
// 4. Force assembly_id from caller's profile on every row (ignore any
//    assembly_id the caller may have included in the payload)

// Collect valid rows and error rows separately
// Batch insert valid rows via supabaseAdmin.from('members').insert(validRows)
// membership_number NOT assigned here — done per-member from the profile page

return {
  imported: validRows.length,
  skipped:  errorRows.length,
  errors:   errorRows.map(r => ({ row: r.index, reason: r.reason }))
}
```

**File:** `supabase/functions/bulk-import-members/index.ts`

---

## 3. Types & Zod schemas

---

### 3.1 Update `src/types/member.types.ts`

Add provisioning and bulk import types.
Database-generated types will cover the new DB columns automatically
after migration + type regeneration (§1.4).

```typescript
// ── Provision ─────────────────────────────────────────────────────────────────

export type ProvisionPath = 'invite' | 'default_password' | 'custom_password'

export interface ProvisionUserPayload {
  memberId:  string
  role:      string
  path:      ProvisionPath
  email?:    string
  password?: string   // custom_password path only
}

export interface ProvisionUserResult {
  userId:   string
  email?:   string
  phone?:   string
  fullName: string
  role:     string
  path:     ProvisionPath
}

// ── Bulk import ───────────────────────────────────────────────────────────────

export interface BulkMemberRow {
  first_name:        string
  last_name:         string
  gender:            'male' | 'female'
  membership_status?: string
  phone_number?:     string | null
  email?:            string | null
  date_of_birth?:    string | null   // YYYY-MM-DD
  marital_status?:   string | null
  join_date?:        string | null   // YYYY-MM-DD
  occupation?:       string | null
  physical_address?: string | null
}

export interface BulkImportResult {
  imported: number
  skipped:  number
  errors:   Array<{ row: number; reason: string }>
}
```

---

### 3.2 Update `src/modules/membership/schemas/member.schema.ts`

Reflect the new contact constraint: both optional, at least one required.

```typescript
import { z } from 'zod'

export const CreateMemberSchema = z.object({
  first_name:        z.string().min(1, 'First name is required'),
  last_name:         z.string().min(1, 'Last name is required'),
  gender:            z.enum(['male', 'female']),
  membership_status: z.enum(['active','inactive','visitor','prospect','transfer','deceased'])
                      .default('active'),
  phone_number:      z.string().nullable().optional(),
  email:             z.string().email('Invalid email address').nullable().optional(),
  date_of_birth:     z.string().date().nullable().optional(),
  marital_status:    z.enum(['single','married','widowed','divorced','separated'])
                      .nullable().optional(),
  join_date:         z.string().date().nullable().optional(),
  occupation:        z.string().nullable().optional(),
  physical_address:  z.string().nullable().optional(),
  household_id:      z.string().uuid().nullable().optional(),
  assembly_id:       z.string().uuid(),
}).refine(
  (data) => data.phone_number || data.email,
  {
    message: 'At least one of phone number or email is required',
    path: ['phone_number'],   // surface error on the phone field in the form
  }
)

export type CreateMemberPayload = z.infer<typeof CreateMemberSchema>
export const UpdateMemberSchema = CreateMemberSchema.partial().omit({ assembly_id: true })
export type UpdateMemberPayload = z.infer<typeof UpdateMemberSchema>
```

---

### 3.3 New: `src/modules/membership/schemas/bulk-import.schema.ts`

```typescript
import { z } from 'zod'

export const BulkMemberRowSchema = z.object({
  first_name:        z.string().min(1, 'first_name is required'),
  last_name:         z.string().min(1, 'last_name is required'),
  gender:            z.enum(['male', 'female']),
  membership_status: z.enum(['active','inactive','visitor','prospect','transfer','deceased'])
                      .default('active'),
  phone_number:      z.string().nullable().optional(),
  email:             z.string().email('Invalid email').nullable().optional(),
  date_of_birth:     z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  marital_status:    z.enum(['single','married','widowed','divorced','separated'])
                      .nullable().optional(),
  join_date:         z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  occupation:        z.string().nullable().optional(),
  physical_address:  z.string().nullable().optional(),
}).refine(
  (data) => data.phone_number || data.email,
  {
    message: 'At least one of phone_number or email is required',
    path: ['phone_number'],
  }
)

export type BulkMemberRowInput = z.infer<typeof BulkMemberRowSchema>
```

---

### 3.4 New: `src/modules/admin/schemas/provision.schema.ts`

```typescript
import { z } from 'zod'

// Discriminated union — each path has different required fields
export const ProvisionUserSchema = z.discriminatedUnion('path', [

  // Path A — send email invite
  z.object({
    path:     z.literal('invite'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
    email:    z.string().email('Valid email required for invite').optional(),
    // email is optional here because it may already be on the member record
  }),

  // Path B — use assembly default password (phone identifier)
  z.object({
    path:     z.literal('default_password'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
    // no email or password — uses phone from member record + assembly default
  }),

  // Path C — admin sets a custom password
  z.object({
    path:     z.literal('custom_password'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
    email:    z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
])

export type ProvisionUserInput = z.infer<typeof ProvisionUserSchema>

// Assembly default password strength rules
export const AssemblyDefaultPasswordSchema = z.string()
  .min(8,                    'Minimum 8 characters')
  .regex(/[A-Z]/,            'Must include at least one uppercase letter')
  .regex(/[0-9]/,            'Must include at least one number')
  .regex(/[^A-Za-z0-9]/,    'Must include at least one special character')
```

---

### 3.5 New: `src/modules/settings/schemas/change-password.schema.ts`

```typescript
import { z } from 'zod'

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
).refine(
  (data) => data.newPassword !== data.currentPassword,
  { message: 'New password must be different from your current password', path: ['newPassword'] }
)

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
```

---

## 4. Permissions

**File:** `src/core/permissions.ts`

Add new permission strings to the relevant roles. `admin` already has `'*'`
(wildcard) so only `secretary` needs explicit additions.

```typescript
const rolePermissions: Record<string, string[]> = {
  admin: ['*'],

  secretary: [
    // ... existing secretary permissions ...
    'membership.members.import',   // may bulk import members
    // Note: secretary cannot provision, reset, or delete auth accounts
    // Those are admin-only (admin.users.*)
  ],

  pastor: [
    // ... existing pastor permissions ...
    // pastors have no admin.users.* permissions
  ],

  // member, volunteer, usher — unchanged
}
```

New permission strings introduced in this plan:

| Permission | Roles | Purpose |
|---|---|---|
| `membership.members.import` | admin, secretary | Access bulk import page + button |
| `admin.users.provision` | admin | Provision login button + page |
| `admin.users.reset` | admin | Reset to default password button |
| `admin.users.delete` | admin | Delete auth account button |
| `admin.settings` | admin | Assembly settings page |

---

## 5. Core layer changes

### 5.1 New guard: `src/core/guards/mustChangePasswordGuard.ts`

Intercepts navigation for users whose `must_change_password` is `true`.
Redirects to `/change-password` before any protected route renders.

```typescript
import { getCurrentUser } from '@core/auth'
import type { GuardFn }   from '@types/module.types'

export const mustChangePasswordGuard: GuardFn = async () => {
  const user = getCurrentUser()
  if (!user) return { allowed: true }  // authGuard handles unauthenticated

  if ((user as any).must_change_password === true) {
    return { allowed: false, redirect: '/change-password' }
  }

  return { allowed: true }
}
```

---

### 5.2 Register guard in `src/core/middleware.ts`

```typescript
import { mustChangePasswordGuard } from './guards/mustChangePasswordGuard'

const guardMap: Record<string, GuardFn> = {
  auth:               authGuard,
  permissions:        permissionGuard,
  onboarding:         onboardingGuard,
  mustChangePassword: mustChangePasswordGuard,   // ← add
}
```

**Critical:** the guard key `'mustChangePassword'` must NOT be added to
the `/change-password` route's `middleware` array — doing so creates an
infinite redirect loop. That route uses `['auth']` only.

---

### 5.3 Update `src/core/auth.ts` — select `must_change_password`

Ensure the `user_profiles` fetch explicitly selects the new column:

```typescript
export async function loadCurrentUser(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { _currentUser = null; return }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, must_change_password')   // ← ensure this is selected
    .eq('id', user.id)
    .single()

  _currentUser = { ...user, ...profile }
  _activeAssemblyId = profile?.role === 'super_admin'
    ? null
    : profile?.assembly_id ?? null
}
```

After type regeneration (§1.4), `must_change_password` is typed correctly
on `UserProfileRow` — no cast needed.

---

## 6. Auth module changes

### 6.1 Update `src/modules/auth/pages/Login.ts`

Add phone sign-in as an alternative to email sign-in.

**UI layout:**

```
┌─────────────────────────────────────┐
│  Sign in to CACI Hub                │
│                                     │
│  Sign in with  [Email] [Phone]      │  ← tab toggle
│                                     │
│  [Email tab active]                 │
│  Email     [____________________]   │
│  Password  [____________________]   │
│                                     │
│  [Phone tab active]                 │
│  Phone     [+233 _______________]   │
│  Password  [____________________]   │
│                                     │
│  [Sign in]                          │
│                                     │
│  Forgot password?                   │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
// Toggle between email and phone mode
let signInMode: 'email' | 'phone' = 'email'

// On submit — call signInWithPassword with the correct identifier
const identifier = signInMode === 'email'
  ? { email: emailInput.value.trim(), password: passwordInput.value }
  : { phone: phoneInput.value.trim(), password: passwordInput.value }

const { error } = await supabase.auth.signInWithPassword(identifier)

if (error) {
  // Surface inline error above the form
  // "Invalid email or password" — same message for both modes
  // intentionally vague: do not confirm whether the identifier exists
  showInlineError('Invalid credentials. Please try again.')
  return
}

// On success — loadCurrentUser() then check must_change_password
await loadCurrentUser()
const user = getCurrentUser()!

if (user.must_change_password) {
  navigate('/change-password?forced=true')
} else {
  navigate('/dashboard')
}
```

**Note on "Forgot password?":**
- Email mode → navigates to `/forgot-password` (existing `ForgotPassword.ts`)
- Phone mode → show inline message:
  `"To reset your password, please contact your assembly administrator."`
  This is intentional — phone accounts reset via the admin until OTP/email
  is configured.

**Supabase dashboard prerequisite:**
Auth → Settings → Phone Auth → **"Enable phone password sign-in"** → ON.
Document this in the project README as a required one-time setup step.

---

### 6.2 Update `src/modules/auth/routes.ts`

Add `mustChangePassword` guard to all authenticated routes.
The Login, ForgotPassword, ResetPassword, and ChangePassword routes
must NOT have this guard.

```typescript
// All routes that require authentication — add 'mustChangePassword'
// Example:
{
  path:       '/members',
  page:       () => import('./pages/MemberList'),
  middleware: ['auth', 'mustChangePassword', 'permissions'],
  permission: 'membership.view',
}

// Routes that must NOT have the guard:
{
  path:         '/login',
  page:         () => import('../auth/pages/Login'),
  middleware:   [],
  presentation: 'fullscreen',
},
{
  path:         '/change-password',
  page:         () => import('../settings/pages/ChangePassword'),
  middleware:   ['auth'],    // auth only — NO mustChangePassword
  presentation: 'fullscreen',
},
```

The `mustChangePassword` guard should be added to routes in:
- `src/modules/membership/routes.ts` — all routes
- `src/modules/admin/routes.ts` — all routes
- `src/modules/dashboard/routes.ts` — all routes
- `src/modules/settings/routes.ts` — all routes EXCEPT `/change-password`

---

## 7. Settings module

### 7.1 New page: `src/modules/settings/pages/ChangePassword.ts`

This page serves two modes determined by the URL query parameter:

- **Forced mode** (`/change-password?forced=true`): reached via
  `mustChangePasswordGuard`. Non-dismissable — back button and all
  navigation is disabled. Page has `presentation: 'fullscreen'`
  so no sidebar or toolbar appears.

- **Voluntary mode** (`/change-password`): reached from Settings.
  Normal navigation — user can go back. Standard shell layout.

**UI:**

```
[Forced mode only]
┌─────────────────────────────────────┐
│  Welcome to CACI Hub                │
│                                     │
│  You need to set a new password     │
│  before continuing.                 │
│                                     │
│  Current password  [__________]     │
│  New password      [__________]     │
│  Confirm password  [__________]     │
│                                     │
│  [Set password]                     │
│                                     │
│  ← Back  (disabled in forced mode)  │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
import { ChangePasswordSchema } from '../schemas/change-password.schema'
import { supabase }             from '@core/supabase'
import { loadCurrentUser,
         getCurrentUser }       from '@core/auth'
import { navigate }             from '@core/router'
import { Toast }                from '@shared/components/Toast'
import type { PageModule }      from '@types/module.types'

const ChangePassword: PageModule = {

  async render(container) {
    const forced = new URLSearchParams(
      location.hash.split('?')[1] ?? ''
    ).get('forced') === 'true'

    container.innerHTML = buildUI(forced)
    bindSubmit(container, forced)

    // Forced mode: disable all sidebar links and back navigation
    if (forced) {
      document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
        (a as HTMLAnchorElement).style.pointerEvents = 'none'
      })
    }
  },

  destroy() {
    // Re-enable navigation links if they were disabled
    document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
      (a as HTMLAnchorElement).style.pointerEvents = ''
    })
  }
}

async function bindSubmit(container: HTMLElement, forced: boolean) {
  container.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault()

    const currentPassword = (container.querySelector('#current-password') as HTMLInputElement).value
    const newPassword     = (container.querySelector('#new-password') as HTMLInputElement).value
    const confirmPassword = (container.querySelector('#confirm-password') as HTMLInputElement).value

    // 1. Zod validation
    const result = ChangePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword })
    if (!result.success) {
      showZodErrors(container, result.error)
      return
    }

    // 2. Disable submit button + show spinner
    const btn = container.querySelector<HTMLButtonElement>('[type=submit]')!
    btn.disabled = true
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'

    // 3. Re-authenticate with current password
    //    Works for both email and phone accounts
    const user = getCurrentUser()!
    const identifier = user.email
      ? { email: user.email,  password: currentPassword }
      : { phone: user.phone!, password: currentPassword }

    const { error: reAuthError } = await supabase.auth.signInWithPassword(identifier)
    if (reAuthError) {
      Toast.error('Current password is incorrect.')
      btn.disabled = false
      btn.textContent = 'Set password'
      return
    }

    // 4. Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      Toast.error('Failed to update password. Please try again.')
      btn.disabled = false
      btn.textContent = 'Set password'
      return
    }

    // 5. Clear must_change_password flag
    if (forced) {
      await supabase.from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    // 6. Refresh in-memory user
    await loadCurrentUser()

    // 7. Navigate
    if (forced) {
      navigate('/dashboard')
    } else {
      Toast.success('Password changed successfully.')
      navigate('/settings')
    }
  })
}

export default ChangePassword
```

---

### 7.2 Update `src/modules/settings/pages/Settings.ts`

Add a "Change password" link/button that navigates to `/change-password`
(voluntary mode — no `?forced=true`).

```typescript
// Inside the account settings section:
container.querySelector('#change-password-btn')!.addEventListener('click', () => {
  navigate('/change-password')
})
```

---

### 7.3 Update `src/modules/settings/routes.ts`

```typescript
export const settingsRoutes: RouteDefinition[] = [
  {
    path:       '/settings',
    page:       () => import('./pages/Settings'),
    middleware: ['auth', 'mustChangePassword', 'permissions'],
    permission: 'profile.view',
  },
  {
    path:         '/change-password',
    page:         () => import('./pages/ChangePassword'),
    middleware:   ['auth'],        // NO mustChangePassword guard
    presentation: 'fullscreen',   // no shell in forced mode
  },
]
```

---

## 8. Membership module changes

### 8.1 Update `src/modules/membership/pages/AddMember.ts` and `EditMember.ts`

Reflect the updated `CreateMemberSchema` — both phone and email are now
optional fields with a combined "at least one" validation.

**Form UI change:**

```
Contact Information
  Phone number   [________________]  (optional)
  Email          [________________]  (optional)

  ⚠ At least one of phone number or email is required.
    (shown inline only when both are empty on submit)
```

The Zod `.refine()` error surfaces on the `phone_number` path — display it
below the phone field so it reads naturally.

---

### 8.2 Update `src/modules/membership/pages/MemberProfile.ts`

Add three admin-only action buttons to the profile page, shown only when
the member has been provisioned a login (`auth_user_id` is non-null)
or is ready to be provisioned (for the Provision button).

```typescript
const user = getCurrentUser()!

// ── No auth account yet ────────────────────────────────────────────────────
if (!member.auth_user_id && hasPermission(user.role, 'admin.users.provision')) {
  renderProvisionButton(container, member)
}

// ── Has auth account ────────────────────────────────────────────────────────
if (member.auth_user_id) {
  // "Login active" badge — visible to all roles who can see the profile
  renderLoginActiveBadge(container)

  // Reset to default — admin only
  if (hasPermission(user.role, 'admin.users.reset')) {
    renderResetPasswordButton(container, member)
  }

  // Delete auth account — admin only
  if (hasPermission(user.role, 'admin.users.delete')) {
    renderDeleteAuthButton(container, member)
  }
}
```

**Reset password button handler:**

```typescript
async function onResetPassword(member: MemberView) {
  const confirmed = await ConfirmDialog.show({
    title:   'Reset to default password?',
    message: `${member.first_name} ${member.last_name} will be required to
               change their password on next login.`,
    confirm: 'Reset password',
    danger:  true,
  })
  if (!confirmed) return

  const { error } = await supabase.functions.invoke('reset-member-password', {
    body: { memberId: member.id }
  })

  if (error) {
    Toast.error(error.message ?? 'Failed to reset password.')
    return
  }

  Toast.success('Password reset to assembly default.')
}
```

**Delete auth account button handler:**

```typescript
async function onDeleteAuth(member: MemberView) {
  const confirmed = await ConfirmDialog.show({
    title:   'Delete login account?',
    message: `This removes ${member.first_name}'s app access. Their member
               record is not affected. You can re-provision them afterwards.`,
    confirm: 'Delete login',
    danger:  true,
  })
  if (!confirmed) return

  const { error } = await supabase.functions.invoke('delete-member-auth', {
    body: { memberId: member.id }
  })

  if (error) {
    Toast.error(error.message ?? 'Failed to delete login account.')
    return
  }

  Toast.success('Login account removed.')
  emit('member:updated', { memberId: member.id })

  // Re-render — profile now shows "Provision Login" button
  navigate(`/members/${member.id}`)
}
```

---

### 8.3 Update `src/modules/membership/pages/MemberList.ts`

Add the "Bulk Import" button to the action bar, gated by
`membership.members.import` permission.

```typescript
if (hasPermission(getCurrentUser()!.role, 'membership.members.import')) {
  const btn = document.createElement('a')
  btn.href      = '#/members/import'
  btn.className = 'btn btn-outline-secondary btn-sm'
  btn.innerHTML = '<i class="bi bi-upload me-1"></i>Bulk Import'
  toolbar.prepend(btn)
}
```

---

### 8.4 New page: `src/modules/membership/pages/BulkImport.ts`

**Skeleton variant:** `'table'` (for the preview grid after parsing)

**Three-step flow:**

```
Step 1 — Upload
  [Download template]  ← generates and downloads the XLSX template
  [Choose CSV file]
  Accepted: .csv, .xlsx
  On file select → parse → go to Step 2

Step 2 — Preview
  renderSkeleton(container, 'table') while parsing
  AG Grid: all rows, valid = green, invalid = red + error column
  Summary bar: "287 valid  ·  13 invalid"
  [Import 287 valid rows]   [Re-upload]

Step 3 — Result
  ✓ 287 members imported
  ⚠ 13 rows skipped
  [collapsible error table]
  [Download error report]   [Go to Members]
```

**CSV header normalisation map:**

```typescript
const HEADER_MAP: Record<string, string> = {
  'first name':     'first_name',
  'firstname':      'first_name',
  'last name':      'last_name',
  'lastname':       'last_name',
  'phone':          'phone_number',
  'mobile':         'phone_number',
  'mobile number':  'phone_number',
  'dob':            'date_of_birth',
  'birth date':     'date_of_birth',
  'status':         'membership_status',
  'address':        'physical_address',
  'job':            'occupation',
}
```

**Error report download:** build a CSV Blob client-side from the `errors`
array — no server round-trip needed.

**After successful import:** emit `member:bulk-imported` on the event bus
so `memberCache` is cleared.

```typescript
import { emit } from '@core/events'
emit('member:bulk-imported')
navigate('/members')
```

---

### 8.5 Update `src/modules/membership/index.ts`

Add `member:bulk-imported` listener in `init()` to clear the cache:

```typescript
async init({ supabase, eventBus }) {
  // ... existing Realtime subscription ...

  // Clear member cache after a bulk import
  on('member:bulk-imported', () => memberCache.clearMemberCache())
}
```

---

### 8.6 Update `src/modules/membership/routes.ts`

```typescript
// Add bulk import route
{
  path:       '/members/import',
  page:       () => import('./pages/BulkImport'),
  middleware: ['auth', 'mustChangePassword', 'permissions'],
  permission: 'membership.members.import',
},
```

Add `'mustChangePassword'` to every existing membership route's
`middleware` array.

---

## 9. Admin module — activate & implement

The admin module is currently `enabled: false`. Flip it and implement all pages.

### 9.1 Update `src/modules/admin/index.ts`

```typescript
const AdminModule: ModuleManifest = {
  name:        'admin',
  version:     '1.0.0',
  description: 'User provisioning, account management, assembly settings',
  icon:        'shield-lock-fill',
  enabled:     true,    // ← flip from false

  routes: [
    {
      path:       '/admin/users',
      page:       () => import('./pages/UserManagement'),
      middleware: ['auth', 'mustChangePassword', 'permissions'],
      permission: 'admin.users.provision',
    },
    {
      path:       '/admin/provision-user',
      page:       () => import('./pages/ProvisionUser'),
      middleware: ['auth', 'mustChangePassword', 'permissions'],
      permission: 'admin.users.provision',
    },
    {
      path:       '/admin/assembly-settings',
      page:       () => import('./pages/AssemblySettings'),
      middleware: ['auth', 'mustChangePassword', 'permissions'],
      permission: 'admin.settings',
    },
    {
      path:       '/admin/audit-log',
      page:       () => import('./pages/GlobalAuditLog'),
      middleware: ['auth', 'mustChangePassword', 'permissions'],
      permission: 'admin.settings',
    },
  ],

  sidebar: {
    label:      'Admin',
    icon:       'shield-lock-fill',
    path:       '/admin/users',
    permission: 'admin.users.provision',
    order:      10,
    badge:      null,
  },
}

export default AdminModule
```

---

### 9.2 New page: `src/modules/admin/pages/ProvisionUser.ts`

Route param: `memberId` passed via `container.dataset.memberId`.
Set by navigating: `navigate('/admin/provision-user?memberId=' + member.id)`

**Skeleton variant:** `'form'`

**Page flow:**

```
renderSkeleton(container, 'form')
↓
repo.getById(memberId) via members_view
↓
Render:

Member: Abraham Bossman  (CACI-GH-ASSAK-00001)
Assembly: Christ Apostolic Church International — Assakae

Role  [Member ▾]
  Options: Admin · Pastor · Secretary · Volunteer · Member

─────────────────────────────────────────
How should this member sign in?

  ○ Send email invite
    (shown only if member.email is non-null)
    Sends a link to: obboyebossman@gmail.com
    Member sets their own password.

  ○ Use assembly default password
    (shown only if member.phone_number is non-null)
    Member signs in with their phone number.
    They will be prompted to change the password on first login.
    [⚠ shown if default password not configured]

  ○ Set a custom password
    Always shown (for staff accounts)
    Email  [pre-filled from member.email or empty]
    Password  [________________]  (min 8 characters)
─────────────────────────────────────────

[Provision Login]   ← disabled + spinner while in flight

[← Back to member profile]
```

**No path available warning:** if the member has neither email nor phone,
show an error state instead of the form:

```
⚠ Cannot provision login

This member has no email address and no phone number.
At least one contact method is required to create a login.

Please edit the member record first.

[Edit member]   [← Back]
```

**On success — inline result (do not navigate away):**

```
// invite:
✓ Invite sent
  An email has been sent to obboyebossman@gmail.com with a sign-in link.

// default_password:
✓ Login created
  This member can sign in using their phone number and the assembly
  default password. They will be prompted to change it on first login.

// custom_password:
✓ Login created
  [Back to member profile]
```

**Error handling:**

| HTTP | Toast message |
|---|---|
| 409 | "This member already has a login. Use Reset Account to clear it first." |
| 400 (no default) | "Assembly default password not set. Configure it in Assembly Settings." |
| 400 (no email) | "No email address found. Enter one in the form or choose a different method." |
| 400 (no phone) | "No phone number found. Edit the member record to add one." |
| 403 | "This member is not in your assembly." |
| 500 | "Something went wrong. The operation was rolled back." |

**After success:** emit `member:updated` via event bus.

---

### 9.3 New page: `src/modules/admin/pages/AssemblySettings.ts`

**Skeleton variant:** `'form'`

```
renderSkeleton(container, 'form')
↓
adminRepo.getAssembly(assemblyId)
↓
Render:

Assembly Settings
Assembly: Christ Apostolic Church International — Assakae (GH-ASSAK)

── Default member password ────────────────────────────────────
Used when provisioning members who sign in with their phone number.
Members will be prompted to change it on first login.

Current status:
  ● Configured       (shows when default_member_password IS NOT NULL)
  ✗ Not configured   (shows when default_member_password IS NULL)

Set new default password
  Password  [________________]
  Confirm   [________________]

  Strength indicator — inline feedback per Zod rule:
    ✓ At least 8 characters
    ✓ One uppercase letter
    ✓ One number
    ✓ One special character

[Save default password]
```

**On success:** `Toast.success('Assembly default password updated.')`
**On error:** `Toast.error(message)` using Zod error messages for
strength failures, Edge Function message for server errors.

---

### 9.4 Implement `src/modules/admin/pages/UserManagement.ts`

Replace the stub. Lists all `user_profiles` rows for the assembly —
members who have been provisioned a login.

**Skeleton variant:** `'table'`

**Columns (AG Grid):**
Full name · Role · Email / Phone · Status (active/inactive) ·
Member profile link · Provisioned date

Each row has a context menu or action column:
- **View member** → navigates to `/members/:id`
- **Reset password** → calls `reset-member-password` Edge Function inline
- **Delete login** → calls `delete-member-auth` Edge Function with confirmation

---

### 9.5 New: `src/modules/admin/repository.ts`

```typescript
import { supabase }        from '@core/supabase'
import { RepositoryError } from '@shared/utils/repositoryError'
import type {
  ProvisionUserPayload,
  ProvisionUserResult,
} from '@types/member.types'

export async function provisionUser(
  payload: ProvisionUserPayload
): Promise<ProvisionUserResult> {
  const { data, error } = await supabase.functions.invoke('provision-user', {
    body: payload,
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Provisioning failed'),
    error,
    extractErrorCode(error),
  )
  return data as ProvisionUserResult
}

export async function resetMemberPassword(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-member-password', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Password reset failed'),
    error,
  )
}

export async function deleteMemberAuth(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-member-auth', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to delete login account'),
    error,
  )
}

export async function setAssemblyDefaultPassword(password: string): Promise<void> {
  const { error } = await supabase.functions.invoke(
    'set-assembly-default-password',
    { body: { password } }
  )
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to set default password'),
    error,
  )
}

export async function getAssembly(assemblyId: string) {
  const { data, error } = await supabase
    .from('assemblies')
    .select('id, name, assembly_code, address, default_member_password')
    .eq('id', assemblyId)
    .single()
  if (error) throw new RepositoryError('Failed to load assembly', error)
  return data
}

// Helpers to extract message and code from Supabase FunctionsHttpError
function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as any).context
    if (ctx?.error) return ctx.error
  }
  return fallback
}

function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return String((error as any).status)
  }
  return undefined
}
```

---

## 10. Module manifests & routes

### 10.1 `mustChangePassword` guard on all authenticated routes

Add `'mustChangePassword'` to the `middleware` array in:

| File | Routes affected |
|---|---|
| `src/modules/membership/routes.ts` | All routes |
| `src/modules/admin/routes.ts` | All routes |
| `src/modules/dashboard/routes.ts` | All routes |
| `src/modules/settings/routes.ts` | All routes EXCEPT `/change-password` |

### 10.2 Event bus additions

Register these new event names in `src/core/events.ts` comments:

```typescript
// New events added in this plan:
// member:bulk-imported  — emitted by BulkImport.ts; clears memberCache
// member:provisioned    — emitted by ProvisionUser.ts on success
// member:auth-deleted   — emitted by MemberProfile.ts after delete-member-auth
// member:auth-reset     — emitted by MemberProfile.ts after reset-member-password
```

### 10.3 `main.ts` — register admin module

```typescript
// Already registered but disabled — no change to main.ts needed.
// Flipping enabled: true in admin/index.ts is sufficient.
registerModule(AdminModule)   // already present
```

---

## 11. Testing

### 11.1 Vitest unit tests

**`change-password.schema.test.ts`**
- Valid input → passes
- `newPassword` shorter than 8 → fails "at least 8 characters"
- `newPassword !== confirmPassword` → fails "Passwords do not match"
- `newPassword === currentPassword` → fails "must be different"

**`provision.schema.test.ts`**
- `invite` path + valid UUID + role → passes
- `invite` path + invalid email → fails
- `custom_password` path + password length 7 → fails
- `default_password` path — no password field → passes
- `AssemblyDefaultPasswordSchema` — missing uppercase → fails
- `AssemblyDefaultPasswordSchema` — missing special char → fails

**`bulk-import.schema.test.ts`**
- Valid row, all fields → passes
- Missing `first_name` → fails
- Both `phone_number` and `email` null → fails "at least one required"
- Invalid email format → fails
- Invalid date format → fails
- Valid row, only `phone_number` provided → passes
- Valid row, only `email` provided → passes

**`member.schema.test.ts`** (update existing)
- Both `phone_number` and `email` null → fails "at least one required"
- Only `phone_number` provided → passes
- Only `email` provided → passes

**`mustChangePasswordGuard.test.ts`**
- `must_change_password: true` → `{ allowed: false, redirect: '/change-password' }`
- `must_change_password: false` → `{ allowed: true }`
- No current user → `{ allowed: true }`

**`permissions.test.ts`** (extend existing)
- `hasPermission('secretary', 'membership.members.import')` → true
- `hasPermission('pastor', 'admin.users.provision')` → false
- `hasPermission('admin', 'admin.users.delete')` → true
- `hasPermission('volunteer', 'admin.users.provision')` → false

---

### 11.2 Playwright E2E tests

**Force password change flow**
1. Sign in with a provisioned account (`must_change_password: true`).
2. Confirm redirect to `/change-password` before any other page loads.
3. Attempt to navigate to `/members` — confirm still on `/change-password`.
4. Enter wrong current password → "Current password is incorrect."
5. Enter correct current password + valid new password → success.
6. Confirm redirect to `/dashboard`.
7. Confirm `must_change_password` is `false` in `user_profiles`.
8. Sign out and sign back in → confirm no redirect to `/change-password`.

**Voluntary password change flow**
1. Sign in normally.
2. Navigate to `/settings`.
3. Click "Change password".
4. Confirm navigated to `/change-password` (no `?forced=true`).
5. Change password successfully → `Toast.success` + redirect to `/settings`.

**Phone sign-in**
1. On login page, click "Phone" tab.
2. Enter phone number + password → sign in.
3. Confirm shell renders and user is authenticated.

**Provision — invite path**
1. Sign in as admin.
2. Navigate to a member profile with email, no `auth_user_id`.
3. Click "Provision Login" → navigate to `/admin/provision-user?memberId=...`.
4. Select "Send email invite" + role → submit.
5. Confirm success message.
6. Navigate back to member profile → "Login active" badge visible.
7. Confirm `user_profiles` row: `must_change_password: false`.

**Provision — default password path**
1. Set assembly default password via `/admin/assembly-settings`.
2. Navigate to a member profile with phone only (no email).
3. Provision via "Use assembly default".
4. Sign in as that member using phone + default password.
5. Confirm redirect to `/change-password?forced=true`.
6. Change password → confirm redirect to `/dashboard`.

**Provision — custom password path**
1. Navigate to a member profile with email.
2. Provision via "Set a custom password" with a valid password.
3. Confirm success.
4. Sign in as that member with email + custom password.
5. Confirm redirect to `/change-password?forced=true`.

**Reset to default password**
1. Sign in as admin.
2. Navigate to a member profile with an active login.
3. Click "Reset to default password" → confirm dialog → confirm.
4. Confirm `Toast.success`.
5. Sign in as that member with old password → fails.
6. Sign in with default password → succeeds + forced change screen shown.

**Delete auth account**
1. Sign in as admin.
2. Navigate to a member profile with an active login.
3. Click "Delete login" → confirm dialog → confirm.
4. Confirm "Login active" badge is gone; "Provision Login" button appears.
5. Confirm `members.auth_user_id` is null.
6. Confirm `user_profiles` row is deleted.
7. Confirm the member's auth.users account is deleted (via dashboard).
8. Re-provision the member → succeeds.

**Bulk import**
1. Upload CSV with 5 valid rows + 1 invalid (missing `first_name`).
2. Preview table: 5 green, 1 red.
3. Import → "5 imported · 1 skipped".
4. Navigate to members list → 5 new rows visible.
5. Confirm none have `auth_user_id` set.
6. Download error report → CSV has 1 row with reason.

**Error paths**

| Scenario | Expected |
|---|---|
| Provision member already provisioned | 409 → correct message |
| Provision with no default configured (Path B) | 400 → message + disabled submit |
| Provision member with no email and no phone | Error state replaces form |
| Delete login on un-provisioned member | Button not visible |
| `must_change_password` user navigates to `/members` | Redirect to `/change-password` |
| Secretary accesses `/admin/provision-user` | Redirect to `/unauthorized` |

---

## 12. File map

### New files

| File | Module | Notes |
|---|---|---|
| `20260520000001_add_assembly_default_password.sql` | DB | `assemblies.default_member_password` |
| `20260520000002_add_must_change_password.sql` | DB | `user_profiles.must_change_password` |
| `20260520000003_member_contact_optional.sql` | DB | Both fields optional, check constraint |
| `supabase/functions/provision-user/index.ts` | Edge Function | Three-path (replaces existing) |
| `supabase/functions/reset-member-password/index.ts` | Edge Function | Reset to default password |
| `supabase/functions/delete-member-auth/index.ts` | Edge Function | Delete auth without deleting member |
| `supabase/functions/set-assembly-default-password/index.ts` | Edge Function | Validated default password setter |
| `supabase/functions/bulk-import-members/index.ts` | Edge Function | Batch member insert |
| `src/core/guards/mustChangePasswordGuard.ts` | core | Intercept `must_change_password: true` |
| `src/modules/settings/pages/ChangePassword.ts` | settings | Forced + voluntary password change |
| `src/modules/settings/schemas/change-password.schema.ts` | settings | Zod schema |
| `src/modules/admin/repository.ts` | admin | All admin Edge Function calls |
| `src/modules/admin/schemas/provision.schema.ts` | admin | Discriminated union + password schema |
| `src/modules/admin/pages/ProvisionUser.ts` | admin | Three-path provision form (replaces stub) |
| `src/modules/admin/pages/AssemblySettings.ts` | admin | Set default member password |
| `src/modules/membership/schemas/bulk-import.schema.ts` | membership | Zod schema for CSV rows |
| `src/modules/membership/pages/BulkImport.ts` | membership | CSV upload + preview + import |
| `CACI_Member_Import_Template.xlsx` | asset | Distribute to admin for data prep |

### Modified files

| File | Change |
|---|---|
| `src/types/database.types.ts` | Regenerate after migrations — automatic |
| `src/types/member.types.ts` | Add `ProvisionUserPayload`, `ProvisionUserResult`, `BulkMemberRow`, `BulkImportResult` |
| `src/core/middleware.ts` | Register `mustChangePasswordGuard` |
| `src/core/auth.ts` | Select `must_change_password` in profile fetch |
| `src/core/permissions.ts` | Add `membership.members.import` to secretary |
| `src/modules/auth/pages/Login.ts` | Add phone sign-in tab |
| `src/modules/settings/pages/Settings.ts` | Add "Change password" link |
| `src/modules/settings/routes.ts` | Add `/change-password` route |
| `src/modules/membership/schemas/member.schema.ts` | Both contact fields optional + refine |
| `src/modules/membership/pages/AddMember.ts` | Reflect optional contact fields |
| `src/modules/membership/pages/EditMember.ts` | Reflect optional contact fields |
| `src/modules/membership/pages/MemberProfile.ts` | Provision / reset / delete auth buttons |
| `src/modules/membership/pages/MemberList.ts` | Bulk import button |
| `src/modules/membership/routes.ts` | Add `/members/import`; add `mustChangePassword` guard to all routes |
| `src/modules/membership/index.ts` | Listen `member:bulk-imported` → clear cache |
| `src/modules/admin/index.ts` | `enabled: true`; all four routes |
| `src/modules/admin/pages/UserManagement.ts` | Replace stub |
| `src/modules/admin/pages/GlobalAuditLog.ts` | Replace stub |
| `src/modules/dashboard/routes.ts` | Add `mustChangePassword` to all routes |

---

## 13. Dependency order

```
DB migrations §1.1 → §1.2 → §1.3
  └── Regenerate database.types.ts (§1.4)
        │
        ├── TRACK A: Bulk import (fastest path to adding 300 members)
        │   bulk-import-members EF (§2.5)
        │     └── bulk-import.schema.ts (§3.3)
        │           └── membership/repository bulkImportMembers (§8 repo)
        │                 └── BulkImport.ts page (§8.4)
        │                       └── MemberList.ts button (§8.3)
        │                             └── membership/routes.ts (§8.6)
        │                                   ↓
        │                             UNBLOCKED: add the 300 members
        │
        ├── TRACK B: Password management (independent of Track A)
        │   mustChangePasswordGuard (§5.1)
        │     └── core/middleware.ts (§5.2)
        │           └── core/auth.ts update (§5.3)
        │                 └── ChangePassword.ts + settings/routes.ts (§7.1, §7.3)
        │                       └── Login.ts phone tab (§6.1)
        │                             └── Add mustChangePassword to all routes (§10.1)
        │
        └── TRACK C: Provision + admin (depends on Tracks A & B being designed)
            set-assembly-default-password EF (§2.4)
              └── provision-user EF updated (§2.1)
                    └── reset-member-password EF (§2.2)
                          └── delete-member-auth EF (§2.3)
                                └── provision.schema.ts (§3.4)
                                      └── admin/repository.ts (§9.5)
                                            └── AssemblySettings.ts (§9.3)
                                                  └── ProvisionUser.ts (§9.2)
                                                        └── UserManagement.ts (§9.4)
                                                              └── MemberProfile.ts buttons (§8.2)
                                                                    └── Admin module enabled (§9.1)
                                                                          └── Testing (§11)
```

---

## 14. Timeline estimate

| Step | Effort |
|---|---|
| DB migrations + type regeneration (§1) | 0.5 day |
| `bulk-import-members` EF (§2.5) | 1 day |
| `provision-user` three-path update (§2.1) | 1 day |
| `reset-member-password` EF (§2.2) | 0.5 day |
| `delete-member-auth` EF (§2.3) | 0.5 day |
| `set-assembly-default-password` EF (§2.4) | 0.5 day |
| Types + all Zod schemas (§3) | 0.5 day |
| Permissions + `mustChangePasswordGuard` (§4, §5.1, §5.2) | 0.5 day |
| `core/auth.ts` + `Login.ts` phone tab (§5.3, §6.1) | 0.5 day |
| `ChangePassword.ts` + settings routes (§7.1, §7.3) | 0.5 day |
| `AddMember.ts` / `EditMember.ts` contact fields (§8.1) | 0.5 day |
| `MemberProfile.ts` provision + reset + delete buttons (§8.2) | 0.5 day |
| `MemberList.ts` import button (§8.3) | 0.25 day |
| `BulkImport.ts` page (§8.4) | 1.5 days |
| Admin module — all pages + repository (§9) | 2 days |
| Route manifest updates + event bus (§10) | 0.5 day |
| Vitest unit tests (§11.1) | 1 day |
| Playwright E2E tests (§11.2) | 1.5 days |
| **Total** | **~13 days** |

> **Start here — 3-day fast track to unblocking the 300 members:**
> §1 migrations → §2.5 bulk import EF → §3.3 bulk-import schema →
> `BulkImport.ts` page → `MemberList.ts` button → route.
> Everything else can follow in parallel tracks.
