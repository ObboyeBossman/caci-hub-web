-- =============================================================================
-- CACI Hub — Migration 20260509000001
-- Purpose:  Restore member_audit_log.changed_by FK to auth.users.
--           Migration 20260501044607 incorrectly pointed it to user_profiles,
--           which breaks audit logging when a user has no profile row yet
--           (e.g. during provisioning or after profile deletion).
-- =============================================================================

ALTER TABLE public.member_audit_log
  DROP CONSTRAINT IF EXISTS member_audit_log_changed_by_fkey;

ALTER TABLE public.member_audit_log
  ADD CONSTRAINT member_audit_log_changed_by_fkey
  FOREIGN KEY (changed_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;