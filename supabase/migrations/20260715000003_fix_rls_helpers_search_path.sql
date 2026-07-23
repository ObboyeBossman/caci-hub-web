-- =============================================================================
-- Migration: fix_rls_helpers_search_path
--
-- Ensures RLS helper functions have a secure and explicit search_path.
-- This prevents potential failures when these functions are called
-- from different schemas or contexts.
-- =============================================================================

-- ── 1. Fix is_admin() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.user_profiles
    WHERE  id        = auth.uid()
    AND    role      = 'admin'
    AND    is_active = true
  )
$$;

-- ── 2. Fix has_permission() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_permission(permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.member_permissions mp
    JOIN   public.members m ON m.id = mp.member_id
    WHERE  m.auth_user_id = auth.uid()
    AND    mp.permission  = $1
  )
$$;
