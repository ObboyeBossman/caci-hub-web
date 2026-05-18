-- =============================================================================
-- CACI Hub — Migration 20260503063000
-- Purpose:  Explicitly grant SELECT/INSERT/UPDATE to service_role.
--           Ensures Edge Functions (admin context) are never blocked by
--           table-level Missing Grant errors (42501).
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
