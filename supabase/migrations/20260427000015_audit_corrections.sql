-- =============================================================================
-- CACI Hub — Migration 20260427000015
-- Purpose:  Day 17–23 audit corrections
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Date:     April 27, 2026
-- =============================================================================
-- This migration fixes two issues found during the Day 17–24 implementation audit:
--
-- ISSUE 1 (Day 18): Missing idx_members_is_active index
--   Task spec (Document 4, Section 6) lists an index on is_active.
--   The Day 18 migration omitted it. Added here.
--
-- ISSUE 2 (Day 23): members_select_directory_roles missing deleted_at IS NULL
--   The task spec includes: AND deleted_at IS NULL in the SELECT policy.
--   Our implementation only had: AND is_active = true
--   While logically redundant in a well-maintained dataset (is_active = false
--   when deleted_at IS NOT NULL), the explicit guard is safer and matches the
--   task spec. Policy recreated with both conditions.
--
-- Day 23 Decision (not a bug): members_select_own_member_role uses
--   created_by = auth.uid() rather than id = auth.uid().
--   This is an intentional Phase 1 design decision per Document 5, Section 8.
--   The member's auth.uid() ≠ members.id (members.id is a system UUID).
--   See DAY_23_DECISIONS.md for full rationale.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FIX 1: Add missing is_active index on members (Day 18 gap)
-- -----------------------------------------------------------------------------
-- Supports fast queries for suspended members (is_active = false, deleted_at IS NULL)
-- which are not captured by the membership_status index.

CREATE INDEX IF NOT EXISTS idx_members_is_active
  ON public.members (assembly_id, is_active)
  WHERE deleted_at IS NULL;


-- -----------------------------------------------------------------------------
-- FIX 2: Recreate members_select_directory_roles with deleted_at IS NULL guard
-- (Day 23 gap)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS members_select_directory_roles ON public.members;

CREATE POLICY members_select_directory_roles
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_directory()
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
    AND deleted_at IS NULL
  );


-- =============================================================================
-- END OF MIGRATION 20260427000015 — Audit corrections
-- =============================================================================
--
-- Post-apply verification:
--
-- 1. Confirm is_active index exists:
--    SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'members'
--      AND indexname = 'idx_members_is_active';
--
-- 2. Confirm the corrected policy includes deleted_at IS NULL:
--    SELECT policyname, qual FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'members'
--      AND policyname = 'members_select_directory_roles';
-- =============================================================================
