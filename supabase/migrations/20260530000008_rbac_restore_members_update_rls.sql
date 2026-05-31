-- =============================================================================
-- CACI Hub — Migration 20260530000008_rbac_restore_members_update_rls
-- Purpose: Restore members UPDATE RLS policies that were dropped cascade
--          when is_admin_or_secretary() was dropped in the earlier RBAC refactor.
-- =============================================================================

-- Restoring UPDATE policy for members
-- In the new RBAC model, 'admin' system-role users bypass fine-grained checks
-- at the DB trigger level. We must allow them through RLS first.

DROP POLICY IF EXISTS members_update_admin ON public.members;
CREATE POLICY members_update_admin
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  )
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- Note: The enforce_member_update_columns trigger already blocks non-admin user
-- system roles from doing direct updates to this table (defence-in-depth), so
-- we only need an admin policy here.

-- We also need to restore INSERT policies because those relied on is_admin_or_secretary too!
DROP POLICY IF EXISTS members_insert_admin ON public.members;
CREATE POLICY members_insert_admin
  ON public.members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

