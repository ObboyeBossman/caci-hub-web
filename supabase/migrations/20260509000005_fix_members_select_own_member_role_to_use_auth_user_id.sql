-- =============================================================================
-- CACI Hub — Migration 20260509000005
-- Purpose:  Replace the Phase 1 members_select_own_member_role policy.
--           The old policy used created_by = auth.uid() as a workaround
--           because members.auth_user_id did not exist yet. Now that
--           auth_user_id is in place (Migration 20260502100000), members
--           can be correctly identified by their linked Auth account.
-- =============================================================================

DROP POLICY IF EXISTS members_select_own_member_role ON public.members;

CREATE POLICY members_select_own_member_role
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'member'
    AND auth_user_id = auth.uid()
  );