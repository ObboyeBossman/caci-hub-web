-- =============================================================================
-- CACI Hub — Migration
-- Purpose: Fix PostgREST implicit join by linking changed_by to user_profiles
-- =============================================================================

ALTER TABLE public.member_audit_log
  DROP CONSTRAINT IF EXISTS member_audit_log_changed_by_fkey;

ALTER TABLE public.member_audit_log
  ADD CONSTRAINT member_audit_log_changed_by_fkey
  FOREIGN KEY (changed_by)
  REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;
