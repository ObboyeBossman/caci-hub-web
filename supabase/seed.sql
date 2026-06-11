-- =============================================================
-- CACI Hub — seed.sql
-- Run automatically after migrations by `supabase db reset`.
-- Migration 20260428000001 already seeds the assembly, member,
-- and user_profile rows. This file only adds what the migration
-- cannot: the auth.users row and the auth_user_id link.
-- Last updated: 2026-06-11
-- =============================================================

DO $$
DECLARE
  v_auth_id   uuid := 'deed0df7-d6de-404a-853d-0428c4196c9a';
  v_member_id uuid := '8cf54258-0050-423d-b9a3-7f344ead04df';
  v_email     TEXT := 'obboyebossman@gmail.com';
BEGIN

  -- ── 0. Base Instance (Required after DB Reset truncates this) ───────────────
  INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '',
    now(),
    now()
  ) ON CONFLICT DO NOTHING;

  -- ── 0a. Auth user (must exist before user_profiles FK) ─────────────────────
  -- Uses DO UPDATE to ensure instance_id/aud are always correct even when
  -- migration 20260427999999 already inserted the row.
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    phone, phone_confirmed_at,
    confirmation_token, recovery_token, 
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    v_email,
    extensions.crypt('Boss1520..', extensions.gen_salt('bf')),
    now(), now(), now(),
    '233593529509', now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (id) DO UPDATE SET
    instance_id        = EXCLUDED.instance_id,
    encrypted_password = EXCLUDED.encrypted_password,
    phone              = EXCLUDED.phone,
    phone_confirmed_at = EXCLUDED.phone_confirmed_at,
    confirmation_token = EXCLUDED.confirmation_token,
    recovery_token     = EXCLUDED.recovery_token,
    email_change_token_new = EXCLUDED.email_change_token_new,
    email_change       = EXCLUDED.email_change,
    raw_app_meta_data  = EXCLUDED.raw_app_meta_data,
    aud                = EXCLUDED.aud,
    role               = EXCLUDED.role;

  -- ── 0b. Auth identity (Required for user to appear in the dashboard) ───────
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-deed0df7d6de',   -- stable UUID for idempotency
    v_auth_id,
    v_auth_id::text,
    format('{"sub":"%s","email":"%s","email_verified":false,"phone_verified":false}', v_auth_id, v_email)::jsonb,
    'email',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 1. Link auth_user_id on the admin member row ──────────────────────────
  -- Migration 20260428000001 created the member row with created_by = NULL.
  -- Now that the auth user exists, we can backfill auth_user_id.
  UPDATE public.members
  SET auth_user_id = v_auth_id
  WHERE id = v_member_id
    AND auth_user_id IS NULL;

  -- ── 2. Sample members (additional dev data not in any migration) ──────────
  INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email)
  SELECT
    m.id, a.id, m.membership_number, m.first_name, m.last_name, m.gender::public.gender_type, m.membership_status::public.membership_status, v_auth_id, m.email
  FROM (VALUES
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'CACI-GH-ASSAK-00002', 'Kwame',  'Mensah',  'male',   'active',  'kwame@example.com'),
    ('c0000000-0000-0000-0000-000000000002'::uuid, 'CACI-GH-ASSAK-00003', 'Abena',  'Osei',    'female', 'active',  'abena@example.com'),
    ('c0000000-0000-0000-0000-000000000003'::uuid, 'CACI-GH-ASSAK-00004', 'Kojo',   'Ansah',   'male',   'active',  'kojo@example.com'),
    ('c0000000-0000-0000-0000-000000000004'::uuid, 'CACI-GH-ASSAK-00005', 'Akua',   'Danso',   'female', 'active',  'akua@example.com'),
    ('c0000000-0000-0000-0000-000000000005'::uuid, 'CACI-GH-ASSAK-00006', 'Yaw',    'Boakye',  'male',   'visitor', 'yaw@example.com')
  ) AS m(id, membership_number, first_name, last_name, gender, membership_status, email)
  CROSS JOIN public.assemblies a
  WHERE a.assembly_code = 'GH-ASSAK'
  ON CONFLICT (id) DO NOTHING;

END $$;

-- =============================================================
-- Verify after seeding:
--
-- SELECT id, email, email_confirmed_at FROM auth.users
--   WHERE id = 'deed0df7-d6de-404a-853d-0428c4196c9a';
-- SELECT first_name, last_name, membership_number, primary_phone, auth_user_id
--   FROM public.members ORDER BY membership_number;
-- SELECT full_name, role, is_active FROM public.user_profiles;
-- =============================================================