-- =============================================================================
-- CACI Hub — Migration 20260427000006
-- Table:   member_audit_log
-- Author:  Abraham N. O. Bossman
-- Phase:   Phase 1 — Database Foundation
-- Day:     17
-- Date:    April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000002_create_assemblies.sql  (assemblies table + set_updated_at())
--   20260427000005_create_members.sql     (members table — member_id FK)
-- Referenced by:
--   Migration 11c (RLS: audit_log_select_admin policy)
-- =============================================================================
-- Purpose:
--   Immutable audit trail of every field change on a member record.
--   Written exclusively by the write_member_audit_log() SECURITY DEFINER trigger
--   (defined in Migration 9). No application role may INSERT, UPDATE, or DELETE
--   rows in this table — enforced by the absence of those RLS policies (IMR-02).
-- =============================================================================
-- Decisions applied:
--   Day 11 Decision 2  — migration timestamp uses project start date (20260427)
--   Day 12 Decision 2  — RLS enabled immediately, no data-access policies yet
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Create member_audit_log table
-- -----------------------------------------------------------------------------

CREATE TABLE public.member_audit_log (

  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The member whose record was changed.
  -- ON DELETE CASCADE: deleting a member deletes their audit trail.
  member_id      uuid          NOT NULL
                 REFERENCES public.members(id)
                 ON DELETE CASCADE,

  -- Assembly scope — required for the RLS policy that restricts admin to own assembly.
  assembly_id    uuid          NOT NULL
                 REFERENCES public.assemblies(id),

  -- The authenticated user who triggered the change.
  -- ON DELETE SET NULL: removing an admin account preserves the audit entry.
  changed_by     uuid
                 REFERENCES auth.users(id)
                 ON DELETE SET NULL,

  -- Name of the column that changed, e.g. 'first_name', 'membership_status'.
  field_changed  text          NOT NULL,

  -- Previous value cast to text. NULL if the field was previously NULL.
  old_value      text,

  -- New value cast to text. NULL if the field was set to NULL.
  new_value      text,

  -- Timestamp of the change. Set by the trigger; not user-settable.
  changed_at     timestamptz   NOT NULL DEFAULT now()

);


-- -----------------------------------------------------------------------------
-- 2. Table and column comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.member_audit_log IS
  'Immutable audit trail of field-level changes to member records. '
  'Written only by the write_member_audit_log SECURITY DEFINER trigger. '
  'No application role may INSERT, UPDATE, or DELETE rows — see IMR-02.';

COMMENT ON COLUMN public.member_audit_log.field_changed IS
  'Name of the members column that changed. One row per changed field per UPDATE.';

COMMENT ON COLUMN public.member_audit_log.old_value IS
  'Previous column value cast to text. NULL if the column was previously NULL.';

COMMENT ON COLUMN public.member_audit_log.new_value IS
  'New column value cast to text. NULL if the column was set to NULL.';

COMMENT ON COLUMN public.member_audit_log.changed_by IS
  'auth.uid() of the user whose request caused the UPDATE. Set by the trigger.';


-- -----------------------------------------------------------------------------
-- 3. Enable Row Level Security
-- -----------------------------------------------------------------------------
-- No policies yet — applied in Migration 11c.
-- With RLS on and no policies: all roles see zero rows (secure default).
-- Reference: Day 12 Decision 2
-- -----------------------------------------------------------------------------

ALTER TABLE public.member_audit_log ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------

-- Most common query: all audit entries for a specific member.
CREATE INDEX idx_audit_log_member_id
  ON public.member_audit_log (member_id);

-- Chronological audit view for admin dashboard — filtered by assembly.
CREATE INDEX idx_audit_log_assembly_changed_at
  ON public.member_audit_log (assembly_id, changed_at DESC);


-- =============================================================================
-- END OF MIGRATION 20260427000006
-- =============================================================================
--
-- Post-apply verification:
--
-- 1. Confirm table columns (expect 8):
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'member_audit_log'
--    ORDER BY ordinal_position;
--
-- 2. Confirm RLS enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'member_audit_log';
--    -- Expected: rowsecurity = true
--
-- Day 17 task: also add deferrable FK (see Migration 20260427000007).
-- =============================================================================
