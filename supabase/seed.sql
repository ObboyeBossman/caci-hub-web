-- =============================================================
-- CACI Hub — seed.sql
-- Run ONCE after all migrations are applied.
-- ON CONFLICT guards make it safe to re-run without duplicating.
--
-- DEV TEARDOWN (run manually when you need a clean slate):
--   DELETE FROM public.member_audit_log;
--   DELETE FROM public.members;
--   DELETE FROM public.user_profiles;
--   DELETE FROM public.assemblies;
--   Then delete the Auth user manually:
--   Dashboard → Authentication → Users → Delete
-- =============================================================


-- -------------------------------------------------------------
-- 1. Assembly
-- -------------------------------------------------------------
INSERT INTO public.assemblies (
  name,
  assembly_code,
  address,
  digital_address
)
VALUES (
  'Christ Apostolic Church International — Assakae',
  'GH-ASSAK',
  'Assakae, Takoradi, Western Region, Ghana',
  NULL
)
ON CONFLICT (assembly_code) DO NOTHING;


-- -------------------------------------------------------------
-- 2. Admin member record (admin must be a member first)
-- -------------------------------------------------------------
INSERT INTO public.members (
  id,
  assembly_id,
  membership_number,
  first_name,
  last_name,
  phone_number,
  email,
  gender,
  membership_status,
  created_by
)
VALUES (
  '8cf54258-0050-423d-b9a3-7f344ead04df',
  (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'),
  'CACI-GH-ASSAK-00001',
  'Abraham',
  'Bossman',
  '+233593529509',
  'obboyebossman@gmail.com',
  'male',
  'active',
  'deed0df7-d6de-404a-853d-0428c4196c9a'
)
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------
-- 2b. Additional sample members
-- -------------------------------------------------------------
INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email)
VALUES
  ('c0000000-0000-0000-0000-000000000001', (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'), 'CACI-GH-ASSAK-00002', 'Kwame', 'Mensah', 'male', 'active', 'deed0df7-d6de-404a-853d-0428c4196c9a', 'kwame@example.com'),
  ('c0000000-0000-0000-0000-000000000002', (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'), 'CACI-GH-ASSAK-00003', 'Abena', 'Osei', 'female', 'active', 'deed0df7-d6de-404a-853d-0428c4196c9a', 'abena@example.com'),
  ('c0000000-0000-0000-0000-000000000003', (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'), 'CACI-GH-ASSAK-00004', 'Kojo', 'Ansah', 'male', 'active', 'deed0df7-d6de-404a-853d-0428c4196c9a', 'kojo@example.com'),
  ('c0000000-0000-0000-0000-000000000004', (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'), 'CACI-GH-ASSAK-00005', 'Akua', 'Danso', 'female', 'active', 'deed0df7-d6de-404a-853d-0428c4196c9a', 'akua@example.com'),
  ('c0000000-0000-0000-0000-000000000005', (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'), 'CACI-GH-ASSAK-00006', 'Yaw', 'Boakye', 'male', 'visitor', 'deed0df7-d6de-404a-853d-0428c4196c9a', 'yaw@example.com')
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------
-- 3. Admin user_profiles row
-- -------------------------------------------------------------
INSERT INTO public.user_profiles (
  id,
  assembly_id,
  role,
  full_name,
  is_active
)
VALUES (
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  (SELECT id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK'),
  'admin',
  'Abraham Nhyiraba Obboye Bossman',
  true
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- Verify with these three queries after running:
--
-- SELECT name, assembly_code, address FROM public.assemblies;
-- SELECT first_name, last_name, membership_number FROM public.members;
-- SELECT full_name, role FROM public.user_profiles;
-- =============================================================