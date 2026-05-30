-- =============================================================================
-- Migration: 20260529000002_create_clear_must_change_password_fn.sql
-- Description: Create a SECURITY DEFINER function so users can clear their own
--              must_change_password flag. Direct updates to user_profiles are
--              blocked by RLS (only admins can UPDATE user_profiles).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
     SET must_change_password = false
   WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.clear_must_change_password() IS
  'Allows an authenticated user to clear their own must_change_password flag '
  'after successfully updating their password. Bypasses user_profiles RLS.';
