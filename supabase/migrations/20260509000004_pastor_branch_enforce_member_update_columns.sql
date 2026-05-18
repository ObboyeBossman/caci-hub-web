-- =============================================================================
-- CACI Hub — Migration 20260509000004
-- Purpose:  Fix the Pastor branch in enforce_member_update_columns.
--           The previous implementation used an incomplete deny-list —
--           fields like email, physical_address, marital_status, household_id,
--           is_active, deleted_at, profile_photo_url etc. were not checked,
--           so a Pastor could update them directly via the API.
--           Replaced with an allow-list: only pastoral_notes may change.
-- =============================================================================

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

  -- Allow internal system calls (triggers, migrations, service role).
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin: unrestricted.
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Secretary: may update any field EXCEPT pastoral_notes.
  IF v_role = 'secretary' THEN
    IF OLD.pastoral_notes IS DISTINCT FROM NEW.pastoral_notes THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Pastor: allow-list — ONLY pastoral_notes may change.
  -- Any other column change is rejected.
  IF v_role = 'pastor' THEN
    IF OLD.first_name                    IS DISTINCT FROM NEW.first_name OR
       OLD.last_name                     IS DISTINCT FROM NEW.last_name OR
       OLD.date_of_birth                 IS DISTINCT FROM NEW.date_of_birth OR
       OLD.gender                        IS DISTINCT FROM NEW.gender OR
       OLD.marital_status                IS DISTINCT FROM NEW.marital_status OR
       OLD.phone_number                  IS DISTINCT FROM NEW.phone_number OR
       OLD.email                         IS DISTINCT FROM NEW.email OR
       OLD.physical_address              IS DISTINCT FROM NEW.physical_address OR
       OLD.occupation                    IS DISTINCT FROM NEW.occupation OR
       OLD.facebook_url                  IS DISTINCT FROM NEW.facebook_url OR
       OLD.whatsapp_number               IS DISTINCT FROM NEW.whatsapp_number OR
       OLD.instagram_url                 IS DISTINCT FROM NEW.instagram_url OR
       OLD.emergency_contact_name        IS DISTINCT FROM NEW.emergency_contact_name OR
       OLD.emergency_contact_phone       IS DISTINCT FROM NEW.emergency_contact_phone OR
       OLD.emergency_contact_relationship IS DISTINCT FROM NEW.emergency_contact_relationship OR
       OLD.membership_status             IS DISTINCT FROM NEW.membership_status OR
       OLD.join_date                     IS DISTINCT FROM NEW.join_date OR
       OLD.household_id                  IS DISTINCT FROM NEW.household_id OR
       OLD.profile_photo_url             IS DISTINCT FROM NEW.profile_photo_url OR
       OLD.is_active                     IS DISTINCT FROM NEW.is_active OR
       OLD.deleted_at                    IS DISTINCT FROM NEW.deleted_at OR
       OLD.assembly_id                   IS DISTINCT FROM NEW.assembly_id OR
       OLD.membership_number             IS DISTINCT FROM NEW.membership_number OR
       OLD.auth_user_id                  IS DISTINCT FROM NEW.auth_user_id
    THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Volunteer and Member: block all updates.
  IF v_role IN ('volunteer', 'member') THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
      USING ERRCODE = '42501';
  END IF;

  -- Default deny for any future role not yet handled.
  RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
    USING ERRCODE = '42501';
END;
$$;
