-- =============================================================================
-- CACI Hub — Unified Seed Script
-- Handles:
--   1. Trigger Management
--   2. Auth Users & Identities (with passwords and instances)
--   3. User Profiles
--   4. Member Records
--   5. Groups & Permissions
-- =============================================================================

-- SECTION 1: PREP
ALTER TABLE IF EXISTS public.members DISABLE TRIGGER trg_assign_membership_number;

-- SECTION 2: AUTH & IDENTITIES
DO $$
DECLARE
  v_instance_id uuid;
  v_password_hash text;
BEGIN
  -- Detect project instance ID
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

  v_password_hash := crypt('CACI@2026!', gen_salt('bf'));

  -- Seed auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous, deleted_at,
    phone, phone_confirmed_at,
    phone_change, phone_change_token,
    email_change_token_current, email_change_confirm_status,
    created_at, updated_at, last_sign_in_at
  )
  VALUES
    (
      v_instance_id,
      'deed0df7-d6de-404a-853d-0428c4196c9a',
      'authenticated', 'authenticated',
      NULL, v_password_hash, now(),
      '{"provider": "phone", "providers": ["phone"]}', '{}',
      false, false, false, NULL,
      '233593529509', now(),
      '', '', '', 0,
      '2026-04-27 06:36:38.143943+00', now(), now()
    ),
    (
      v_instance_id,
      '3a316d19-9416-43b3-a10b-2ec52522c7f1',
      'authenticated', 'authenticated',
      NULL, v_password_hash, now(),
      '{"provider": "phone", "providers": ["phone"]}', '{}',
      false, false, false, NULL,
      '233249439129', now(),
      '', '', '', 0,
      '2026-05-31 08:23:10.877888+00', now(), now()
    ),
    (
      v_instance_id,
      'fb71f8ba-67d0-4217-8c2e-cd4ae284ced5',
      'authenticated', 'authenticated',
      NULL, v_password_hash, now(),
      '{"provider": "phone", "providers": ["phone"]}', '{}',
      false, false, false, NULL,
      '233557887388', now(),
      '', '', '', 0,
      '2026-05-31 10:45:20.331767+00', now(), now()
    )
  ON CONFLICT (id) DO UPDATE SET
    instance_id           = v_instance_id,
    encrypted_password    = v_password_hash,
    phone_confirmed_at    = COALESCE(auth.users.phone_confirmed_at, now()),
    email_confirmed_at    = COALESCE(auth.users.email_confirmed_at, now()),
    aud                   = 'authenticated',
    role                  = 'authenticated',
    updated_at            = now();

  -- Seed auth.identities
  -- Delete first to ensure clean state and avoid constraint issues
  DELETE FROM auth.identities WHERE user_id IN (
    'deed0df7-d6de-404a-853d-0428c4196c9a',
    '3a316d19-9416-43b3-a10b-2ec52522c7f1',
    'fb71f8ba-67d0-4217-8c2e-cd4ae284ced5'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  SELECT
    id,
    id,
    format('{"sub":"%s","phone":"%s"}', id, phone)::jsonb,
    'phone',
    phone,
    now(), now(), now()
  FROM auth.users
  WHERE id IN (
    'deed0df7-d6de-404a-853d-0428c4196c9a',
    '3a316d19-9416-43b3-a10b-2ec52522c7f1',
    'fb71f8ba-67d0-4217-8c2e-cd4ae284ced5'
  );

END $$;

-- SECTION 3: public.user_profiles
INSERT INTO public.user_profiles (id, role, full_name, is_active, must_change_password, created_at, updated_at)
VALUES
  ('3a316d19-9416-43b3-a10b-2ec52522c7f1', 'admin',  'Stephen Ankomah', true, false, '2026-05-31 08:23:10.967+00', now()),
  ('deed0df7-d6de-404a-853d-0428c4196c9a', 'admin',  'Abraham Nhyiraba Obboye Bossman', true, false, '2026-05-25 05:03:26.787+00', now()),
  ('fb71f8ba-67d0-4217-8c2e-cd4ae284ced5', 'member', 'BENJAMIN MENSAH', true, false, '2026-05-31 10:45:20.387+00', now())
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, updated_at = now();

-- SECTION 4: public.members
INSERT INTO public.members (
  id, membership_number, title, full_name, date_of_birth, gender, marital_status,
  occupation, location, phone_number, whatsapp_number, membership_status, join_date,
  profile_photo_url, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  is_active, auth_user_id, created_at, updated_at
)
VALUES
  ('37e8593c-2e6a-4ce6-b029-6693f51bd281', 'CACI-00001', NULL, 'Abraham Nhyiraba Obboye Bossman', '2004-07-02', 'male', 'single', 'Student', 'Assakae', '233593529509', '233593529509', 'active', NULL, NULL, 'Isaac', '233593228102', 'Sibling', true, 'deed0df7-d6de-404a-853d-0428c4196c9a', '2026-05-26 20:59:58+00', now()),
  ('fdd9b955-fbbd-45fe-b61b-1249a3f6a321', 'CACI-00002', 'Rev.', 'Stephen Ankomah', NULL, 'male', 'married', 'Rev. Minister', NULL, '233249439129', NULL, 'active', '2026-05-27', NULL, NULL, '233543371849', NULL, true, '3a316d19-9416-43b3-a10b-2ec52522c7f1', '2026-05-27 21:51:01+00', now()),
  ('ea955165-1ac5-46a4-a137-905b31016cae', 'CACI-00054', NULL, 'BENJAMIN KWEKU MENSAH', '1994-05-18', 'male', 'married', 'PROJECT ADMINISTRATOR', 'PLY 48 ASSAKAE', '233557887388', '233557887388', 'active', '2005-09-29', NULL, '233243964292', '233547110763', 'parent', true, 'fb71f8ba-67d0-4217-8c2e-cd4ae284ced5', '2026-05-31 10:44:41+00', now())
ON CONFLICT (id) DO NOTHING;

-- SECTION 5: public.groups
INSERT INTO public.groups (id, name, is_active, created_at)
VALUES
  ('c71b3baf-f66a-44b5-8f74-2ee05058a977', 'Peace', true, now()),
  ('a5d7b605-da7e-47d7-93d5-286279d9b5ae', 'Pastor', true, now()),
  ('3c3dbe48-7248-4299-9791-b735ea8ae397', 'Love', true, now()),
  ('94e63394-88f2-4129-88c4-6697da7b935d', 'Hope', true, now()),
  ('c13dc1f1-215e-453e-9e61-e26727d2a35b', 'Youth', true, now())
ON CONFLICT (id) DO NOTHING;

-- SECTION 6: CLEANUP
ALTER TABLE public.members ENABLE TRIGGER trg_assign_membership_number;
UPDATE public.member_counter SET last_number = 75 WHERE id = 1;

-- SECTION 7: PERMISSIONS
INSERT INTO public.member_permissions (member_id, permission, granted_by)
SELECT m.id, sp.key, 'deed0df7-d6de-404a-853d-0428c4196c9a'
FROM public.members m
CROSS JOIN public.system_permissions sp
WHERE m.auth_user_id IN ('deed0df7-d6de-404a-853d-0428c4196c9a', '3a316d19-9416-43b3-a10b-2ec52522c7f1')
ON CONFLICT DO NOTHING;
