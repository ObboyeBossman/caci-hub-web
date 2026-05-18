-- =============================================================================
-- CACI Hub — Migration 20260427000017
-- Purpose:  Grant table-level privileges to the `authenticated` and `anon`
--           Postgres roles.
--
--           RLS policies control WHICH rows are visible, but Postgres requires
--           the role to have the underlying table privilege (SELECT/INSERT/etc.)
--           before it even evaluates RLS. Without these grants, every query
--           returns 42501 "permission denied for table" regardless of policies.
--
-- Author:   Abraham N. O. Bossman
-- Day:      28 (bug fix — applied after Day 22 migrations)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- authenticated role — users who have signed in via Supabase Auth
-- RLS policies will further restrict which rows are accessible.
-- -----------------------------------------------------------------------------

GRANT SELECT                         ON public.assemblies        TO authenticated;
GRANT SELECT                         ON public.user_profiles     TO authenticated;
GRANT INSERT, UPDATE                 ON public.user_profiles     TO authenticated;

GRANT SELECT                         ON public.households        TO authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.households        TO authenticated;

GRANT SELECT                         ON public.members           TO authenticated;
GRANT INSERT, UPDATE                 ON public.members           TO authenticated;

GRANT SELECT                         ON public.member_audit_log  TO authenticated;
-- No INSERT/UPDATE/DELETE on audit log — written only by SECURITY DEFINER trigger (IMR-02)

-- -----------------------------------------------------------------------------
-- anon role — unauthenticated requests (should see nothing due to RLS,
-- but the role must exist as a grantee)
-- We do NOT grant anon any table access — RLS + absence of grant = 0 rows.
-- -----------------------------------------------------------------------------

-- (No grants to anon — intentional. All routes require authenticated session.)

-- =============================================================================
-- END OF MIGRATION 20260427000017
-- =============================================================================
