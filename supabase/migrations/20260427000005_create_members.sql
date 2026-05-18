-- =============================================================================
-- CACI Hub — Migration 20260427000005
-- Table:   members (COMPLETE — Days 15 + 16)
-- Author:  Abraham N. O. Bossman
-- Phase:   Phase 1 — Database Foundation
-- Days:    15–16
-- Date:    April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000001_create_enums.sql           (gender_type, marital_status_type,
--                                              membership_status enums)
--   20260427000002_create_assemblies.sql      (assemblies table + set_updated_at())
--   20260427000003_create_user_profiles.sql   (RLS helper functions)
--   20260427000004_create_households.sql      (households table for household_id FK)
-- Referenced by:
--   member_audit_log (member_id FK)
--   Migration 7     (deferrable FK: households.primary_contact_id -> members.id)
-- =============================================================================
-- Decisions applied in this file:
--   Day 11 Decision 2  — migration timestamp uses project start date (20260427)
--   Day 12 Decision 1  — set_updated_at() shared; referenced via EXECUTE FUNCTION
--   Day 12 Decision 2  — RLS enabled immediately, no data-access policies yet
--   Day 15 Decision 1  — membership_number is nullable at insert time (see below)
--   Day 16 Decision 1  — soft delete uses both is_active + deleted_at (see below)
--   Day 16 Decision 2  — partial UNIQUE on membership_number (WHERE deleted_at IS NULL)
-- =============================================================================
-- Day 15 Decision 1 — membership_number is NULL at INSERT time
--   Document 4 shows membership_number as NOT NULL UNIQUE. However, the correct
--   implementation flow is:
--     1. Flutter client INSERTs the member row (membership_number = NULL).
--     2. generate-membership-number Edge Function is called immediately after.
--     3. Edge Function UPDATEs the row with the generated number.
--   A NOT NULL constraint would block Step 1. The column is therefore nullable
--   and uniqueness is enforced via a partial index (WHERE deleted_at IS NULL)
--   to prevent duplicates once populated while excluding soft-deleted rows.
--   Reference: Document 6, Section 11.1
-- =============================================================================
-- Day 16 Decision 1 — dual soft-delete columns (is_active + deleted_at)
--   Both columns are retained for distinct semantic purposes:
--     is_active (boolean) — fast, index-friendly flag for active-member lists.
--     deleted_at (timestamptz) — audit trail for when the soft-delete occurred.
--   All partial indexes filter on `deleted_at IS NULL` to exclude soft-deleted rows.
--   `is_active = false` without a deleted_at indicates a suspended/inactive member
--   (e.g. transfer, long-term absence) — distinct from a deletion.
-- =============================================================================
-- Day 16 Decision 2 — partial UNIQUE index on membership_number
--   Instead of a table-level UNIQUE constraint (which would conflict with NULLs
--   from Day 15 Decision 1), a partial unique index is used:
--     CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL
--   This ensures uniqueness among active records while allowing soft-deleted
--   records to retain their former number for audit purposes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Create members table
-- -----------------------------------------------------------------------------

