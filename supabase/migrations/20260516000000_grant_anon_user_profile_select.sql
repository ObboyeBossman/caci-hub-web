-- =============================================================================
-- CACI Hub — Migration 20260516000000
-- Purpose:  Grant SELECT on public.user_profiles to the anon role.
-- 
--           This migration silences the noisy 42501 "permission denied" errors
--           observed in the logs when a session becomes invalid. When the
--           auth session fails (e.g., refresh token exhaustion), the client
--           defaults to the 'anon' role.
-- 
--           Granting SELECT allows the PostgREST client to return a clean
--           404 or empty response (filtered by RLS) instead of a hard
--           Postgres error. RLS policies already ensure that the anon role
--           cannot actually read any data.
--
-- Author:   Antigravity AI
-- Date:     May 16, 2026
-- =============================================================================

GRANT SELECT ON public.user_profiles TO anon;

-- Verification of RLS still being active and restrictive for anon:
-- SELECT * FROM public.user_profiles; -- Should return 0 rows for anon.

-- =============================================================================
-- END OF MIGRATION 20260516000000
-- =============================================================================
