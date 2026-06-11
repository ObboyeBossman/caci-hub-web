-- =============================================================================
-- CACI Hub — Migration 20260427999999
-- Purpose:  Create the admin auth user so that FK constraints in the
--           following seed migration (20260428000001) are satisfied.
--           instance_id is required by GoTrue for the user to be visible
--           in the Supabase Auth dashboard.
-- =============================================================================

INSERT INTO auth.users (
  instance_id,
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- required by GoTrue
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  'obboyebossman@gmail.com',
  extensions.crypt('Boss1520..', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '233593529509',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  instance_id       = EXCLUDED.instance_id,
  phone             = EXCLUDED.phone,
  phone_confirmed_at = EXCLUDED.phone_confirmed_at,
  raw_app_meta_data  = EXCLUDED.raw_app_meta_data,
  aud               = EXCLUDED.aud,
  role              = EXCLUDED.role;

-- Auth identity — required for the user to be visible in the dashboard
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-deed0df7d6de',  -- stable UUID for idempotency
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  '{"sub":"deed0df7-d6de-404a-853d-0428c4196c9a","email":"obboyebossman@gmail.com","email_verified":false,"phone_verified":false}',
  'email',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;