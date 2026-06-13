-- =============================================================================
-- CACI Hub — Squashed Migration 02: Shared Trigger Functions
-- Generic functions shared across all tables.
-- =============================================================================

-- ── set_updated_at ────────────────────────────────────────────────────────────
-- Fires BEFORE UPDATE on any table that needs updated_at maintenance.
-- SET search_path added per Supabase Security Advisor guidance.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Generic trigger function that sets updated_at = now() on every row UPDATE. '
  'Shared across all tables that carry an updated_at column.';
