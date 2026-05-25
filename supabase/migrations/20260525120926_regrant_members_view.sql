-- =============================================================================
-- CACI Hub — Migration 20260525120926
-- Purpose:  Re-grant SELECT on members_view to authenticated and service_role.
--           The previous migration (20260525064305) used DROP VIEW which wiped
--           all grants on the view. This restores access.
-- =============================================================================

GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;
