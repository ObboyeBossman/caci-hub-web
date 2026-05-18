BEGIN;
-- Fix RLS leak in view
ALTER VIEW public.members_view SET (security_invoker = true);

-- Strict 403 Trigger for all roles
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

  -- Admin: No restrictions in trigger
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Secretary: Block pastoral_notes
  IF v_role = 'secretary' THEN
    IF OLD.pastoral_notes IS DISTINCT FROM NEW.pastoral_notes THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Pastor: Only allow pastoral_notes
  IF v_role = 'pastor' THEN
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
    RETURN NEW;
  END IF;

  -- Volunteer and Member: Block ALL updates to get 403
  IF v_role IN ('volunteer', 'member') THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
  END IF;

  -- Default deny (if any other role somehow calls it)
  RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
END;
$$;
COMMIT;
