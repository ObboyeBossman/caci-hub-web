-- =============================================================================
-- CACI Hub — Migration 20260427000008
-- Purpose:  Performance indexes — all Phase 1 tables
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      18
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000003_create_user_profiles.sql  (user_profiles table)
--   20260427000005_create_members.sql        (members table)
--   20260427000006_create_member_audit_log.sql (member_audit_log table)
-- Reference: Document 4, Section 6
-- =============================================================================
-- Note: indexes already added inline in their respective table migrations
-- (e.g. idx_members_assembly_id, idx_members_phone_unique, etc.) are NOT
-- redefined here to avoid duplicate index errors.
-- This migration adds the additional performance indexes as specified in §6.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- members table — additional performance indexes
-- -----------------------------------------------------------------------------

-- Last name prefix search — used in the member directory search bar.
CREATE INDEX idx_members_last_name
  ON public.members (last_name)
  WHERE deleted_at IS NULL;

-- Chronological member list — used in admin exports and activity feeds.
CREATE INDEX idx_members_created_at
  ON public.members (assembly_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Soft-delete monitoring — used to list recently deleted members.
CREATE INDEX idx_members_deleted_at
  ON public.members (assembly_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- Full-text search on member name — used in the directory search bar.
-- GIN index on the tsvector of first_name + last_name.
CREATE INDEX idx_members_fulltext
  ON public.members
  USING GIN (to_tsvector('english', first_name || ' ' || last_name));


-- -----------------------------------------------------------------------------
-- user_profiles table — additional performance indexes
-- -----------------------------------------------------------------------------

-- Already defined inline in migration 3. Confirm only; no redefinition.
-- idx_user_profiles_assembly_id is added here if not already present.
CREATE INDEX IF NOT EXISTS idx_user_profiles_assembly_id
  ON public.user_profiles (assembly_id);


-- =============================================================================
-- END OF MIGRATION 20260427000008
-- =============================================================================
--
-- Post-apply verification:
--
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
--   -- Confirm all expected indexes appear.
-- =============================================================================
