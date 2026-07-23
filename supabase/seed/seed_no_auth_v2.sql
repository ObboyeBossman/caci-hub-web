-- =============================================================================
-- CACI Hub — Seed Script (NO AUTH) — v2
-- Seeds all public schema data for the new single-assembly schema.
-- Auth users are handled separately by the seed-auth Edge Function.
--
-- Run AFTER all migrations in order:
--   1. 20260709000000_caci_v1.sql
--   2. 20260710000000_add_system_permissions.sql
--   3. 20260710010000_remove_notifications_read.sql
--   4. 20260711000000_add_member_role.sql
--   5. 20260712000000_fix_rls_policies.sql
--
-- Data source: prod_backup_20260709_165638.sql (75 members, Assakae Central)
-- Phone numbers:  normalised to E.164 (+233...) where resolvable.
-- Membership numbers: re-keyed from CACI-GH-ASSAK-NNNNN → CACI-NNNNN.
-- UUIDs: preserved from prod — same IDs, new schema.
--
-- Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
--
-- DATA NOTES:
--   8 members with no resolvable phone (kept as NULL — collect in person):
--     CACI-00015 Grace Ackon
--     CACI-00018 Juliana Obboye
--     CACI-00046 Hannah Peasah
--     CACI-00049 Cecilia Akon
--     CACI-00057 Grace Gaabin
--     CACI-00058 Philomina Arthur (non-E.164 ambiguous number — nulled to avoid index violation)
--     CACI-00062 Rose Gyamfi (phone was cross-contaminated from Comfort Aduamah's emergency contact — nulled)
--     CACI-00071 Gifty Anokye (original '+2332424759670' had extra trailing digit — corrected to '+233242475967')
--   1 gender mismatch fixed:
--     CACI-00067 Rebecca Cobbinah was 'male' in prod → corrected to 'female'
--
-- CONFLICTS RESOLVED (v2 → v2.1):
--   1. FATAL:   CACI-00051 and CACI-00062 shared phone_number '+233248381187'.
--              idx_members_phone_number (partial unique) would reject the 2nd insert.
--              Root cause: Rose Gyamfi's phone was Comfort Aduamah's emergency contact
--              number erroneously copied. Rose Gyamfi's phone_number set to NULL.
--   2. INDEX:   CACI-00058 phone '5939531533' is not E.164 — partial unique index
--              on phone_number still applies to non-null values. Nulled.
--   3. DATA:    CACI-00071 '+2332424759670' had an extra trailing '0' (13 digits
--              after country code). Corrected to '+233242475967'.
--   4. IDEMPOTENCY: groups ON CONFLICT changed from (id) to DO NOTHING so that
--              both the id PK and the name UNIQUE constraint are handled on re-runs
--              (guards against prior seeds with different UUIDs for same names).
-- =============================================================================

BEGIN;

-- ── Disable membership number trigger so we control the numbers ourselves ─────
ALTER TABLE public.members DISABLE TRIGGER trg_assign_membership_number;


-- ── Members (75) ──────────────────────────────────────────────────────────────
-- auth_user_id is NULL for all rows here.
-- The seed-auth Edge Function patches it for the 3 users who can log in.

INSERT INTO public.members (
  id, membership_number, title, full_name, date_of_birth,
  gender, marital_status, occupation, location,
  phone_number, whatsapp_number, membership_status, join_date,
  profile_photo_url,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  is_active, auth_user_id, created_at
)
VALUES
  -- CACI-00001: Abraham Nhyiraba Obboye Bossman
  ('37e8593c-2e6a-4ce6-b029-6693f51bd281', 'CACI-00001', NULL, 'Abraham Nhyiraba Obboye Bossman',
   '2004-07-02',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae',
   '+233593529509', '+233593529509', 'active', NULL,
   NULL,
   'Isaac', '+233593228102', 'Sibling',
   true, NULL, '2026-05-26 20:59:58.460092+00'),

  -- CACI-00002: Stephen Ankomah
  ('fdd9b955-fbbd-45fe-b61b-1249a3f6a321', 'CACI-00002', 'Rev.', 'Stephen Ankomah',
   NULL,
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'Rev. Minister', NULL,
   '+233249439129', NULL, 'active', '2026-05-27',
   NULL,
   NULL, '+233543371849', NULL,
   true, NULL, '2026-05-27 21:51:01.626838+00'),

  -- CACI-00003: Ama Queen
  ('b668ef4c-b006-4268-a13a-4627e6d4cd04', 'CACI-00003', NULL, 'Ama Queen',
   '1981-11-14',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Catering', NULL,
   '+233557813105', '+233557813105', 'active', '2025-05-01',
   NULL,
   'Samuel Amoah', '+233595762184', 'friend',
   true, NULL, '2026-05-28 04:02:42.476621+00'),

  -- CACI-00004: Esther Eshun
  ('d0b63874-2850-479a-8f6e-e6fb486b5a79', 'CACI-00004', NULL, 'Esther Eshun',
   NULL,
   'female'::public.gender_type, NULL::public.marital_status_type,
   NULL, 'Assakae',
   '+23327465506', '+23327465506', 'active', NULL,
   NULL,
   NULL, '+233559911376', NULL,
   true, NULL, '2026-05-28 04:10:33.243205+00'),

  -- CACI-00005: Moses Adu Appiah
  ('2d7ef5df-60cb-4010-b3b3-f52713f229b4', 'CACI-00005', NULL, 'Moses Adu Appiah',
   '2006-06-08',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae',
   '+233555056540', '+233572201033', 'active', NULL,
   NULL,
   'Benjamin Appiah', '+233544858920', 'parent',
   true, NULL, '2026-05-28 04:16:30.557032+00'),

  -- CACI-00006: Esther Eshun
  ('b19a32a9-8216-463e-a0dc-1765a17bfe08', 'CACI-00006', NULL, 'Esther Eshun',
   '1999-01-21',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Teacher', 'Assakae',
   '+233247614162', '+233247614162', 'active', NULL,
   NULL,
   NULL, '+233591565145', 'other',
   true, NULL, '2026-05-28 04:21:09.52808+00'),

  -- CACI-00007: Moses Adu Diidonoba
  ('dea2616d-5bd5-4895-8ebd-59911402e5ff', 'CACI-00007', NULL, 'Moses Adu Diidonoba',
   '2012-02-23',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae',
   '+233538099870', NULL, 'active', NULL,
   NULL,
   NULL, '+233242308121', 'parent',
   true, NULL, '2026-05-28 04:26:44.651375+00'),

  -- CACI-00008: Lucus Kweku Eshun
  ('c9175d10-338e-48d0-8224-262e0367f541', 'CACI-00008', NULL, 'Lucus Kweku Eshun',
   '2000-12-27',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Assakae',
   '+233257595511', NULL, 'active', NULL,
   NULL,
   'Theophilus Ansah', '+233559911376', NULL,
   true, NULL, '2026-05-28 04:33:19.435565+00'),

  -- CACI-00009: Mary Arthur
  ('f18d0e9f-e42b-400d-8fa5-76e88499d363', 'CACI-00009', NULL, 'Mary Arthur',
   '1995-12-11',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trading', 'Assakae',
   '+233538148013', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 04:43:30.617021+00'),

  -- CACI-00010: Bernard Aboagye
  ('b6cf2c5d-3985-4b4c-89e4-527bad8cc12c', 'CACI-00010', NULL, 'Bernard Aboagye',
   '1993-12-16',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Mason', 'Adientem - Dr. Tawiah Hospital',
   '+233248153589', '+233509016414', 'active', NULL,
   NULL,
   'Cecilia', '+233538249108', 'other',
   true, NULL, '2026-05-28 11:40:46.817451+00'),

  -- CACI-00011: Kezia Abena Mensah
  ('23cd89ae-f65a-4f27-8c4c-16a61d1e356f', 'CACI-00011', NULL, 'Kezia Abena Mensah',
   '2011-05-10',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Race Course, Western Region',
   '+233541615395', '+233541615395', 'active', NULL,
   NULL,
   'Mensah Emmanuel', '+233248964292', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00012: Perpetual Abena Mensah
  ('7863242f-2c01-4078-8b2e-765fea6de16f', 'CACI-00012', NULL, 'Perpetual Abena Mensah',
   '2000-05-23',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Western Region',
   '+233241095712', '+233241095712', 'active', NULL,
   NULL,
   'Mensah Emmanuel', '+233243964292', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00013: Agnes Koomson
  ('10881204-724e-4185-8db8-6a5fb55389fe', 'CACI-00013', NULL, 'Agnes Koomson',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Adientem, Western Region',
   '+233271128162', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00014: Mary Yalley
  ('80fabf04-e048-4d84-87b5-76f96b73f1ba', 'CACI-00014', NULL, 'Mary Yalley',
   '1983-07-01',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Assakae',
   '+233256510605', NULL, 'active', NULL,
   NULL,
   NULL, '+233256510605', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00015: Grace Ackon
  ('3389287d-0e31-43df-be64-532df09a843e', 'CACI-00015', NULL, 'Grace Ackon',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   NULL, 'Assakae',
   NULL, NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-29 04:36:02.943987+00'),

  -- CACI-00016: Mavis Ahvrimah
  ('70551419-17af-4ec1-adfc-ce16081ef323', 'CACI-00016', NULL, 'Mavis Ahvrimah',
   '2003-05-03',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Decorator', 'Assakae, Western Region',
   '+233257691842', '+233257691842', 'active', NULL,
   NULL,
   'Solomon Affedzie', '+233547228999', NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00017: Hannah Kwofie
  ('89c4aebc-071a-4449-b290-10ce4bef77f0', 'CACI-00017', NULL, 'Hannah Kwofie',
   '2002-05-28',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233532340210', '+233581412140', 'active', NULL,
   NULL,
   'Dorcas Ackon', '+233532977095', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00018: Juliana Obboye
  ('0cda0506-781e-4e77-8ae0-44fec5b02319', 'CACI-00018', NULL, 'Juliana Obboye',
   NULL,
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Farming', 'Western Region',
   NULL, NULL, 'active', NULL,
   NULL,
   'Christina Bossman', '+233242833301', 'Other',
   true, NULL, '2026-05-29 04:36:02.943987+00'),

  -- CACI-00019: Jacobel Glory Sarpong
  ('d05afe40-99b8-4fc4-bdce-e3c604761bd8', 'CACI-00019', NULL, 'Jacobel Glory Sarpong',
   '2015-12-22',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233245107127', NULL, 'active', NULL,
   NULL,
   'Ruby Asante', '+233245107127', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00020: Sarah Acheampong
  ('3d992d4f-74ab-4dde-bc8f-b111b817e3cf', 'CACI-00020', NULL, 'Sarah Acheampong',
   '2002-09-29',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Seamstress', 'Assakae Market, Western Region',
   '+233557710069', '+233557710069', 'active', NULL,
   NULL,
   'Thomas', '+233245324491', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00021: Samuel Amoah
  ('13202969-fae4-4570-8e52-a459b9d72c50', 'CACI-00021', NULL, 'Samuel Amoah',
   '1999-12-26',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233595762184', '+233595762184', 'active', NULL,
   NULL,
   'Mercy Quayson', '+233591796347', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00022: Monica Tieyir
  ('4839d65f-5747-47ca-acd3-020d01956db6', 'CACI-00022', NULL, 'Monica Tieyir',
   '1983-09-22',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233592396206', '+233592396206', 'active', NULL,
   NULL,
   'Monica', '+233592396206', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00023: Abigail Diibonoba
  ('3ff54a47-d53d-4047-9412-6b9bf279bcf4', 'CACI-00023', NULL, 'Abigail Diibonoba',
   '2010-02-24',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233206119857', '+233206119857', 'active', NULL,
   NULL,
   'Josephine Eshun', '+233242308121', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00024: Linda Olivia Arthur
  ('fcc44c6a-2cd5-48a4-97e4-745df7454e12', 'CACI-00024', NULL, 'Linda Olivia Arthur',
   '1997-05-18',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Egyam, Western Region',
   '+233559984390', '+233559984390', 'active', NULL,
   NULL,
   'Mrs. Rita Amoah', '+233241158517', 'sibling',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00025: John Bekoe
  ('3973d7af-ed06-4715-9bd5-dbe64619eaf8', 'CACI-00025', NULL, 'John Bekoe',
   '2000-07-10',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Unemployed', 'Assakae, Western Region',
   '+233595754730', '+233595754730', 'active', '2019-09-01',
   NULL,
   'Elizabeth Bekoe', '+233596450632', 'sibling',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00026: Richmond Van Quayson
  ('17eb7287-012a-4dad-ba85-0daf1d11439b', 'CACI-00026', NULL, 'Richmond Van Quayson',
   '2006-03-29',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233509021595', '+233509021595', 'active', '2022-12-01',
   NULL,
   'Victoria Collins', '+233242799028', 'sibling',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00027: Godina Adjei
  ('8814952b-8de9-4e72-a0ed-e8a08f439301', 'CACI-00027', NULL, 'Godina Adjei',
   '2009-01-15',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233208537407', NULL, 'active', NULL,
   NULL,
   'Frimpong Adjei', '+233241772780', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00028: Benedicta Ocran
  ('e5615449-428f-44e1-b438-cf5169a77307', 'CACI-00028', NULL, 'Benedicta Ocran',
   '1987-10-28',
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233240629944', '+233240629944', 'active', NULL,
   NULL,
   'Benedicta', '+233240629944', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00029: Beatrice Bentil
  ('d9984f79-17a3-45bc-bce4-ed6e70c6fa1b', 'CACI-00029', NULL, 'Beatrice Bentil',
   '1972-04-02',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233544484102', '+233544484102', 'active', NULL,
   NULL,
   'Beatrice', '+233544484102', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00030: Dorothy Oduro
  ('85819f14-e476-4946-933c-8631b61a1496', 'CACI-00030', NULL, 'Dorothy Oduro',
   '1978-07-18',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233543045704', '+233543045704', 'active', NULL,
   NULL,
   'Dorothy', '+233543045704', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00031: Dorcas Ackon
  ('fc25611d-d9ca-4d5f-8304-b3dbacf09861', 'CACI-00031', NULL, 'Dorcas Ackon',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233532770095', NULL, 'active', NULL,
   NULL,
   'Hannah Kuofie', '+233532340210', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00032: Juliana Quarshie
  ('003387e8-413e-4b5a-80d1-17e507835d00', 'CACI-00032', NULL, 'Juliana Quarshie',
   NULL,
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233547599012', NULL, 'active', NULL,
   NULL,
   'Joseph Asmah', '+233500636498', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00033: Florence Asafua
  ('e6c5c1cd-7307-4dc4-abb0-c465dfc4a924', 'CACI-00033', NULL, 'Florence Asafua',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae, Western Region',
   '+233503818858', '+233503818858', 'active', NULL,
   NULL,
   'John Quagson', '+233256407202', 'spouse',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00034: Princess Adobah
  ('89a38cb4-4d29-401e-bbb1-8bc33cea0106', 'CACI-00034', NULL, 'Princess Adobah',
   '1997-09-05',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Assakae, Western Region',
   '+233506805767', '+233506805767', 'active', NULL,
   NULL,
   NULL, '+233553083692', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00035: Grace Sanie
  ('c5499049-243e-4557-99d4-315f8fdcd711', 'CACI-00035', NULL, 'Grace Sanie',
   '1984-04-05',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   NULL, 'Takoradi, Western Region',
   '+233593021089', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00036: Peter Nkrumah Asamoah
  ('14b12bcb-ee9a-458c-bd0a-61aacaf205a2', 'CACI-00036', NULL, 'Peter Nkrumah Asamoah',
   '1994-02-12',
   'male'::public.gender_type, NULL::public.marital_status_type,
   'Aboboyaa', 'Takoradi, Western Region',
   '+233551350889', '+233551350889', 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00037: Francis Arthur Bordoh
  ('7e74db1f-f773-4291-a55b-e6b623c989c5', 'CACI-00037', NULL, 'Francis Arthur Bordoh',
   '1975-08-14',
   'male'::public.gender_type, NULL::public.marital_status_type,
   'Mechanic', 'Takoradi, Western Region',
   '+233553699281', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00038: Agness Arthur
  ('d3f54d6b-4df9-4fca-b1de-a3b6bccedcbc', 'CACI-00038', NULL, 'Agness Arthur',
   NULL,
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Trader', 'Takoradi, Western Region',
   '+233244905497', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00039: Francis Okyere
  ('33f464e5-f0d6-4390-b47e-8aaf8e5f5c0f', 'CACI-00039', NULL, 'Francis Okyere',
   '1966-08-19',
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'Mechanic', 'Assakae, Agona Yakrom',
   '+233273369182', '+233364749133', 'active', NULL,
   NULL,
   'Francis Okyere', '+233273369182', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00040: Rebecca Appiah
  ('9d39ebd1-9241-468a-86e8-4ccad2a84d4b', 'CACI-00040', NULL, 'Rebecca Appiah',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   NULL, 'Takoradi, Western Region',
   '+233242549985', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00041: Rebecca Prah
  ('25badbcf-8a3b-4e72-8fd1-a866a8d308d7', 'CACI-00041', NULL, 'Rebecca Prah',
   '2002-03-06',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Assakae, Shama, Western Region',
   '+233535725722', '+233535725722', 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00042: Emmanuel Akadey
  ('83b8a301-0ef6-42e5-82b2-2437ec1519a3', 'CACI-00042', NULL, 'Emmanuel Akadey',
   '1976-09-27',
   'male'::public.gender_type, NULL::public.marital_status_type,
   NULL, 'Takoradi, Western Region',
   '+233243312141', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00043: Michael Amoah
  ('321376a2-097d-44df-92c5-e46b5585226e', 'CACI-00043', NULL, 'Michael Amoah',
   '1984-04-14',
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'Tanker Driver', 'Takoradi, Assakae, Western Region',
   '+233206390774', '+233206390774', 'active', '2004-01-01',
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00044: Elizabeth Agyemang Nyantakyi
  ('3f3a2f7c-896a-48b1-bf1e-cc6a842aac91', 'CACI-00044', NULL, 'Elizabeth Agyemang Nyantakyi',
   '1990-04-27',
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Fashion Designer', 'Takoradi, Western Region',
   '+233535445839', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00045: Frempong Philipa
  ('c879c403-9cdd-4d91-94cc-c5161264e88a', 'CACI-00045', NULL, 'Frempong Philipa',
   '2007-08-03',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Hair Stylist', NULL,
   '+233247699783', '+233264990151', 'active', NULL,
   NULL,
   'Emelia Addision', '+233594238006', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00046: Hannah Peasah
  ('9e9bed3d-2b11-4201-8f33-a0394e5cd453', 'CACI-00046', NULL, 'Hannah Peasah',
   '1980-04-14',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Hair Dresser', 'No. 33/1, Assakae, Western Region',
   NULL, NULL, 'active', '2002-05-07',
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-29 04:36:02.943987+00'),

  -- CACI-00047: Hannah Ayi Mensah
  ('7c4ccc42-8f9d-430e-b3a9-ca157b57d3be', 'CACI-00047', NULL, 'Hannah Ayi Mensah',
   '1991-06-20',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Yabeaw',
   '+233545898943', '+233545898943', 'active', NULL,
   NULL,
   'Solomon Ayi Mensah', '+233243055536', 'spouse',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00048: Ruth Appiah
  ('a8128cee-adba-43d5-a0dc-1511a109bf32', 'CACI-00048', NULL, 'Ruth Appiah',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', NULL,
   '+233244345089', NULL, 'active', NULL,
   NULL,
   'Abiba', '+233551719009', 'other',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00049: Cecilia Akon
  ('1deb493f-2794-428a-8ae1-81d10ae3125e', 'CACI-00049', NULL, 'Cecilia Akon',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   NULL, NULL,
   NULL, NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-29 04:36:02.943987+00'),

  -- CACI-00050: Mary Quaicoe
  ('4121e8ee-364d-4888-957b-3cd242d64e29', 'CACI-00050', NULL, 'Mary Quaicoe',
   NULL,
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader | Farmer', 'Assakae, Western Region',
   '+233203387744', NULL, 'active', '2013-01-01',
   NULL,
   'Mena Ekua', '+233550615044', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00051: Comfort Abena Aduamah
  ('c9108db1-49e9-4172-be98-f20407908113', 'CACI-00051', NULL, 'Comfort Abena Aduamah',
   '2014-05-20',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae, Western Region',
   '+233248381187', NULL, 'active', NULL,
   NULL,
   'Rose Gama', '+233248381187', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00052: Emmanuella Manu
  ('a7cf1abf-38a6-4215-81e0-040b2c227ce4', 'CACI-00052', NULL, 'Emmanuella Manu',
   '2000-04-14',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Takoradi, Western Region',
   '+233558440490', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00053: Frank Amoamah Bimpong
  ('fd71ca1a-eb80-4c71-9c18-85f0f6b115c5', 'CACI-00053', NULL, 'Frank Amoamah Bimpong',
   '2010-06-18',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Western Region',
   '+233506641039', '+233535445839', 'active', '2023-12-31',
   NULL,
   'Elizabeth Agyemang', '+233535445839', 'parent',
   true, NULL, '2026-05-28 15:07:50.24896+00'),

  -- CACI-00054: BENJAMIN KWEKU MENSAH
  ('ea955165-1ac5-46a4-a137-905b31016cae', 'CACI-00054', NULL, 'BENJAMIN KWEKU MENSAH',
   '1994-05-18',
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'PROJECT ADMINISTRATOR', 'PLY 48 ASSAKAE',
   '+233557887388', '+233557887388', 'active', '2005-09-29',
   NULL,
   '0243964292', '+233547110763', 'parent',
   true, NULL, '2026-05-31 10:44:41.281552+00'),

  -- CACI-00055: Ankomah Enoch Sekyi
  ('3309bcf1-5d6c-4fac-80dd-6c4c9e49a48c', 'CACI-00055', 'Mr.', 'Ankomah Enoch Sekyi',
   '2003-04-20',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   NULL, 'Assakae',
   '+233503283907', '+233503283907', 'active', '2024-09-25',
   NULL,
   'Rev. Stephen Ankomah', '+23324943912[', 'parent',
   true, NULL, '2026-05-31 10:50:56.690581+00'),

  -- CACI-00056: Emmanuel Quaido
  ('205c48e7-e8b0-4a81-998d-0e70ecaed30d', 'CACI-00056', NULL, 'Emmanuel Quaido',
   '1985-08-02',
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'Business', 'Assakae - After Bridge',
   '+233243612638', '+233243612638', 'active', NULL,
   NULL,
   'Colonius Quaidoo', '+233242775993', 'Other',
   true, NULL, '2026-06-14 08:49:08.919372+00'),

  -- CACI-00057: Grace Gaabin
  ('eebebc2f-96e9-4a6e-b517-62dfa089c304', 'CACI-00057', NULL, 'Grace Gaabin',
   NULL,
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Trader', NULL,
   NULL, NULL, 'active', '2026-06-15',
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-15 15:21:29.337635+00'),

  -- CACI-00058: Philomina Arthur
  -- CONFLICT RESOLVED: phone '5939531533' was not valid E.164 and cannot be reliably
  -- normalised. Stored as NULL to satisfy the partial unique index on phone_number.
  -- Collect the correct number in person.
  ('85abad2e-4def-4651-825e-35120b6694d7', 'CACI-00058', NULL, 'Philomina Arthur',
   '1997-07-18',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Fashion', 'Assakae',
   NULL, NULL, 'active', NULL,
   NULL,
   'Mr. Eric Abekah', '5311615289', NULL,
   true, NULL, '2026-06-15 15:23:06.374223+00'),

  -- CACI-00059: Edna Adu Quayson
  ('604d6bb2-095a-4ad1-a9ce-74ec2e232e05', 'CACI-00059', NULL, 'Edna Adu Quayson',
   '2011-03-21',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Student', 'Assakae',
   '+233503441354', NULL, 'active', NULL,
   NULL,
   'Florence Assafuah', '+233503381858', 'Parent',
   true, NULL, '2026-06-15 15:39:00.417252+00'),

  -- CACI-00060: Beatrice Oppong
  ('009cb3d1-5a78-4cb4-9335-399f733518f3', 'CACI-00060', NULL, 'Beatrice Oppong',
   '1993-10-25',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Hair Dressing', 'Assakae',
   '+233596338877', NULL, 'active', '2026-01-01',
   NULL,
   'Maxwell Cudjoe', '+233254066176', 'Spouse',
   true, NULL, '2026-06-15 15:39:13.186257+00'),

  -- CACI-00061: Florince Cobbinah
  ('69935240-c6be-4cb5-9be1-237f50e15842', 'CACI-00061', NULL, 'Florince Cobbinah',
   '1988-12-29',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Hair Dressing', 'Assakae',
   '+233555497073', '+233555497073', 'active', '2021-01-01',
   NULL,
   'Mr. Robert', '+233234302802', 'Spouse',
   true, NULL, '2026-06-15 15:39:20.917168+00'),

  -- CACI-00062: Rose Gyamfi
  -- CONFLICT RESOLVED: phone_number '+233248381187' duplicates CACI-00051 Comfort Abena
  -- Aduamah. Investigation: '+233248381187' is Comfort's own phone AND her emergency contact
  -- number. The same number was erroneously copied into Rose Gyamfi's prod record.
  -- Rose Gyamfi's real phone is unknown — set to NULL. Collect in person.
  ('f85475f3-1d5f-4779-a180-26c99a96a693', 'CACI-00062', NULL, 'Rose Gyamfi',
   '1972-07-03',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trading', 'Race Coarse',
   NULL, NULL, 'active', NULL,
   NULL,
   'Ruby Asante', '+233245107127', 'Other',
   true, NULL, '2026-06-15 16:01:57.656928+00'),

  -- CACI-00063: Abigail Addae
  ('4a0adf22-b292-47c8-b1f4-1283a226463a', 'CACI-00063', NULL, 'Abigail Addae',
   '1999-05-13',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Assakae After Bridge',
   '+233551169557', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-15 16:02:06.609907+00'),

  -- CACI-00064: John Quayson
  ('8d8b9e21-793a-4216-9e8e-f59ccc14075b', 'CACI-00064', 'Mr.', 'John Quayson',
   NULL,
   'male'::public.gender_type, NULL::public.marital_status_type,
   'Trader', 'Assakae',
   '+233256407202', '+233256407202', 'active', NULL,
   NULL,
   'Esther Quayson', '+233532004121', 'Child',
   true, NULL, '2026-06-15 16:02:14.84703+00'),

  -- CACI-00065: Theresah Acheampong
  ('3791d288-7a92-47f9-8c0b-4d1216328b71', 'CACI-00065', NULL, 'Theresah Acheampong',
   '1994-05-09',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae',
   '+233243264329', '+233243264329', 'active', NULL,
   NULL,
   'Elder Emma', '+233556280105', 'Other',
   true, NULL, '2026-06-15 16:02:20.747739+00'),

  -- CACI-00066: Lydia Adobah
  ('77945d59-69f2-4a2f-ab0d-ca83ba47abcd', 'CACI-00066', NULL, 'Lydia Adobah',
   '1978-01-08',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae Promise land',
   '+233556069623', '+233556069623', 'active', '2006-01-01',
   NULL,
   'Abigail Amoah', '+233550184914', 'Child',
   true, NULL, '2026-06-15 16:06:23.987687+00'),

  -- CACI-00067: Rebecca Cobbinah
  ('e13271c1-988e-4ebd-b2fd-160991ab79af', 'CACI-00067', 'Mrs.', 'Rebecca Cobbinah',
   '1982-07-03',
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', 'Assakae',
   '+233578980332', '+233277679787', 'active', '2012-01-01',
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-21 10:50:29.812257+00'),

  -- CACI-00068: Stephen Cobbinah
  ('d737ffad-db2a-4268-b602-4a2127a91ef2', 'CACI-00068', 'Mr.', 'Stephen Cobbinah',
   '1984-07-07',
   'male'::public.gender_type, 'married'::public.marital_status_type,
   'Driver', 'Assakae',
   '+233557096865', '+233557096865', 'active', '2004-03-15',
   NULL,
   'Mary Mensah', '+233546992325', 'Spouse',
   true, NULL, '2026-06-21 10:55:31.745806+00'),

  -- CACI-00069: Naomi Afetsi
  ('ad295379-c5cf-4afc-8c2b-a051b3ef5c0a', 'CACI-00069', NULL, 'Naomi Afetsi',
   '1998-02-28',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Midwife', 'Assakae',
   '+233544906862', '+233544906862', 'active', '2025-05-01',
   NULL,
   'Emmanuel Quayson', '+233247879682', 'Spouse',
   true, NULL, '2026-06-21 11:00:14.791357+00'),

  -- CACI-00070: Elizabeth Esi Gyan
  ('01afbb3b-fe50-482e-8882-11fec362a8e7', 'CACI-00070', 'Mrs.', 'Elizabeth Esi Gyan',
   NULL,
   'female'::public.gender_type, 'married'::public.marital_status_type,
   'Trader', NULL,
   '+233559105621', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-21 11:17:35.311756+00'),

  -- CACI-00071: Gifty Anokye
  -- CONFLICT RESOLVED: original phone '+2332424759670' had 13 digits after +233 (one extra
  -- trailing '0'). Ghana mobile numbers are +233 + 9 digits. Corrected to '+233242475967'.
  ('d90bddbf-a476-4e4d-a247-31e11b34554d', 'CACI-00071', NULL, 'Gifty Anokye',
   '1972-07-30',
   'female'::public.gender_type, NULL::public.marital_status_type,
   'Trading', 'Assakae',
   '+233242475967', '+233242475967', 'active', NULL,
   NULL,
   'Collins', '+233548063276', 'Other',
   true, NULL, '2026-06-21 11:17:44.134537+00'),

  -- CACI-00072: Emmanuel Koomson
  ('1448c373-35fc-4535-af71-2de10b315384', 'CACI-00072', NULL, 'Emmanuel Koomson',
   '1995-09-20',
   'male'::public.gender_type, 'single'::public.marital_status_type,
   'Trader', 'Assake',
   '+233535099715', '+233535099715', 'active', NULL,
   NULL,
   'Samuel Koomson', '+233534267152', 'Sibling',
   true, NULL, '2026-06-21 11:17:51.404724+00'),

  -- CACI-00073: Abigail Arthur
  ('1f274168-433f-4ba7-95d6-0680e77d6e30', 'CACI-00073', NULL, 'Abigail Arthur',
   '2001-12-26',
   'female'::public.gender_type, 'single'::public.marital_status_type,
   'Fashion', 'Assakae - Abaase',
   '+233535351805', NULL, 'active', '2021-01-01',
   NULL,
   'Mrs. Christina Andoh', '+233243452869', 'Other',
   true, NULL, '2026-06-21 11:27:38.410468+00'),

  -- CACI-00074: Rebecca Quaicoe
  ('c53353e2-15a9-4c65-9e44-be57a029da01', 'CACI-00074', NULL, 'Rebecca Quaicoe',
   NULL,
   'female'::public.gender_type, NULL::public.marital_status_type,
   NULL, NULL,
   '+233540486338', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-21 11:51:59.563387+00'),

  -- CACI-00075: Nicholas Asiedu
  ('4c29e510-bfdb-4364-aca5-c1972c765543', 'CACI-00075', NULL, 'Nicholas Asiedu',
   '1997-12-03',
   'male'::public.gender_type, NULL::public.marital_status_type,
   NULL, NULL,
   '+233599542164', NULL, 'active', NULL,
   NULL,
   NULL, NULL, NULL,
   true, NULL, '2026-06-21 11:59:07.390356+00')

ON CONFLICT (id) DO NOTHING;


-- ── Groups (5 departments) ─────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING (no target) catches both the PK (id) and the UNIQUE (name)
-- constraints — safe whether or not a prior seed used different UUIDs for the same names.
INSERT INTO public.groups (id, name, is_active, created_at)
VALUES
  ('c71b3baf-f66a-44b5-8f74-2ee05058a977', 'Peace', true, now()),
  ('a5d7b605-da7e-47d7-93d5-286279d9b5ae', 'Pastor', true, now()),
  ('3c3dbe48-7248-4299-9791-b735ea8ae397', 'Love', true, now()),
  ('94e63394-88f2-4129-88c4-6697da7b935d', 'Hope', true, now()),
  ('c13dc1f1-215e-453e-9e61-e26727d2a35b', 'Youth', true, now())
ON CONFLICT DO NOTHING;


-- ── Re-enable trigger ───────────────────────────────────────────────────────────
ALTER TABLE public.members ENABLE TRIGGER trg_assign_membership_number;


-- ── Membership counter ──────────────────────────────────────────────────────────
-- Advance counter to 75 so the next INSERT gets CACI-00076.
-- Safe on re-run — only updates if counter hasn't moved past 75 already.
UPDATE public.member_counter
SET    last_number = 75
WHERE  id          = 1
AND    last_number < 75;


COMMIT;