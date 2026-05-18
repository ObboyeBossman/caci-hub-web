CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auditable_columns TEXT[] := ARRAY[
    'first_name', 'last_name', 'phone_number', 'email',
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
