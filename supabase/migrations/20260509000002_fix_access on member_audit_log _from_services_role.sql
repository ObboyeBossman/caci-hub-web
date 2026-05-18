-- =============================================================================
-- CACI Hub — Migration 20260509000002
-- Purpose:  Revoke INSERT/UPDATE/DELETE on member_audit_log from service_role
--           and supabase_admin. Migration 20260503063000 granted DELETE/INSERT/
--           UPDATE on ALL tables, which violated IMR-02 (audit log is immutable;
--           written only by the SECURITY DEFINER trigger).
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE ON public.member_audit_log FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.member_audit_log FROM supabase_admin;