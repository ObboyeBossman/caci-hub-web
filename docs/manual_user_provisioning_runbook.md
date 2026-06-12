# Manual user provisioning — SQL editor runbook
**Version:** 2.0.0  
**Scope:** CACI Hub · Supabase SQL Editor  
**Audience:** Admin / Database operator  
**Last updated:** 12 June 2026

---

## When to use this

Use this runbook when you need to provision an app login for a member
directly from the Supabase SQL editor — without going through the
`provision-user` Edge Function or the web app UI.

**Typical scenarios:**
- The admin module UI is not yet built or deployed.
- You are setting up the প্রথম/first admin account (chicken-and-egg — the admin needs a login before they can provision anyone else).
- You need to recover an account after a failed Edge Function provision.
- You are working in a local dev environment with no running frontend.

---

## Prerequisites

- Access to the Supabase dashboard → SQL Editor for your project.
- You need to know the assembly code (e.g. `GH-ASSAK`).
- For the **Auth-Only** script, the person must already have a **member record** in `public.members`. You will need their member `id` (UUID).

---

## 🔍 Pre-flight check (Run this first)

Before provisioning, check if the member record already exists and if they already have an active login:

```sql
-- Replace the email, phone or assembly code with the target member's details
SELECT
  id,
  first_name,
  last_name,
  email,
  primary_phone,
  auth_user_id
FROM public.members
WHERE (email = 'obboyebossman@gmail.com' OR primary_phone = '+233593529509')
  AND assembly_id = (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK');
```

**How to interpret the results:**
- **No row returned:** The member does not exist in the database yet. Use **Script A (Full Script)**.
- **Row returned, `auth_user_id` is NULL:** The member exists but has no login. Copy the `id` from the result and use **Script B (Auth-Only Script)**.
- **Row returned, `auth_user_id` is NOT NULL:** The member already has an account. Stop here. Do not provision again.

---

## 📜 Script A: Full Script (Member + Login)

Use this if the member **does not exist in the database at all**. This script creates the `auth.users` row, the `members` row, the `user_profiles` row, and links them all atomically.

> **Note:** This also covers the case where you want to provision the first admin (chicken-and-egg). Set `v_role` to `'admin'`.

**Instructions:**
1. Copy the script below.
2. Edit the `DECLARE` block at the top with the member's details.
3. Run in the Supabase SQL editor.

```sql
DO $$
DECLARE
  -- 1. Assembly and Role settings
  v_assembly_code TEXT            := 'GH-ASSAK';
  v_role          TEXT            := 'member'; -- 'admin' or 'member'

  -- 2. Member details (Replace these)
  v_first_name    TEXT            := 'Jane';
  v_last_name     TEXT            := 'Doe';
  v_full_name     TEXT            := 'Jane Doe';     -- for user_profiles
  v_gender        public.gender_type := 'female';
  v_phone         TEXT            := '233204000001'; -- NO '+' prefix
  v_email         TEXT            := 'jane.doe@example.com';

  -- 3. Security
  v_temp_password TEXT            := 'TemporaryPass123!';
  v_must_change   BOOLEAN         := true;

  -- Internal variables
  v_assembly_id   uuid;
  v_auth_id       uuid            := gen_random_uuid();
  v_member_id     uuid            := gen_random_uuid();
BEGIN

  -- Resolve assembly ID
  SELECT id INTO v_assembly_id
  FROM public.assemblies
  WHERE assembly_code = v_assembly_code;

  IF v_assembly_id IS NULL THEN
    RAISE EXCEPTION 'Assembly % not found', v_assembly_code;
  END IF;

  -- 1. Create auth user
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', v_auth_id, v_email,
    extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, 'authenticated', 'authenticated'
  );

  -- 2. Create auth identity (required for user to be visible in the Auth dashboard)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_auth_id, v_auth_id::text,
    format('{"sub":"%s","email":"%s","email_verified":false}', v_auth_id, v_email)::jsonb,
    'email', now(), now()
  );

  -- 3. Create member record
  INSERT INTO public.members (
    id, assembly_id, first_name, last_name,
    primary_phone, email, gender, membership_status,
    created_by, auth_user_id
  )
  VALUES (
    v_member_id, v_assembly_id, v_first_name, v_last_name,
    v_phone, v_email, v_gender, 'active',
    v_auth_id, v_auth_id
  );

  -- 4. Create user profile
  INSERT INTO public.user_profiles (
    id, assembly_id, role, full_name, is_active, must_change_password
  )
  VALUES (
    v_auth_id, v_assembly_id, v_role, v_full_name, true, v_must_change
  );

  RAISE NOTICE 'Provisioned: auth_id=% member_id=%', v_auth_id, v_member_id;
END $$;
```