CREATE TABLE public.members (

  -- -------------------------------------------------------------------------
  -- Identity
  -- -------------------------------------------------------------------------

  id                 uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Assembly scope — applies to every RLS policy on this table (IMR-04).
  assembly_id        uuid                 NOT NULL
                     REFERENCES public.assemblies(id),

  -- Nullable at INSERT time. Populated by the generate-membership-number
  -- Edge Function immediately after the row is created.
  -- Format: CACI-[assembly_code]-[5-digit-zero-padded-sequence]
  -- e.g. CACI-GH-ASSAK-00001
  -- Uniqueness enforced by a partial index below (Day 16 Decision 2).
  -- Reference: Day 15 Decision 1; Document 6, Section 11.1
  membership_number  text,

  -- -------------------------------------------------------------------------
  -- Core biographical fields
  -- -------------------------------------------------------------------------

  first_name         text                 NOT NULL,

  last_name          text                 NOT NULL,

  -- Day 11 Decision 1 note: join_date ≠ created_at.
  -- date_of_birth is optional — not all members will know or share it.
  date_of_birth      date,

  -- Required. Uses gender_type enum from Migration 1.
  gender             public.gender_type   NOT NULL,

  -- Optional. Uses marital_status_type enum from Migration 1.
  marital_status     public.marital_status_type,

  -- -------------------------------------------------------------------------
  -- Contact information
  -- -------------------------------------------------------------------------

  -- Phone and email are nullable — not every member will have both.
  -- Uniqueness (per assembly, among non-deleted rows) enforced by partial indexes below.
  phone_number       text,

  email              text,

  physical_address   text,

  occupation         text,

  -- -------------------------------------------------------------------------
  -- Social links
  -- -------------------------------------------------------------------------

  facebook_url       text,

  -- WhatsApp may differ from phone_number (e.g. a different SIM).
  whatsapp_number    text,

  instagram_url      text,

  -- -------------------------------------------------------------------------
  -- Emergency contact
  -- -------------------------------------------------------------------------

  emergency_contact_name          text,

  emergency_contact_phone         text,

  emergency_contact_relationship  text,

  -- -------------------------------------------------------------------------
  -- Membership
  -- -------------------------------------------------------------------------

  -- Required. Defaults to 'visitor' on first insert — secretary/admin promotes to 'active'.
  membership_status  public.membership_status  NOT NULL DEFAULT 'visitor',

  -- Day 11 Decision 1: join_date is explicitly set by admin; ≠ created_at.
  join_date          date,

  -- Optional FK to households — a member may not belong to a registered household.
  -- ON DELETE SET NULL: deleting the household does not orphan the member row.
  household_id       uuid
                     REFERENCES public.households(id)
                     ON DELETE SET NULL,

  -- -------------------------------------------------------------------------
  -- Media
  -- -------------------------------------------------------------------------

  -- Supabase Storage object path — resolved to a signed URL in the application layer.
  profile_photo_url  text,

  -- -------------------------------------------------------------------------
  -- Restricted — pastoral care
  -- -------------------------------------------------------------------------

  -- Visible only to admin and pastor — enforced by RLS in the dedicated RLS migration.
  pastoral_notes     text,

  -- -------------------------------------------------------------------------
  -- Soft delete (Day 16 Decision 1)
  -- -------------------------------------------------------------------------

  -- Fast boolean flag used in active-member list queries.
  -- Partial indexes below filter on deleted_at IS NULL rather than is_active
  -- so that suspended-but-not-deleted members remain indexed.
  is_active          boolean              NOT NULL DEFAULT true,

  -- Timestamp of soft deletion — NULL means the row is not deleted.
  -- Set by the application layer; never set by a direct DELETE.
  deleted_at         timestamptz,

  -- -------------------------------------------------------------------------
  -- Record management
  -- -------------------------------------------------------------------------

  -- The auth.users row that created this member record.
  -- Nullable: allows system-generated seed data; ON DELETE SET NULL preserves
  -- the member record if the creating admin account is later removed.
  created_by         uuid
                     REFERENCES auth.users(id)
                     ON DELETE SET NULL,

  created_at         timestamptz          NOT NULL DEFAULT now(),

  updated_at         timestamptz          NOT NULL DEFAULT now()

);


-- -----------------------------------------------------------------------------
-- 2. Table and column comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.members IS
  'Core member registry for CACI Hub. Scoped to a single assembly via assembly_id. '
  'Membership numbers are assigned by the generate-membership-number Edge Function '
  'immediately after insert (Day 15 Decision 1). Soft-deleted rows have deleted_at '
  'set and remain for audit; they are excluded from all active-member indexes and policies.';

COMMENT ON COLUMN public.members.assembly_id IS
  'Assembly this member belongs to. Every RLS policy filters on this column (IMR-04).';

COMMENT ON COLUMN public.members.membership_number IS
  'Unique identifier in the format CACI-[assembly_code]-[5-digit-sequence]. '
  'NULL at insert time; populated by the generate-membership-number Edge Function. '
  'Uniqueness enforced by idx_members_membership_number_unique (partial, WHERE deleted_at IS NULL).';

COMMENT ON COLUMN public.members.membership_status IS
  'Lifecycle status of this member. Defaults to ''visitor'' at insert; '
  'promoted to ''active'' by admin or secretary after formal joining.';

COMMENT ON COLUMN public.members.join_date IS
  'Date the member formally joined the assembly. Explicitly set by admin; '
  'distinct from created_at (Day 11 Decision 1).';

COMMENT ON COLUMN public.members.household_id IS
  'Optional FK to the households table. NULL until the member is assigned to a household. '
  'ON DELETE SET NULL: deleting the household record does not orphan the member.';

COMMENT ON COLUMN public.members.pastoral_notes IS
  'Confidential pastoral-care notes visible only to admin and pastor roles. '
  'RLS column-level restriction applied in the dedicated RLS migration.';

COMMENT ON COLUMN public.members.is_active IS
  'Fast boolean flag indicating whether the member is active. '
  'Soft-deleted members have is_active = false AND deleted_at IS NOT NULL. '
  'Suspended (inactive but not deleted) members have is_active = false AND deleted_at IS NULL.';

