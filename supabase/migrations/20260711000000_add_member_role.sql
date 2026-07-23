-- =============================================================================
-- Migration: add_member_role
-- Adds a free-text `assembly_role` column to the members table.
--
-- This is a member's ministry/service role within the assembly
-- (e.g. "Usher", "Pastor", "Choir Member", "Elder", "Youth Leader").
--
-- Design decisions:
--   • Free text — not an enum. Roles are informal and assembly-specific.
--   • Named `assembly_role` to avoid colliding with `user_profiles.role`
--     which is a system/auth concern (admin vs member).
--   • Nullable — most members have no formal role label.
--   • Writable by anyone with members.write permission (same RLS as
--     other member fields — no new policy needed).
--   • Audited — added to the write_member_audit_log trigger field list.
-- =============================================================================

ALTER TABLE public.members
  ADD COLUMN assembly_role text DEFAULT NULL;

COMMENT ON COLUMN public.members.assembly_role IS
  'Free-text ministry/service role within the assembly. '
  'e.g. "Usher", "Pastor", "Elder", "Choir Member", "Youth Leader". '
  'Set by admin or any user with members.write. '
  'Entirely separate from user_profiles.role (which controls system access).';


-- =============================================================================
-- Update audit trigger to track assembly_role changes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_field   text;
  v_old_val text;
  v_new_val text;
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'full_name',
    'title',
    'date_of_birth',
    'gender',
    'marital_status',
    'occupation',
    'location',
    'phone_number',
    'whatsapp_number',
    'membership_status',
    'join_date',
    'is_active',
    'assembly_role',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_relationship'
  ]
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_old_val, v_new_val
      USING OLD, NEW;

    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO public.member_audit_log (
        member_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id, auth.uid(), v_field, v_old_val, v_new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
