-- =============================================================================
-- CACI Hub — Migration 20260521000001
-- Purpose:  Allow public (anon) access to the assemblies table.
--           Required for the unauthenticated Assembly Selection screen.
-- Author:   Antigravity AI
-- Date:     May 21, 2026
-- =============================================================================

-- 1. Grant SELECT privilege to the anon role
GRANT SELECT ON public.assemblies TO anon;

-- 2. Create RLS policy for anonymous SELECT
-- This allows anyone to see the list of active assemblies before logging in.
CREATE POLICY assemblies_select_public
  ON public.assemblies
  FOR SELECT
  TO anon
  USING (is_active = true);

-- =============================================================================
-- END OF MIGRATION 20260521000001
-- =============================================================================