> **Admin note:** If you set `v_role = 'admin'`, the user will have full admin access. The admin bypass in the RLS policies (`public.is_admin()`) means they do not need explicit permission keys in `role_permissions` — all communication, member, and content INSERT/UPDATE operations are permitted by default.

---

## 📜 Script B: Auth-Only Script (Login for Existing Member)

Use this if the member **already exists** in `public.members` but has no login (`auth_user_id IS NULL`). Copy the member's UUID from the pre-flight check result.

```sql
DO $$
DECLARE
  -- Replace with the existing member's UUID from the pre-flight check
  v_existing_member_id uuid := '<paste-member-uuid-here>';

  -- Account setup
  v_email         TEXT    := 'member@example.com';
  v_temp_password TEXT    := 'TemporaryPass123!';
  v_role          TEXT    := 'member'; -- 'admin' or 'member'
  v_full_name     TEXT    := 'Full Name Here';

  -- Internal variables
  v_assembly_id   uuid;
  v_auth_id       uuid := gen_random_uuid();
BEGIN

  -- Resolve assembly from the existing member
  SELECT assembly_id INTO v_assembly_id
  FROM public.members
  WHERE id = v_existing_member_id;

  IF v_assembly_id IS NULL THEN
    RAISE EXCEPTION 'Member % not found', v_existing_member_id;
  END IF;

  -- Check not already provisioned
  IF EXISTS (SELECT 1 FROM public.members WHERE id = v_existing_member_id AND auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Member % already has an auth account — aborting to prevent duplicate', v_existing_member_id;
  END IF;

  -- 1. Create auth user
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', v_auth_id, v_email,
    extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, 'authenticated', 'authenticated'
  );

  -- 2. Create auth identity
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_auth_id, v_auth_id::text,
    format('{"sub":"%s","email":"%s","email_verified":false}', v_auth_id, v_email)::jsonb,
    'email', now(), now()
  );

  -- 3. Create user profile
  INSERT INTO public.user_profiles (
    id, assembly_id, role, full_name, is_active, must_change_password
  )
  VALUES (
    v_auth_id, v_assembly_id, v_role, v_full_name, true, true
  );

  -- 4. Link auth_user_id on the member row
  UPDATE public.members
  SET auth_user_id = v_auth_id
  WHERE id = v_existing_member_id;

  RAISE NOTICE 'Provisioned login: auth_id=% → member_id=%', v_auth_id, v_existing_member_id;
END $$;
```

---

## 📜 Script C: Member Record Only (No Login)

Use this if you want to **add a new member to the database** but they do not need an app login yet (e.g., a visitor or new joiner whose account will be provisioned later via the UI or Script B).

```sql
DO $$
DECLARE
  -- Assembly
  v_assembly_code TEXT              := 'GH-ASSAK';

  -- Member details (Replace these)
  v_first_name    TEXT              := 'Kwame';
  v_last_name     TEXT              := 'Asante';
  v_gender        public.gender_type := 'male';
  v_phone         TEXT              := '233244000001'; -- NO '+' prefix
  v_email         TEXT              := 'kwame.asante@example.com';
  v_status        public.membership_status := 'active'; -- 'active', 'visitor', 'transferred', 'deceased'

  -- Internal
  v_assembly_id   uuid;
  v_member_id     uuid := gen_random_uuid();
BEGIN

  SELECT id INTO v_assembly_id
  FROM public.assemblies
  WHERE assembly_code = v_assembly_code;

  IF v_assembly_id IS NULL THEN
    RAISE EXCEPTION 'Assembly % not found', v_assembly_code;
  END IF;

  INSERT INTO public.members (
    id, assembly_id, first_name, last_name,
    primary_phone, email, gender, membership_status
  )
  VALUES (
    v_member_id, v_assembly_id, v_first_name, v_last_name,
    v_phone, v_email, v_gender, v_status
  );

  RAISE NOTICE 'Member created: id=%', v_member_id;
END $$;
```

