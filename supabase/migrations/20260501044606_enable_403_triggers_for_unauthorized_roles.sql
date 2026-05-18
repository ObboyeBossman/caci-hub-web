BEGIN;
-- Dummy UPDATE policies for member and volunteer roles
-- These allow the row to be 'matched' for update so the BEFORE UPDATE trigger can fire and RAISE EXCEPTION (403)
CREATE POLICY members_update_member_role_trigger_allow
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'member'
    AND created_by = auth.uid()
  );

CREATE POLICY members_update_volunteer_role_trigger_allow
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'volunteer'
    AND assembly_id = public.get_user_assembly_id()
  );
COMMIT;