COMMENT ON COLUMN public.members.deleted_at IS
  'Timestamp when the member record was soft-deleted. NULL means the record is not deleted. '
  'All partial indexes and RLS policies filter on deleted_at IS NULL.';

COMMENT ON COLUMN public.members.created_by IS
  'auth.users.id of the user who created this member record. '
  'NULL for system-generated or seeded records. ON DELETE SET NULL preserves the member '
  'if the creating admin account is later removed.';


-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
-- set_updated_at() defined once in 20260427000002_create_assemblies.sql.
-- Do NOT redefine here. Reference: Day 12 Decision 1.
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_members_set_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Enable Row Level Security
-- -----------------------------------------------------------------------------
-- Enabled immediately — table is never left unprotected between migrations.
-- With RLS on and no policies, all roles see zero rows (secure default).
-- Data-access policies applied in the dedicated RLS migration (Document 5 §8):
--   members_select_directory_roles  — admin, pastor, secretary, volunteer
--   members_select_own              — member (own row only)
--   members_insert_admin_secretary  — admin, secretary
--   members_update_admin_secretary  — admin, secretary
--   members_update_own              — member (limited columns, own row only)
--   members_delete_admin            — admin (soft delete only — sets deleted_at)
--   members_pastoral_notes_admin_pastor — column-level, admin + pastor only
-- Reference: Day 12 Decision 2
-- -----------------------------------------------------------------------------

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------

-- Primary access pattern: every members query starts with an assembly filter.
CREATE INDEX idx_members_assembly_id
  ON public.members (assembly_id);

-- Status filter — most common query: active members of an assembly.
-- Partial: only indexes visible (non-deleted) rows; excludes soft-deleted rows.
CREATE INDEX idx_members_membership_status
  ON public.members (assembly_id, membership_status)
  WHERE deleted_at IS NULL;

-- Household group lookup — used when viewing all members of a household.
-- Partial: only indexed when a household is assigned and row is not deleted.
CREATE INDEX idx_members_household_id
  ON public.members (household_id)
  WHERE household_id IS NOT NULL AND deleted_at IS NULL;

-- Uniqueness for membership_number among active rows (Day 15 Decision 1 + Day 16 Decision 2).
-- Partial unique: NULLs (pre-Edge-Function rows) are excluded from uniqueness check.
-- Soft-deleted rows may retain their former number without triggering uniqueness violation.
CREATE UNIQUE INDEX idx_members_membership_number_unique
  ON public.members (membership_number)
  WHERE membership_number IS NOT NULL AND deleted_at IS NULL;

-- Uniqueness for phone_number within an assembly, among non-deleted rows.
-- Partial: NULLs excluded (nullable column) and soft-deleted rows excluded.
CREATE UNIQUE INDEX idx_members_phone_unique
  ON public.members (assembly_id, phone_number)
  WHERE phone_number IS NOT NULL AND deleted_at IS NULL;

-- Uniqueness for email within an assembly, among non-deleted rows.
CREATE UNIQUE INDEX idx_members_email_unique
  ON public.members (assembly_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;


-- =============================================================================
-- END OF MIGRATION 20260427000005 (Days 15 + 16 — COMPLETE)
-- =============================================================================
--
-- Post-apply verification (run in Supabase SQL Editor after supabase db push):
--
-- 1. Confirm column count (expect 24):
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'members'
--    ORDER BY ordinal_position;
--
-- 2. Confirm RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'members';
--    -- Expected: rowsecurity = true
--
-- 3. Confirm updated_at trigger is attached:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE event_object_schema = 'public'
--      AND event_object_table = 'members';
--    -- Expected: trg_members_set_updated_at
--
-- 4. Confirm all 6 indexes exist:
--    SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'members'
--    ORDER BY indexname;
--    -- Expected: members_pkey, idx_members_assembly_id,
--    --           idx_members_membership_status, idx_members_household_id,
--    --           idx_members_membership_number_unique,
--    --           idx_members_phone_unique, idx_members_email_unique
--
-- 5. Confirm FK constraints (assembly_id, household_id, created_by):
--    SELECT constraint_name, constraint_type
--    FROM information_schema.table_constraints
--    WHERE table_schema = 'public' AND table_name = 'members';
--
-- Day 16 commit:
--   git add . && git commit -m "Day 16 — Migration 5 complete: members table with all columns and unique indexes"
--
-- Day 17 task: Migration 6 — member_audit_log (references members.id)
-- =============================================================================
