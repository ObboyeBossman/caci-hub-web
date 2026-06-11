# Manual user provisioning — SQL editor runbook
**Version:** 1.1.0  
**Scope:** CACI Hub · Supabase SQL Editor  
**Audience:** Admin / Database operator  
**Last updated:** June 2026

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

Use this if the member **does not exist** yet. This script safely creates the `auth.users` row, the `members` row, the `user_profiles` row, and links them all atomically.

**Instructions:**
1. Copy the script below.
2. Edit the `DECLARE` block at the top with the member's details.
3. Run the script in the SQL editor.

```sql
DO $$
DECLARE
  -- 1. Assembly and Role settings
  v_assembly_code TEXT := 'GH-ASSAK';
  v_role          public.user_role := 'admin'; -- admin/pastor/secretary/volunteer/member

  -- 2. Member details (Replace these)
  v_first_name    TEXT := 'Abraham Obboye';
  v_last_name     TEXT := 'Bossman';
  v_full_name     TEXT := 'Abraham Obboye Bossman'; -- for user_profiles
  v_gender        public.gender_type := 'male';
  v_phone         TEXT := '233593529509'; -- NO '+' PREFIX
  v_email         TEXT := 'obboyebossman@gmail.com';
  
  -- 3. Security (Force change password on first login?)
  v_temp_password TEXT := 'TemporaryPass123!';
  v_must_change   BOOLEAN := true;

  -- Internal variables
  v_assembly_id   uuid;
  v_auth_id       uuid := gen_random_uuid();
  v_member_id     uuid := gen_random_uuid();
BEGIN

  -- Resolve assembly ID
  SELECT id INTO v_assembly_id FROM public.assemblies WHERE assembly_code = v_assembly_code;
  IF v_assembly_id IS NULL THEN
    RAISE EXCEPTION 'Assembly % not found', v_assembly_code;
  END IF;

  -- 1. Create auth user
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  )
  VALUES (
    v_auth_id, v_email, extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
    false, 'authenticated'
  );

  -- 2. Create member record
  INSERT INTO public.members (
    id, assembly_id, membership_number, first_name, last_name,
    primary_phone, email, gender, membership_status, created_by, auth_user_id
  )
  VALUES (
    v_member_id, v_assembly_id, NULL, v_first_name, v_last_name,
    v_phone, v_email, v_gender, 'active', v_auth_id, v_auth_id
  );

  -- 3. Create user profile
  INSERT INTO public.user_profiles (
    id, assembly_id, system_role, full_name, is_active, must_change_password
  )
  VALUES (
    v_auth_id, v_assembly_id, v_role, v_full_name, true, v_must_change
  );

END $$;
```

---

## 📜 Script B: Auth-Only Script (Login Only)

Use this if the member **already exists** but has no login account (Step 0 returned a row with a NULL `auth_user_id`).

**Instructions:**
1. Copy the script below.
2. Edit the `DECLARE` block with the member's existing UUID and target email/password.
3. Run the script in the SQL editor.

```sql
DO $$
DECLARE
  -- Replace this with the existing member's UUID from Step 0
  v_existing_member_id uuid := '<paste-uuid-here>'; 

  -- Account setup
  v_email         TEXT := 'member@example.com';
  v_temp_password TEXT := 'TemporaryPass123!';
  v_role          public.user_role := 'member';
  v_full_name     TEXT := 'Full Name Here';       -- for user_profiles

  -- Internal variables
  v_assembly_id   uuid;
  v_auth_id       uuid := gen_random_uuid();
BEGIN

  -- Resolve assembly from the existing member
  SELECT assembly_id INTO v_assembly_id FROM public.members WHERE id = v_existing_member_id;
  IF v_assembly_id IS NULL THEN
    RAISE EXCEPTION 'Member % not found', v_existing_member_id;
  END IF;

  -- 1. Create auth user
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  )
  VALUES (
    v_auth_id, v_email, extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
    false, 'authenticated'
  );

  -- 2. Create user profile
  INSERT INTO public.user_profiles (
    id, assembly_id, system_role, full_name, is_active, must_change_password
  )
  VALUES (
    v_auth_id, v_assembly_id, v_role, v_full_name, true, true
  );

  -- 3. Link auth_user_id on the existing member row
  UPDATE public.members
  SET auth_user_id = v_auth_id
  WHERE id = v_existing_member_id;

END $$;
```

---

## ✅ Verification

Run this query after executing either script to ensure all three table records were linked properly:

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
WHERE m.email = 'obboyebossman@gmail.com';  -- replace with member's email
```

**Expected results:**
- `member_id` is populated
- `auth_user_id` matches `profile_id`
- `role` matches the assigned role
- `is_active` is `true`
- `auth_email` matches the email used in the script

---

## ⏪ Rollback

If something went wrong, you can safely undo the provisioning. 
Replace `<auth-user-uuid>` with the `auth_user_id` outputted from the Verification query above.

```sql
DO $$
DECLARE
  v_auth_id uuid := '<auth-user-uuid>';
BEGIN
  -- 1. Unlink from member
  UPDATE public.members SET auth_user_id = NULL WHERE auth_user_id = v_auth_id;
  
  -- 2. Delete user profile
  DELETE FROM public.user_profiles WHERE id = v_auth_id;
  
  -- 3. Delete auth user
  DELETE FROM auth.users WHERE id = v_auth_id;
END $$;
```

---

## ✉️ Communicating Credentials

Once provisioning is confirmed, share the login credentials with the member. The recommended channels for a church context:

- In person — write the temporary password on a card.
- WhatsApp — send directly to the member's phone number on their record.
- Phone call — read the password to the member.

**Do not store the temporary password anywhere** — it is a one-time bootstrap credential. If `must_change_password` is set to `true`, the UI will force them to choose a new password on their first login.
