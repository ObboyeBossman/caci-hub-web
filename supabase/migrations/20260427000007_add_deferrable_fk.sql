-- =============================================================================
-- CACI Hub — Migration 20260427000007
-- Purpose:  Add deferrable FK — households.primary_contact_id → members.id
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      17
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000004_create_households.sql  (households table — primary_contact_id column)
--   20260427000005_create_members.sql     (members table — id column)
-- =============================================================================
-- Context — circular reference resolution:
--   households.primary_contact_id (uuid) → members.id
--   members.household_id (uuid)           → households.id
--
--   Migration 4 declared primary_contact_id as a plain nullable uuid (no FK)
--   because members did not yet exist. Now that members exists, we add the FK
--   as a DEFERRABLE INITIALLY DEFERRED constraint:
--   — The FK is only checked at COMMIT time, not per-statement.
--   — This allows a household and its primary contact member to be inserted
--     in the same transaction without a constraint violation.
--
--   Reference: Document 4, Section 4.3; Day 14 Decision 1
-- =============================================================================


ALTER TABLE public.households
  ADD CONSTRAINT fk_households_primary_contact
  FOREIGN KEY (primary_contact_id)
  REFERENCES public.members(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;


-- =============================================================================
-- END OF MIGRATION 20260427000007
-- =============================================================================
--
-- Post-apply verification:
--
-- Confirm the deferrable FK now exists:
--   SELECT constraint_name, constraint_type, is_deferrable, initially_deferred
--   FROM information_schema.table_constraints
--   WHERE table_schema = 'public'
--     AND table_name = 'households'
--     AND constraint_type = 'FOREIGN KEY';
--   -- Expected: fk_households_primary_contact | FOREIGN KEY | YES | YES
-- =============================================================================
