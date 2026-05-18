-- =============================================================================
-- CACI Hub — Migration 20260427000012
-- Purpose:  Enable Row Level Security on all 5 Phase 1 tables
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      22
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000002_create_assemblies.sql          (assemblies)
--   20260427000003_create_user_profiles.sql       (user_profiles)
--   20260427000004_create_households.sql          (households)
--   20260427000005_create_members.sql             (members)
--   20260427000006_create_member_audit_log.sql    (member_audit_log)
--   20260427000011_create_helper_functions.sql    (helper functions required by policies)
-- =============================================================================
-- Note: RLS was already enabled inline in each table's migration (Day 12 Decision 2).
-- This migration verifies the secure default is in place before adding policies.
-- Using IF NOT EXISTS-equivalent pattern: ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- is idempotent in PostgreSQL — running it when already enabled is a no-op.
-- Reference: Document 5, Sections 5–9
-- =============================================================================

ALTER TABLE public.assemblies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_audit_log    ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- END OF MIGRATION 20260427000012
-- =============================================================================
--
-- Post-apply verification:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN (
--       'assemblies', 'user_profiles', 'households',
--       'members', 'member_audit_log'
--     );
--   -- Expected: all 5 rows show rowsecurity = true
-- =============================================================================
