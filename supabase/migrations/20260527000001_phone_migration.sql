-- =============================================================================
-- Migration: 20260527000001_phone_migration.sql
-- Description: Add phone to user_profiles, rename phone_number to primary_phone,
--              add secondary_phone to members, and update views/triggers.
-- =============================================================================

-- 1. Track phone on user profiles for authentication
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. Drop dependent views and functions
DROP VIEW IF EXISTS public.members_view;
DROP FUNCTION IF EXISTS public.get_available_primary_contacts(UUID, TEXT, UUID);

-- 3. Rename and add columns in members
ALTER TABLE public.members RENAME COLUMN phone_number TO primary_phone;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS secondary_phone text;

-- 4. Recreate members_view with other_names, primary_phone, and secondary_phone
CREATE VIEW public.members_view
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.other_names,
  m.date_of_birth,
  m.gender,
  m.marital_status,
  m.primary_phone,
  m.secondary_phone,
  m.email,
  m.physical_address,
  m.occupation,
  m.facebook_url,
  m.whatsapp_number,
  m.instagram_url,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor')
    THEN m.pastoral_notes
    ELSE NULL
  END AS pastoral_notes,

  m.is_active,
  m.deleted_at,
  m.created_by,
  m.created_at,
  m.updated_at,
  m.auth_user_id

FROM public.members m;

COMMENT ON VIEW public.members_view IS
  'Security barrier view over members. Handles column-level masking of emergency_contact_* and pastoral_notes.';

GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;

-- 5. Recreate get_available_primary_contacts
CREATE OR REPLACE FUNCTION public.get_available_primary_contacts(
  p_assembly_id UUID, 
  p_search TEXT, 
  p_current_household_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT, primary_phone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.first_name, m.last_name, m.primary_phone
  FROM public.members_view m
  WHERE m.assembly_id = p_assembly_id
    AND m.is_active = true
    AND (
      p_search IS NULL 
      OR p_search = '' 
      OR m.first_name ILIKE '%' || p_search || '%' 
      OR m.last_name ILIKE '%' || p_search || '%'
    )
    AND NOT EXISTS (
       SELECT 1 FROM public.households h 
       WHERE h.primary_contact_id = m.id 
         AND (p_current_household_id IS NULL OR h.id != p_current_household_id)
    )
  ORDER BY m.last_name, m.first_name;
END;
$$;

-- 6. Update write_member_audit_log
CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auditable_columns TEXT[] := ARRAY[
    'first_name', 'last_name', 'other_names', 'primary_phone', 'secondary_phone', 'email',
    'occupation', 'physical_address', 'facebook_url',
    'whatsapp_number', 'instagram_url',
    'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relationship',
    'membership_status', 'gender', 'marital_status',
    'household_id', 'profile_photo_url', 'pastoral_notes',
    'is_active', 'deleted_at', 'join_date'
  ];
  col_name  TEXT;
  old_val   TEXT;
  new_val   TEXT;
BEGIN
  FOREACH col_name IN ARRAY auditable_columns LOOP
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.member_audit_log (
        member_id, assembly_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id,
        NEW.assembly_id,
        auth.uid(),
        col_name,
        old_val,
        new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 7. Update enforce_member_update_columns
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

  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF v_role = 'secretary' THEN
    IF OLD.pastoral_notes IS DISTINCT FROM NEW.pastoral_notes THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_role = 'pastor' THEN
    IF OLD.first_name                    IS DISTINCT FROM NEW.first_name OR
       OLD.last_name                     IS DISTINCT FROM NEW.last_name OR
       OLD.other_names                   IS DISTINCT FROM NEW.other_names OR
       OLD.date_of_birth                 IS DISTINCT FROM NEW.date_of_birth OR
       OLD.gender                        IS DISTINCT FROM NEW.gender OR
       OLD.marital_status                IS DISTINCT FROM NEW.marital_status OR
       OLD.primary_phone                 IS DISTINCT FROM NEW.primary_phone OR
       OLD.secondary_phone               IS DISTINCT FROM NEW.secondary_phone OR
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

  IF v_role IN ('volunteer', 'member') THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
      USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION 'new row violates row-level security policy for table "members"'
    USING ERRCODE = '42501';
END;
$$;
