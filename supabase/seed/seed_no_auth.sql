-- =============================================================================
-- CACI Hub — Seed Script (NO AUTH) — FINAL
-- Seeds all public schema data. Auth users handled by seed-auth Edge Function.
--
-- Run AFTER all 4 migrations in order:
--   1. 20260709000000_caci_v1.sql
--   2. 20260710000000_add_system_permissions.sql
--   3. 20260710010000_remove_notifications_read.sql
--   4. 20260711000000_add_member_role.sql
--
-- Safe to re-run — everything is idempotent.
-- =============================================================================

BEGIN;

-- ── Disable membership number trigger so we control the numbers ourselves ─────
ALTER TABLE public.members DISABLE TRIGGER trg_assign_membership_number;


-- ── Members ───────────────────────────────────────────────────────────────────
-- auth_user_id is NULL here. Edge Function patches it after creating auth users.

INSERT INTO public.members (
  id,
  membership_number,
  title,
  full_name,
  date_of_birth,
  gender,
  marital_status,
  occupation,
  location,
  phone_number,
  whatsapp_number,
  membership_status,
  join_date,
  profile_photo_url,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  is_active,
  auth_user_id,
  created_at,
  updated_at
)
VALUES
  (
    '37e8593c-2e6a-4ce6-b029-6693f51bd281',
    'CACI-00001', NULL,
    'Abraham Nhyiraba Obboye Bossman',
    '2004-07-02', 'male', 'single', 'Student', 'Assakae',
    '+233593529509', '+233593529509',
    'active', NULL, NULL,
    'Isaac', '+233593228102', 'Sibling',
    true, NULL,
    '2026-05-26 20:59:58+00', now()
  ),
  (
    'fdd9b955-fbbd-45fe-b61b-1249a3f6a321',
    'CACI-00002', 'Rev.',
    'Stephen Ankomah',
    NULL, 'male', 'married', 'Rev. Minister', NULL,
    '+233249439129', NULL,
    'active', '2026-05-27', NULL,
    NULL, '+233543371849', NULL,
    true, NULL,
    '2026-05-27 21:51:01+00', now()
  ),
  (
    'ea955165-1ac5-46a4-a137-905b31016cae',
    'CACI-00054', NULL,
    'BENJAMIN KWEKU MENSAH',
    '1994-05-18', 'male', 'married', 'PROJECT ADMINISTRATOR', 'PLY 48 ASSAKAE',
    '+233557887388', '+233557887388',
    'active', '2005-09-29', NULL,
    '+233243964292', '+233547110763', 'parent',
    true, NULL,
    '2026-05-31 10:44:41+00', now()
  )
ON CONFLICT (id) DO NOTHING;


-- ── Groups ────────────────────────────────────────────────────────────────────

INSERT INTO public.groups (id, name, is_active, created_at)
VALUES
  ('c71b3baf-f66a-44b5-8f74-2ee05058a977', 'Peace',  true, now()),
  ('a5d7b605-da7e-47d7-93d5-286279d9b5ae', 'Pastor', true, now()),
  ('3c3dbe48-7248-4299-9791-b735ea8ae397', 'Love',   true, now()),
  ('94e63394-88f2-4129-88c4-6697da7b935d', 'Hope',   true, now()),
  ('c13dc1f1-215e-453e-9e61-e26727d2a35b', 'Youth',  true, now())
ON CONFLICT (id) DO NOTHING;


-- ── Re-enable trigger ─────────────────────────────────────────────────────────
ALTER TABLE public.members ENABLE TRIGGER trg_assign_membership_number;


-- ── Membership counter ────────────────────────────────────────────────────────
-- Only advances the counter if it hasn't been moved past 75 already.
-- This makes the script safe to re-run even after real members have been added.
UPDATE public.member_counter
SET    last_number = 75
WHERE  id          = 1
AND    last_number < 75;


COMMIT;
