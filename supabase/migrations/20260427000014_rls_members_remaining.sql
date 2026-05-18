-- =============================================================================
-- CACI Hub — Migration 20260427000014
-- Purpose:  RLS policies — remaining members policies + member_audit_log policy
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      24
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000011_create_helper_functions.sql  (all 6 helper functions)
--   20260427000012_enable_rls.sql               (RLS enabled on all tables)
--   20260427000013_create_rls_policies.sql      (members SELECT + INSERT policies)
-- Reference: Document 5, Sections 8 and 9
-- =============================================================================
-- Immutable Rules enforced by this file:
--   IMR-01: No DELETE policy on members   — hard deletion blocked for all roles.
--   IMR-02: No INSERT/UPDATE/DELETE on member_audit_log — trigger-only writes.
--   Absence of policy = HTTP 403 for the corresponding operation.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — members: UPDATE and remaining SELECT policies
-- Reference: Document 5, Section 8
-- =============================================================================

-- Admin may SELECT all member records within their assembly — including soft-deleted rows.
-- Without this policy, Admin would only see is_active = true rows via
-- members_select_directory_roles. This policy's OR logic at evaluation time means
-- Admin matches this policy and skips the is_active filter entirely.
CREATE POLICY members_select_admin_include_deleted
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );


-- Admin and Secretary may UPDATE member records within their assembly.
-- USING filters the rows that can be targeted (only active rows — updates to
-- already-soft-deleted rows must go via a dedicated restore path, not this policy).
-- WITH CHECK ensures the updated row remains in the same assembly.
CREATE POLICY members_update_admin_secretary
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  )
  WITH CHECK (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
  );


-- Pastor may UPDATE member records within their assembly.
-- At the database level, this grants UPDATE on all member columns.
-- The application layer restricts the Pastor's edit form to pastoral_notes only.
-- Risk: a Pastor calling the API directly could update other fields.
-- This is an accepted Phase 1 trade-off — see Document 5, Section 8 risk note.
-- Phase 2 mitigation: dedicated update_pastoral_notes Edge Function.
CREATE POLICY members_update_pastoral_notes
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'pastor'
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  )
  WITH CHECK (
    public.get_user_role() = 'pastor'
    AND assembly_id = public.get_user_assembly_id()
  );


-- =============================================================================
-- NO DELETE POLICY on members (IMR-01)
-- =============================================================================
-- Hard deletion of member records is permanently blocked for all roles,
-- including Admin. This is enforced by the ABSENCE of any DELETE policy.
-- Soft delete is implemented via the UPDATE policies above:
--   UPDATE members SET is_active = false, deleted_at = now() WHERE id = ...
-- Any direct DELETE on this table via the API returns HTTP 403 for all roles.
-- Reference: Document 5, Section 8; Document 3, Section 8, IMR-01
-- =============================================================================
-- NO DELETE POLICY exists on public.members.


-- =============================================================================
-- SECTION 2 — member_audit_log: SELECT policy (IMR-02)
-- Reference: Document 5, Section 9
-- =============================================================================

-- Only Admin may read audit log entries, scoped to their own assembly.
CREATE POLICY audit_log_select_admin
  ON public.member_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );


-- =============================================================================
-- NO INSERT / UPDATE / DELETE POLICIES on member_audit_log (IMR-02)
-- =============================================================================
-- Audit log entries are written exclusively by the write_member_audit_log()
-- SECURITY DEFINER trigger (Migration 9). The trigger bypasses RLS by running
-- as the database owner.
--
-- No INSERT policy  — no role may write audit entries via the API.
-- No UPDATE policy  — audit log is immutable; no row may be modified.
-- No DELETE policy  — audit log is immutable; no row may be deleted.
--
-- Any API-level INSERT, UPDATE, or DELETE on member_audit_log returns HTTP 403.
-- Reference: Document 5, Section 9; Document 3, Section 8, IMR-02
-- =============================================================================
-- NO INSERT POLICY on public.member_audit_log.
-- NO UPDATE POLICY on public.member_audit_log.
-- NO DELETE POLICY on public.member_audit_log.


-- =============================================================================
-- END OF MIGRATION 20260427000014 — Day 24 complete
-- =============================================================================
--
-- Summary of all members policies (after Migrations 13 + 14):
--   members_select_directory_roles        — SELECT  — admin, pastor, secretary, volunteer (active rows)
--   members_select_own_member_role        — SELECT  — member (own row via created_by)
--   members_select_admin_include_deleted  — SELECT  — admin (all rows incl. soft-deleted)
--   members_insert_admin_secretary        — INSERT  — admin, secretary
--   members_update_admin_secretary        — UPDATE  — admin, secretary (active rows)
--   members_update_pastoral_notes         — UPDATE  — pastor (active rows; app restricts to pastoral_notes)
--   (none)                                — DELETE  — BLOCKED for all roles (IMR-01)
--
-- Summary of all member_audit_log policies:
--   audit_log_select_admin                — SELECT  — admin (own assembly)
--   (none)                                — INSERT  — BLOCKED (IMR-02; trigger writes only)
--   (none)                                — UPDATE  — BLOCKED (IMR-02; immutable)
--   (none)                                — DELETE  — BLOCKED (IMR-02; immutable)
--
-- Post-apply verification:
--
-- 1. Confirm all members policies exist:
--    SELECT policyname, cmd
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'members'
--    ORDER BY cmd, policyname;
--
-- 2. Confirm audit_log policies:
--    SELECT policyname, cmd
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'member_audit_log';
--
-- 3. Verify IMR-01 — no DELETE policy on members:
--    SELECT COUNT(*) FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'members' AND cmd = 'DELETE';
--    -- Expected: 0
--
-- 4. Verify IMR-02 — no INSERT/UPDATE/DELETE on member_audit_log:
--    SELECT COUNT(*) FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'member_audit_log'
--      AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
--    -- Expected: 0
-- =============================================================================
