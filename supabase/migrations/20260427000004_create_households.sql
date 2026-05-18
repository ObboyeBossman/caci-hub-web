-- =============================================================================
-- CACI Hub — Migration 20260427000004
-- Table:   households
-- Author:  Abraham N. O. Bossman
-- Phase:   Phase 1 — Database Foundation
-- Day:     14
-- Date:    April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000001_create_enums.sql       (enum types must exist)
--   20260427000002_create_assemblies.sql  (assemblies table + set_updated_at() must exist)
--   20260427000003_create_user_profiles.sql (RLS helper functions must exist)
-- Referenced by:
--   members (members.household_id references households.id)
--   Migration 7 (deferrable FK: households.primary_contact_id -> members.id)
-- =============================================================================
-- Decisions applied in this file:
--   Day 11 Decision 2  — migration timestamp uses project start date (20260427)
--   Day 12 Decision 1  — set_updated_at() already defined in migration 2;
--                         referenced here via EXECUTE FUNCTION, not redefined
--   Day 12 Decision 2  — RLS enabled immediately with no data-access policies
--                         (secure default; policies applied in dedicated RLS migration)
-- =============================================================================
-- Circular reference note:
--   households.primary_contact_id (uuid) will eventually reference members.id.
--   members.household_id (uuid) references households.id.
--   PostgreSQL cannot resolve this circular dependency if both FKs are declared
--   simultaneously. Solution: declare primary_contact_id as a plain nullable uuid
--   here (no FK), then add the deferrable FK constraint in Migration 7 after the
--   members table exists.
--   Reference: Document 4, Section 4.3
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Create households table
-- -----------------------------------------------------------------------------

CREATE TABLE public.households (

  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Assembly scope — all RLS policies filter on this column.
  assembly_id        uuid          NOT NULL
                     REFERENCES public.assemblies(id),

  -- Household display name: e.g. "Asante Family", "Mensah Household".
  family_name        text          NOT NULL,

  -- Optional household address — may differ from individual member addresses.
  address            text,

  -- The primary contact within this household.
  -- Stored as a plain uuid here — no FK constraint yet.
  -- NOTE: FK for primary_contact_id to members.id is added as a deferrable
  -- constraint in Migration 7 to resolve the circular reference.
  -- When the FK is eventually added: ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED.
  primary_contact_id uuid,

  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()

);


-- -----------------------------------------------------------------------------
-- 2. Table and column comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.households IS
  'Groups member records into family units. Scoped to a single assembly. '
  'primary_contact_id is a plain uuid here; the FK to members.id is added '
  'as a deferrable constraint in Migration 7 to resolve the circular reference '
  'caused by members.household_id referencing this table.';

COMMENT ON COLUMN public.households.assembly_id IS
  'Assembly this household belongs to. All RLS policies scope households '
  'to the requesting user''s assembly via this column.';

COMMENT ON COLUMN public.households.family_name IS
  'Display name for the household. e.g. "Asante Family". '
  'Required — a household must have a name to be meaningful.';

COMMENT ON COLUMN public.households.address IS
  'Optional household address. May differ from individual member addresses '
  '(e.g. a family home vs a member''s personal residence).';

COMMENT ON COLUMN public.households.primary_contact_id IS
  'UUID of the primary contact member for this household. '
  'Stored without a FK constraint until Migration 7 adds the deferrable FK '
  '(households.primary_contact_id -> members.id ON DELETE SET NULL '
  'DEFERRABLE INITIALLY DEFERRED). Will be NULL until explicitly set by the Admin.';


-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
-- set_updated_at() defined once in 20260427000002_create_assemblies.sql.
-- Do NOT redefine here. Reference: Day 12 Decision 1.
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Enable Row Level Security
-- -----------------------------------------------------------------------------
-- Enabled immediately — table is never left unprotected between migrations.
-- With RLS on and no policies, all roles see zero rows (secure default).
-- Data-access policies applied in the dedicated RLS migration (Document 5 §7):
--   households_select_directory_roles  — admin, pastor, secretary, volunteer
--   households_insert_admin_secretary  — admin, secretary
--   households_update_admin_secretary  — admin, secretary
--   households_delete_admin            — admin (only if no members assigned)
-- Reference: Day 12 Decision 2
-- -----------------------------------------------------------------------------

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------

-- Primary access pattern: all household queries filter by assembly first.
CREATE INDEX idx_households_assembly_id
  ON public.households (assembly_id);

-- Lookup by primary contact — used in household profile view and member unlink.
-- Partial index: only indexed when a primary contact is actually set.
CREATE INDEX idx_households_primary_contact_id
  ON public.households (primary_contact_id)
  WHERE primary_contact_id IS NOT NULL;


-- =============================================================================
-- END OF MIGRATION 20260427000004
-- =============================================================================
--
-- Post-apply verification (run in Supabase SQL Editor after supabase db push):
--
-- 1. Confirm table columns:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'households'
--    ORDER BY ordinal_position;
--    -- Expected: 7 columns — id, assembly_id, family_name, address,
--    --           primary_contact_id, created_at, updated_at
--
-- 2. Confirm NO FK on primary_contact_id yet (only the assemblies FK should exist):
--    SELECT constraint_name, constraint_type
--    FROM information_schema.table_constraints
--    WHERE table_schema = 'public' AND table_name = 'households';
--    -- Expected: households_pkey (PRIMARY KEY), one FK for assembly_id.
--    --           NO fk_households_primary_contact — that comes in Migration 7.
--
-- 3. Confirm RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'households';
--    -- Expected: rowsecurity = true
--
-- 4. Confirm updated_at trigger is attached:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE event_object_schema = 'public'
--      AND event_object_table = 'households';
--    -- Expected: trg_households_set_updated_at
--
-- Day 14 commit:
--   git add . && git commit -m "Day 14 — Migration 4: households table"
--
-- Day 15 task: 20260427000005_create_members.sql (first half — identity + biographical fields)
--   Remember: members.household_id FK references households.id (safe — households exists now).
--   Remember: set_updated_at() — do not redefine, just call.
-- =============================================================================