> After running this script, you can later use **Script B** with the returned `member_id` to add a login for this member.

---

## ✅ Verification

Run this after Script A or B to confirm all records are linked correctly:

```sql
SELECT
  m.id              AS member_id,
  m.first_name || ' ' || m.last_name AS name,
  m.primary_phone,
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
WHERE m.email = 'member@example.com';  -- replace with the member's email
```

**Expected:**
| Column | Expected value |
|---|---|
| `auth_user_id` | Populated UUID, matches `profile_id` |
| `role` | `'admin'` or `'member'` |
| `is_active` | `true` |
| `auth_email` | Email used in the script |
| `email_confirmed_at` | Should be non-null (confirmed by the script) |

---

## ⏪ Rollback

If something went wrong, undo provisioning by replacing `<auth-user-uuid>` with the auth ID from the Verification query:

```sql
DO $$
DECLARE
  v_auth_id uuid := '<auth-user-uuid>';
BEGIN
  -- 1. Unlink from member
  UPDATE public.members SET auth_user_id = NULL WHERE auth_user_id = v_auth_id;

  -- 2. Delete auth identity
  DELETE FROM auth.identities WHERE user_id = v_auth_id;

  -- 3. Delete user profile
  DELETE FROM public.user_profiles WHERE id = v_auth_id;

  -- 4. Delete auth user
  DELETE FROM auth.users WHERE id = v_auth_id;

  RAISE NOTICE 'Rollback complete for auth_id=%', v_auth_id;
END $$;
```

> **Script C rollback** (member-record-only): Delete the member row directly using the `member_id` returned by RAISE NOTICE.
> ```sql
> DELETE FROM public.members WHERE id = '<member-uuid>';
> ```

---

## 🔐 RBAC & Permissions notes

### Admin users (`role = 'admin'`)
Admin users do **not** need rows in `role_permissions`. The database uses a helper function `public.is_admin()` which checks `user_profiles.role = 'admin'` and bypasses granular permission checks. This means admins can:
- Create / update campaigns, templates, announcements, and trigger rules
- Read all communication threads and messages
- Manage all member records

### Non-admin users (`role = 'member'`)
Members must be assigned an **assembly role** (via `user_profiles.assembly_role_id`) that has the required permission keys in `role_permissions`. The relevant communication permissions are:

| Permission key | Grants |
|---|---|
| `communications.broadcast.send` | Create campaigns |
| `communications.broadcast.schedule` | Schedule campaigns |
| `communications.direct.send` | Send direct messages |
| `communications.direct.send_pastoral` | Start pastoral/sensitive threads |
| `communications.direct.moderate` | Delete any thread message |
| `communications.audio.broadcast` | Upload audio broadcasts |
| `communications.announcements.manage` | Post and edit announcements |
| `communications.templates.manage` | Create and edit message templates |
| `communications.attachments.view_pastoral` | View pastoral attachment files |
| `communications.attachments.manage` | Delete any attachment |
| `communications.reports.view` | View delivery stats and reports |

To assign a role with these permissions:
```sql
-- Find the role ID you want to grant
SELECT id, name FROM public.assembly_roles WHERE assembly_id = '<your-assembly-id>';

-- Assign it to the user
UPDATE public.user_profiles
SET assembly_role_id = '<role-uuid>'
WHERE id = '<auth-user-uuid>';
```

---

## ✉️ Communicating Credentials

Once provisioning is confirmed, share the temporary password with the member. Recommended channels:

- **In person** — write on a card and hand it over.
- **WhatsApp** — send to the phone number on their member record.
- **Phone call** — read the password verbally.

**Do not store the temporary password anywhere.** If `must_change_password = true`, the UI will force the member to choose a new password on their first login.


