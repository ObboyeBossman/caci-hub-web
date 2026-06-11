-- =============================================================================
-- CACI Hub — Migration 20260428000001
-- Purpose:  Data seed for the Admin user.
--           Ensures the Admin assembly, member record, and user profile
--           exist in the database.
--
--           This is implemented as a migration to ensure it is applied to the
--           remote database where the standard `seed.sql` might not have
--           been run.
--
-- Author:   Abraham N. O. Bossman
-- Day:      28 (Data Seed)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Assembly — UUID is pinned so sessionStorage survives db reset cycles
-- -----------------------------------------------------------------------------
INSERT INTO public.assemblies (
  id,
  name,
  assembly_code,
  address,
  digital_address
)
VALUES (
  '4833e9ed-0ff9-4b25-96a9-0d8528a2356f',
  'Assakae Central Assembly',
  'GH-ASSAK',
  'Assakae, Takoradi, Western Region, Ghana',
  NULL
)
ON CONFLICT (assembly_code) DO UPDATE
  SET id = '4833e9ed-0ff9-4b25-96a9-0d8528a2356f';


-- -----------------------------------------------------------------------------
-- 2. Admin member record
-- -----------------------------------------------------------------------------
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
  '4833e9ed-0ff9-4b25-96a9-0d8528a2356f',
  'CACI-GH-ASSAK-00001',
  'Abraham Obboye',
  'Bossman',
  '+233593529509',
  'obboyebossman@gmail.com',
  'male',
  'active',
  NULL
)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. Admin user_profiles row
-- -----------------------------------------------------------------------------
INSERT INTO public.user_profiles (
  id,
  assembly_id,
  role,
  full_name,
  is_active
)
VALUES (
  'deed0df7-d6de-404a-853d-0428c4196c9a',
  '4833e9ed-0ff9-4b25-96a9-0d8528a2356f',
  'admin',
  'Abraham Obboye Bossman',
  true
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- END OF MIGRATION 20260428000001
-- =============================================================================
