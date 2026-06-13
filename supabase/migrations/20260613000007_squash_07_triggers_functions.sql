-- =============================================================================
-- CACI Hub — Squashed Migration 07: Business Logic Triggers & Functions
-- Final state of all trigger functions (except set_updated_at in migration 02).
--
-- Includes:
--   1. write_member_audit_log()         — field-level audit on members UPDATE
--   2. enforce_member_update_columns()  — column-level write guard
--   3. link_household_primary_contact() — auto-link member to household on contact set
--   4. sync_user_permissions_to_jwt()   — writes permissions into JWT app_metadata
--   5. log_service_changes()            — audit trigger for services table
--   6. assign_membership_number()       — atomic sequence function (not a trigger)
--   7. clear_must_change_password()     — user self-service helper
--   8. admin_reset_user_password()      — service-role-only password reset
-- =============================================================================


-- ── 1. write_member_audit_log ─────────────────────────────────────────────────
-- AFTER UPDATE on members. Inserts one member_audit_log row per changed field.
-- Final column list includes title, other_names, primary_phone, secondary_phone
-- (all column renames/additions are resolved here).

CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auditable_columns TEXT[] := ARRAY[
    'title', 'first_name', 'last_name', 'other_names',
    'primary_phone', 'secondary_phone', 'email',
    'occupation', 'physical_address',
    'facebook_url', 'whatsapp_number', 'instagram_url',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    'membership_status', 'gender', 'marital_status',
    'household_id', 'profile_photo_url', 'pastoral_notes',
    'is_active', 'deleted_at', 'join_date'
  ];
  col_name text;
  old_val  text;
  new_val  text;
BEGIN
  FOREACH col_name IN ARRAY auditable_columns LOOP
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.member_audit_log (
        member_id, assembly_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id, NEW.assembly_id, auth.uid(), col_name, old_val, new_val
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.write_member_audit_log() IS
  'AFTER UPDATE trigger on members. Inserts one audit row per changed field. '
  'SECURITY DEFINER to bypass the absence of an INSERT policy on member_audit_log (IMR-02).';

CREATE TRIGGER trg_members_audit_log
  AFTER UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.write_member_audit_log();


-- ── 2. enforce_member_update_columns ─────────────────────────────────────────
-- BEFORE UPDATE on members.
-- Post-RBAC final state: admin = unrestricted; NULL role = unrestricted (internal);
-- all other system roles denied. Application layer prevents unauthorised calls
-- before they reach the DB (defence-in-depth).

CREATE OR REPLACE FUNCTION public.enforce_member_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();

  -- Allow internal system calls (triggers, migrations, service_role).
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin: unrestricted.
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- All other roles: deny. Application layer must gate before reaching here.
  RAISE EXCEPTION 'Insufficient permissions to update member record'
    USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.enforce_member_update_columns() IS
  'BEFORE UPDATE trigger on members. Admin = unrestricted. NULL role = internal (allowed). '
  'All other roles raise 42501. Application layer (authorization-service) gates calls first.';

CREATE TRIGGER trg_enforce_member_update_columns
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_update_columns();


-- ── 3. link_household_primary_contact ────────────────────────────────────────
-- AFTER INSERT OR UPDATE OF primary_contact_id on households.
-- Auto-sets the primary contact's household_id to this household.

CREATE OR REPLACE FUNCTION public.link_household_primary_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_contact_id IS NOT NULL THEN
    UPDATE public.members
    SET household_id = NEW.id
    WHERE id = NEW.primary_contact_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_household_primary_contact() IS
  'AFTER INSERT OR UPDATE OF primary_contact_id on households. '
  'Automatically sets the linked member''s household_id to this household.';

CREATE TRIGGER trg_link_household_primary_contact
  AFTER INSERT OR UPDATE OF primary_contact_id ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.link_household_primary_contact();


-- ── 4. sync_user_permissions_to_jwt ──────────────────────────────────────────
-- AFTER UPDATE OF assembly_role_id, assembly_id on user_profiles.
-- Writes permissions + assembly_id into auth.users.raw_app_meta_data.

CREATE OR REPLACE FUNCTION public.sync_user_permissions_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions TEXT[];
BEGIN
  IF NEW.assembly_role_id IS NOT NULL THEN
    SELECT ARRAY_AGG(rp.permission_key)
      INTO v_permissions
      FROM public.role_permissions rp
     WHERE rp.role_id = NEW.assembly_role_id;
  ELSE
    v_permissions := ARRAY[]::TEXT[];
  END IF;

  v_permissions := COALESCE(v_permissions, ARRAY[]::TEXT[]);

  UPDATE auth.users
     SET raw_app_meta_data = raw_app_meta_data
       || jsonb_build_object(
            'assembly_id', NEW.assembly_id,
            'permissions', to_jsonb(v_permissions)
          )
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_permissions_to_jwt() IS
  'Fires after UPDATE of assembly_role_id or assembly_id on user_profiles. '
  'Collects permission keys and writes { assembly_id, permissions: [...] } '
  'into auth.users.raw_app_meta_data for JWT hydration.';

CREATE TRIGGER sync_permissions_on_profile_update
  AFTER UPDATE OF assembly_role_id, assembly_id
  ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_permissions_to_jwt();


-- ── 5. log_service_changes ────────────────────────────────────────────────────
-- AFTER UPDATE on services. Same pattern as write_member_audit_log.

CREATE OR REPLACE FUNCTION public.log_service_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col     text;
  old_val text;
  new_val text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'title', 'status', 'service_date',
    'start_time', 'venue', 'headcount',
    'notes', 'group_id', 'deleted_at'
  ] LOOP
    EXECUTE format('SELECT ($1).%I::text', col) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', col) INTO new_val USING NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.service_audit_log (
        service_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id, auth.uid(), col, old_val, new_val
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_audit
  AFTER UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.log_service_changes();


