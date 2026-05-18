-- =============================================================================
-- CACI Hub — Migration 20260427000009
-- Purpose:  write_member_audit_log() trigger function + trigger attachment
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Days:     19–20
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000002_create_assemblies.sql      (set_updated_at() already defined)
--   20260427000005_create_members.sql         (members table)
--   20260427000006_create_member_audit_log.sql (member_audit_log table)
-- =============================================================================
-- Day 19 note — set_updated_at():
--   The set_updated_at() trigger function was defined in Migration 2 and is
--   already attached to assemblies, user_profiles, households, and members via
--   their respective migration files. DO NOT redefine here.
--   Reference: Day 12 Decision 1.
--
-- Day 20 — write_member_audit_log():
--   SECURITY DEFINER: runs as the table owner, bypassing RLS on member_audit_log.
--   This is required because no INSERT policy exists on member_audit_log (IMR-02).
--   Reference: Document 4, Section 7.2
-- =============================================================================


-- -----------------------------------------------------------------------------
-- write_member_audit_log() — field-level audit trigger function
-- -----------------------------------------------------------------------------
-- Fires AFTER UPDATE on members.
-- For each column in the auditable_columns list, compares OLD and NEW values.
-- Inserts one row into member_audit_log per changed field.
-- Uses dynamic SQL (EXECUTE format) to read column values by name from the
-- OLD and NEW composite row types — required for the generic column loop.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auditable_columns TEXT[] := ARRAY[
    'first_name', 'last_name', 'phone_number', 'email',
    'occupation', 'physical_address', 'facebook_url',
    'whatsapp_number', 'instagram_url',
    'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relationship',
    'membership_status', 'gender', 'marital_status',
    'household_id', 'profile_photo_url', 'pastoral_notes',
    'is_active', 'deleted_at', 'join_date'
  ];
  col_name  TEXT;
  old_val   TEXT;
  new_val   TEXT;
BEGIN
  FOREACH col_name IN ARRAY auditable_columns LOOP
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.member_audit_log (
        member_id, assembly_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id,
        NEW.assembly_id,
        auth.uid(),
        col_name,
        old_val,
        new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.write_member_audit_log() IS
  'AFTER UPDATE trigger on members. Inserts one member_audit_log row per changed '
  'auditable field. Runs as SECURITY DEFINER to bypass the absence of an INSERT '
  'policy on member_audit_log (IMR-02). Reference: Document 4, Section 7.2.';


-- -----------------------------------------------------------------------------
-- Attach trigger to members table
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_members_audit_log
  AFTER UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.write_member_audit_log();


-- =============================================================================
-- END OF MIGRATION 20260427000009
-- =============================================================================
--
-- Post-apply verification:
--
-- 1. Confirm trigger exists:
--    SELECT trigger_name, event_manipulation, action_timing
--    FROM information_schema.triggers
--    WHERE event_object_schema = 'public'
--      AND event_object_table = 'members';
--    -- Expected: trg_members_set_updated_at (BEFORE UPDATE)
--    --           trg_members_audit_log (AFTER UPDATE)
--
-- 2. Smoke test (requires a member row — skip if no seed data yet):
--    UPDATE public.members SET first_name = first_name WHERE id = '<any-id>';
--    -- No change → no audit row expected (IS DISTINCT FROM catches this).
--    UPDATE public.members SET first_name = 'TestName' WHERE id = '<any-id>';
--    SELECT * FROM public.member_audit_log WHERE field_changed = 'first_name';
--    -- Expected: one row with old_value = original name, new_value = 'TestName'.
-- =============================================================================
