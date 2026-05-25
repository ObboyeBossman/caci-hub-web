# Manual user provisioning — SQL editor runbook
**Version:** 1.0.0  
**Scope:** CACI Hub · Supabase SQL Editor  
**Audience:** Admin / Database operator  
**Last updated:** May 2026

---

## When to use this

Use this runbook when you need to provision an app login for a member
directly from the Supabase SQL editor — without going through the
`provision-user` Edge Function or the web app UI.

**Typical scenarios:**
- The admin module UI is not yet built or deployed.
- You are setting up the first admin account (chicken-and-egg — the admin
  needs a login before they can provision anyone else).
- You need to recover an account after a failed Edge Function provision.
- You are working in a local dev environment with no running frontend.

---

## Prerequisites

- Access to the Supabase dashboard → SQL Editor for your project.
- The target person must already have a **member record** in
  `public.members`. User accounts may not exist without a member record.
- You need the member's `id` (UUID) from the `members` table.
  Find it with:
  ```sql
  SELECT id, first_name, last_name, email, phone_number, auth_user_id
  FROM public.members
  WHERE last_name ILIKE '%bossman%';   -- replace with name
  ```
- Confirm `auth_user_id IS NULL` on the returned row before continuing.
  If it is already set, the member has a login — do not provision again.

---

## Step 0 — Confirm the member has no existing login

```sql
SELECT
  id,
  first_name,
  last_name,
  email,
  phone_number,
  auth_user_id          -- must be NULL before you continue
FROM public.members
WHERE id = '<member-uuid>';
```

**Expected:** `auth_user_id = NULL`  
**If not NULL:** stop — the member already has an account. Use the
`UserManagement` page to manage their existing login instead.

---

## Step 1 — Create the auth user

Run this in the SQL editor. Replace the placeholder values before running.

```sql
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  gen_random_uuid(),
  'member@example.com',             -- ← replace: member's email address
  extensions.crypt(
    'TemporaryPass123!',             -- ← replace: temporary password
    extensions.gen_salt('bf')        --   member will be forced to change this
  ),
  now(),                             -- email pre-confirmed — no confirmation email sent
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
)
RETURNING id;
```

**After running:** copy the returned UUID. You will need it in Steps 2 and 3.

> **Password rules:**  
> Minimum 8 characters. Must contain at least one uppercase letter,
> one number, and one special character.  
> Example: `Welcome2026!`  
> The member will be forced to change this on first login
> (`must_change_password = true` is set in Step 2).

---

## Step 2 — Create the user_profiles row

Replace `<new-user-uuid>` with the UUID returned in Step 1.

```sql
INSERT INTO public.user_profiles (
  id,
  assembly_id,
  role,
  full_name,
  is_active,
  must_change_password
)
VALUES (
  '<new-user-uuid>',                 -- ← from Step 1 RETURNING
  (SELECT id FROM public.assemblies
   WHERE assembly_code = 'GH-ASSAK'),-- ← assembly code for your assembly
  'member',                          -- ← role: admin/pastor/secretary/volunteer/member
  'Abraham Bossman',                 -- ← member's full name
  true,
  true                               -- forces password change on first login
);
```

**Role reference:**

| Role | Who it is for |
|---|---|
| `admin` | Assembly administrator |
| `pastor` | Lead pastor or associate pastor |
| `secretary` | Church secretary |
| `volunteer` | Volunteer with read-only directory access |
| `member` | Regular church member |

---

## Step 3 — Link the auth account to the member record

Replace both UUIDs with real values.

```sql
UPDATE public.members
SET auth_user_id = '<new-user-uuid>'   -- ← from Step 1 RETURNING
WHERE id = '<member-uuid>';            -- ← member's id from Step 0
```

---

## Step 4 — Verify

Run this verification query to confirm all three records are correctly linked.

```sql
SELECT
  m.id              AS member_id,
  m.first_name,
  m.last_name,
  m.auth_user_id,
  up.id             AS profile_id,
  up.role,
  up.is_active,
  up.must_change_password,
  au.email          AS auth_email,
  au.email_confirmed_at
FROM public.members m
JOIN public.user_profiles up ON up.id  = m.auth_user_id
JOIN auth.users au            ON au.id = m.auth_user_id
WHERE m.id = '<member-uuid>';
```

**Expected result:**

| Column | Expected value |
|---|---|
| `member_id` | The member's UUID |
| `auth_user_id` | The new auth user UUID (matches `profile_id`) |
| `role` | The role you assigned |
| `is_active` | `true` |
| `must_change_password` | `true` |
| `auth_email` | The email you used |
| `email_confirmed_at` | A timestamp (not null — pre-confirmed) |

If any of these are wrong, see the **Rollback** section below.

