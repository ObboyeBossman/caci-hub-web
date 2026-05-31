-- =============================================================================
-- Migration: 20260529000001_drop_contact_required_constraint.sql
-- Description: Drop the chk_members_contact_required CHECK constraint so that
--              members can be registered without a primary phone number OR email.
--              Both columns remain nullable; no uniqueness rules are affected.
-- =============================================================================

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS chk_members_contact_required;
