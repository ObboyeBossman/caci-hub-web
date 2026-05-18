-- =============================================================================
-- CACI Hub — Migration 20260429000001
-- Purpose: Grant SELECT permissions on members_view and households
-- =============================================================================

-- Grant access to the view for authenticated app users
GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;

-- Ensure authenticated users can also select from households for filters
GRANT SELECT ON public.households TO authenticated;
GRANT SELECT ON public.households TO service_role;

-- RLS policies on underlying tables will still enforce assembly-scoping.
