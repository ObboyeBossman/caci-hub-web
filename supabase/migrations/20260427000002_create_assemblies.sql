-- =============================================================================
-- CACI Hub — Migration 20260427000002
-- Table: assemblies
-- Author: Abraham N. O. Bossman
-- Phase: Phase 1 — Database Foundation
-- Day: 12
-- Date: May 5, 2026
-- =============================================================================
-- Depends on: None. The assemblies table does not reference any enums.
-- Referenced by: user_profiles, households, members, member_audit_log (all carry assembly_id FK)
-- =============================================================================
-- Decisions applied in this file:
--   Day 10 Decision 2 — assembly_code format: [A-Z]{2}-[A-Z]{3,6} regex constraint
--   Day 10 Decision 4 — digital_address column added (GhanaPostGPS code, NULLable)
--   Day 10 Decision 6 — no standalone `country` column in Phase 1
--   Day 11 Decision 2 — migration timestamp uses project start date (20260427), not execution date
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create assemblies table
-- -----------------------------------------------------------------------------

CREATE TABLE public.assemblies (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,

  -- Format: [2-letter country code]-[3-6 letter assembly abbreviation]
  -- Examples: GH-ASSAK, GH-ACCR, UK-LDN, US-ATL
  -- Day 10 Decision 2
  assembly_code    text          NOT NULL UNIQUE
                   CHECK (assembly_code ~ '^[A-Z]{2}-[A-Z]{3,6}$'),

  address          text,

  -- GhanaPostGPS digital address code e.g. WR-1234-5678.
  -- NULL until confirmed by the assembly. Day 10 Decision 4.
  digital_address  text,

  -- Soft-disable flag. Used by future Super Admin UI (multi-assembly phase).
  is_active        boolean       NOT NULL DEFAULT true,

  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Comment the table and columns for Supabase dashboard discoverability
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.assemblies IS
  'Assembly (church branch) registry. Pre-seeded in Phase 1 — not user-managed via UI until the multi-assembly management phase.';

COMMENT ON COLUMN public.assemblies.assembly_code IS
  'Short structured code used in membership number generation. Format: [2-letter country ISO]-[3–6 letter abbreviation]. e.g. GH-ASSAK. Enforced by CHECK constraint.';

COMMENT ON COLUMN public.assemblies.digital_address IS
  'Ghana GhanaPostGPS digital address code. e.g. WR-1234-5678. NULL until the GPS code is confirmed for the assembly location.';

COMMENT ON COLUMN public.assemblies.is_active IS
  'Soft-disable flag. Set to false to deactivate an assembly without deleting its records. Not used in Phase 1 (single assembly).';

-- -----------------------------------------------------------------------------
-- 3. updated_at auto-maintenance trigger
-- -----------------------------------------------------------------------------
-- This trigger keeps updated_at in sync on every UPDATE to the assemblies row.
-- The same pattern is used on all Phase 1 tables (user_profiles, households,
-- members). The trigger function is defined once here and reused by all tables.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Generic trigger function that sets updated_at = now() on every row UPDATE. Shared across all Phase 1 tables.';

CREATE TRIGGER trg_assemblies_set_updated_at
  BEFORE UPDATE ON public.assemblies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Enable Row Level Security
-- -----------------------------------------------------------------------------
-- RLS is enabled manually per migration, not via Supabase auto-RLS.
-- Day 3 project setting: "Enable automatic RLS" was DISABLED. (IDR-001 §4.2)
-- Actual RLS policies are defined in Document 5 — RLS Policy Specification
-- and will be applied in a dedicated RLS migration. Enabling RLS here without
-- policies locks the table down to zero rows for all roles until policies are
-- added — this is the correct, secure default.
-- -----------------------------------------------------------------------------

ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------
-- assembly_code already carries a UNIQUE constraint which PostgreSQL implements
-- as a unique B-tree index automatically. No additional index is needed on it.
-- An index on is_active supports future dashboard aggregate queries that filter
-- active assemblies, though with a single row in Phase 1 this is a readiness
-- index for future phases.

CREATE INDEX idx_assemblies_is_active
  ON public.assemblies (is_active);

-- =============================================================================
-- END OF MIGRATION 20260427000002
-- =============================================================================
