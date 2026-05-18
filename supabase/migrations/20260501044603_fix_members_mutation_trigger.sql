BEGIN;
DROP POLICY IF EXISTS members_update_pastoral_notes ON public.members;
CREATE POLICY members_update_pastoral_notes
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'pastor'::public.user_role
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  )
  WITH CHECK (
    public.get_user_role() = 'pastor'::public.user_role
    AND assembly_id = public.get_user_assembly_id()
  );

CREATE OR REPLACE FUNCTION public.enforce_member_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := public.get_user_role();

  IF v_role = 'secretary' THEN
    IF OLD.pastoral_notes IS DISTINCT FROM NEW.pastoral_notes THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'pastor' THEN
    -- Check if ANY column other than pastoral_notes changed
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR
       OLD.last_name IS DISTINCT FROM NEW.last_name OR
       OLD.occupation IS DISTINCT FROM NEW.occupation OR
       OLD.gender IS DISTINCT FROM NEW.gender OR
       OLD.membership_status IS DISTINCT FROM NEW.membership_status OR
       OLD.assembly_id IS DISTINCT FROM NEW.assembly_id OR
       OLD.phone_number IS DISTINCT FROM NEW.phone_number
    THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_update_columns on public.members;
CREATE TRIGGER trg_enforce_member_update_columns
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_member_update_columns();
COMMIT;