---

## Full script — copy-paste template

Use this when you are confident about the values. Replace all
`← replace` placeholders before running. The transaction ensures
either all three steps succeed or none of them do.

```sql
BEGIN;

-- ── Step 1: Create auth user ──────────────────────────────────────────────────
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  gen_random_uuid(),
  'member@example.com',             -- ← replace
  extensions.crypt(
    'TemporaryPass123!',             -- ← replace
    extensions.gen_salt('bf')
  ),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
)
RETURNING id;

-- ── Stop here, copy the UUID above, paste it into the two queries below ───────

-- ── Step 2: Create user_profiles row ─────────────────────────────────────────
INSERT INTO public.user_profiles (
  id,
  assembly_id,
  role,
  full_name,
  is_active,
  must_change_password
)
VALUES (
  '<new-user-uuid>',                 -- ← paste UUID from Step 1
  (SELECT id FROM public.assemblies
   WHERE assembly_code = 'GH-ASSAK'),-- ← replace if different assembly
  'member',                          -- ← replace with correct role
  'Full Name Here',                  -- ← replace
  true,
  true
);

-- ── Step 3: Link to member record ─────────────────────────────────────────────
UPDATE public.members
SET auth_user_id = '<new-user-uuid>' -- ← paste UUID from Step 1
WHERE id = '<member-uuid>';          -- ← replace with member's id

COMMIT;
```

> **Note on the two-step approach:**  
> `gen_random_uuid()` generates the UUID inside the INSERT, so it is not
> available as a variable within the same transaction in the SQL editor.
> This is why you copy the UUID from the `RETURNING` output and paste it
> manually into Steps 2 and 3. If you are running this via `psql` or a
> script, you can use a CTE to avoid the manual copy:

```sql
-- Alternative: single atomic CTE (psql / scripted use only)
BEGIN;

WITH new_auth_user AS (
  INSERT INTO auth.users (
    id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  )
  VALUES (
    gen_random_uuid(),
    'member@example.com',
    extensions.crypt('TemporaryPass123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}', false, 'authenticated'
  )
  RETURNING id
),
new_profile AS (
  INSERT INTO public.user_profiles (
    id, assembly_id, role, full_name, is_active, must_change_password
  )
  SELECT
    new_auth_user.id,
    (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'),
    'member',
    'Full Name Here',
    true,
    true
  FROM new_auth_user
  RETURNING id
)
UPDATE public.members
SET auth_user_id = (SELECT id FROM new_auth_user)
WHERE id = '<member-uuid>';

COMMIT;
```

---

## Rollback — if something goes wrong

If any step fails or the verification query shows incorrect data,
run this to undo all three steps. Replace `<new-user-uuid>` with
the UUID that was created.

```sql
BEGIN;

-- Unlink from member record
UPDATE public.members
SET auth_user_id = NULL
WHERE auth_user_id = '<new-user-uuid>';

-- Delete user_profiles row
DELETE FROM public.user_profiles
WHERE id = '<new-user-uuid>';

-- Delete auth user
DELETE FROM auth.users
WHERE id = '<new-user-uuid>';

COMMIT;
```

After rollback, verify the member record is clean:

```sql
SELECT id, first_name, last_name, auth_user_id
FROM public.members
WHERE id = '<member-uuid>';
-- Expected: auth_user_id = NULL
```

---

## Communicate credentials to the member

Once provisioning is confirmed, share the login credentials with the member.
The recommended channels for a church context:

- In person — write the temporary password on a card.
- WhatsApp — send directly to the member's phone number on their record.
- Phone call — read the password to the member.

**Do not store the temporary password anywhere** — it is a one-time
bootstrap credential. The member will be forced to change it on first login
(`must_change_password = true`).

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `duplicate key value violates unique constraint "users_email_key"` | Email already exists in `auth.users` | Use a different email, or look up the existing auth user and link them instead |
| `insert or update on table "user_profiles" violates foreign key constraint` | `<new-user-uuid>` does not exist in `auth.users` | Step 1 failed or UUID was copied incorrectly — re-check |
| `duplicate key value violates unique constraint "idx_members_auth_user_id_unique"` | Another member already has this `auth_user_id` | UUID was pasted incorrectly — check which member has it: `SELECT id, first_name FROM members WHERE auth_user_id = '<uuid>'` |
| `UPDATE 0` on Step 3 | `<member-uuid>` is wrong or member does not exist | Re-check the member UUID from Step 0 |
| Member can sign in but sees no data | `assembly_id` on `user_profiles` is wrong | `UPDATE user_profiles SET assembly_id = (SELECT id FROM assemblies WHERE assembly_code = 'GH-ASSAK') WHERE id = '<new-user-uuid>'` |
