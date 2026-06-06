-- 0. Create admin auth user (required for FK)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
VALUES (
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  'obboyebossman@gmail.com',
  extensions.crypt('Welcome2026', extensions.gen_salt('bf')),
  now(),
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;