-- ── 6. assign_membership_number ───────────────────────────────────────────────
-- Atomic: locks assembly row → finds max sequence → assigns.
-- Idempotent: returns early if member already has a number.
-- Called by Edge Functions and the generate-membership-number function.

CREATE OR REPLACE FUNCTION public.assign_membership_number(
  p_member_id  uuid,
  p_assembly_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assembly_code    text;
  v_max_seq          integer;
  v_new_seq          integer;
  v_membership_number text;
  v_existing_number  text;
BEGIN
  -- Idempotency: return immediately if already assigned.
  SELECT membership_number INTO v_existing_number
  FROM public.members WHERE id = p_member_id;

  IF v_existing_number IS NOT NULL THEN
    RETURN v_existing_number;
  END IF;

  -- Lock the assembly row to queue concurrent calls.
  SELECT assembly_code INTO v_assembly_code
  FROM public.assemblies
  WHERE id = p_assembly_id
  FOR UPDATE;

  IF v_assembly_code IS NULL THEN
    RAISE EXCEPTION 'Assembly not found or could not be locked';
  END IF;

  -- Find the current maximum sequence number (includes soft-deleted rows
  -- to prevent sequence reuse).
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(membership_number FROM '-([0-9]+)$') AS integer)),
    0
  )
  INTO v_max_seq
  FROM public.members
  WHERE assembly_id = p_assembly_id
    AND membership_number IS NOT NULL
    AND membership_number LIKE ('CACI-' || v_assembly_code || '-%');

  v_new_seq := v_max_seq + 1;
  v_membership_number := 'CACI-' || v_assembly_code || '-' || LPAD(v_new_seq::text, 5, '0');

  UPDATE public.members
  SET membership_number = v_membership_number
  WHERE id = p_member_id;

  RETURN v_membership_number;
END;
$$;

COMMENT ON FUNCTION public.assign_membership_number(uuid, uuid) IS
  'Atomically generates and assigns a membership number. Idempotent — returns '
  'existing number if already set. Locks assembly row to prevent race conditions.';

GRANT EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.assign_membership_number(uuid, uuid) TO authenticated;


-- ── 7. get_available_primary_contacts ────────────────────────────────────────
-- RPC: returns members eligible to be set as a household primary contact.

CREATE OR REPLACE FUNCTION public.get_available_primary_contacts(
  p_assembly_id       uuid,
  p_search            text,
  p_current_household_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, first_name text, last_name text, primary_phone text)
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
      p_search IS NULL OR p_search = ''
      OR m.first_name ILIKE '%' || p_search || '%'
      OR m.last_name  ILIKE '%' || p_search || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.primary_contact_id = m.id
        AND (p_current_household_id IS NULL OR h.id != p_current_household_id)
    )
  ORDER BY m.last_name, m.first_name;
END;
$$;

COMMENT ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) IS
  'Returns assembly members eligible to be set as a household primary contact, '
  'excluding members already serving as a primary contact for another household.';

REVOKE EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_available_primary_contacts(uuid, text, uuid) TO authenticated;


-- ── 8. clear_must_change_password ────────────────────────────────────────────
-- SECURITY DEFINER: allows users to clear their own must_change_password flag.

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET must_change_password = false
  WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.clear_must_change_password() IS
  'Allows an authenticated user to clear their own must_change_password flag '
  'after successfully updating their password. Bypasses user_profiles RLS.';


-- ── 9. admin_reset_user_password ─────────────────────────────────────────────
-- Service-role-only: bypasses gotrue Admin API bug for phone-only accounts.

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_user_id  uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
    updated_at         = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in auth.users', p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM authenticated;
-- service_role retains EXECUTE via its superuser-like privileges.

COMMENT ON FUNCTION public.admin_reset_user_password(uuid, text) IS
  'Service-role-only. Resets an auth.users password directly via bcrypt, '
  'bypassing the gotrue Admin API bug affecting phone-only provisioned accounts.';


-- ── 10. increment_storage_usage ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_storage_usage(
  p_assembly_id uuid,
  p_bytes       int8
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.assembly_storage_usage (assembly_id, snapshot_month, supabase_bytes)
  VALUES (p_assembly_id, v_month, p_bytes)
  ON CONFLICT (assembly_id, snapshot_month)
  DO UPDATE SET supabase_bytes = public.assembly_storage_usage.supabase_bytes + p_bytes;
END;
$$;
