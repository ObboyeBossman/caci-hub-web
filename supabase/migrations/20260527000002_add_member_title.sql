-- =============================================================================
-- Migration: 20260527000002_add_member_title.sql
-- Description: Add an optional `title` column to public.members with a CHECK
--              constraint, propagate through members_view, and track in the
--              audit trigger.
-- =============================================================================

-- 1. Add column
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS title TEXT
    CHECK (title IN (
      'Mr.','Mrs.','Ms.','Miss',
      'Dr.','Prof.',
      'Rev.','Pastor','Elder','Deacon','Deaconess',
      'Apostle','Bishop'
    ));

-- 2. Drop dependent view before recreating
DROP VIEW IF EXISTS public.members_view;

-- 3. Recreate members_view (includes title, security_barrier only — invoker was
--    set in migration 20260526000007; this migration re-applies the same flags)
CREATE VIEW public.members_view
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.title,
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
  'Security barrier + invoker view over members. Includes title field added in '
  'migration 20260527000002. Handles column-level masking of emergency_contact_* '
  'and pastoral_notes.';

GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;

-- 4. Update write_member_audit_log to track title changes
CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auditable_columns TEXT[] := ARRAY[
    'title',
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
