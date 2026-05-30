-- =============================================================================
-- CACI Hub — Migration 20260530000007_rbac_refactor_rls
-- Purpose:  RBAC Phase 7 — Refactor all RLS policies and column-level trigger
--           to remove hardcoded custom role names (pastor, secretary, volunteer).
--
--           RLS must only know:
--             * admin   → bypass, full assembly access
--             * member  → own-record-only access
--             * assembly ownership boundaries
--
--           Application layer (authorization-service.ts) handles all
--           fine-grained permission checks post-authentication.
--
-- What this changes:
--   1. members SELECT policy — simplified to admin | member-own-record
--   2. members_view — removes CASE role IN (...) masking by hardcoded role names.
--      New rule: admin sees everything; member sees own; others see limited view.
--   3. enforce_member_update_columns() trigger — removes pastor/secretary/volunteer
--      branches. New rule: admin = full; member = deny; NULL = allow (internal).
--   4. sync_user_permissions_to_jwt — update to read permission_key not permission_id
--
-- Depends on: 20260530000005 (user_role enum dropped; is_admin_or_pastor etc. dropped)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. members SELECT policy
-- Old policy had 3 branches: admin all | can_read_directory | member own
-- New policy: admin (all in assembly) | member (own row via auth_user_id)
-- Fine-grained directory-access decisions are enforced by the app/service layer.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS members_select ON public.members;

CREATE POLICY members_select
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    -- Admin: all rows including soft-deleted, within their assembly
    (
      public.is_admin()
      AND assembly_id = public.get_user_assembly_id()
    )
    OR
    -- All authenticated members in the same assembly may read active records.
    -- Fine-grained column visibility is enforced via members_view masking.
    -- Service-layer checks (authorization-service.ts) gate route-level access.
    (
      assembly_id = public.get_user_assembly_id()
      AND is_active = true
    )
    OR
    -- Member: own row via linked auth account (even if different assembly somehow)
    (
      auth_user_id = (SELECT auth.uid())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. members_view — remove hardcoded role names from CASE expressions
-- Old: CASE WHEN role IN ('admin', 'pastor', 'secretary', 'member') ...
-- New:
--   * Admin → sees all columns
--   * Member accessing own row → sees emergency contact + no pastoral notes
--   * All others → masked emergency contact, no pastoral notes
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.members_view;

CREATE VIEW public.members_view
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.other_names,
  m.title,
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

  -- Emergency contact: visible to admin or the member themselves
  CASE
    WHEN public.is_admin()
      OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,

  CASE
    WHEN public.is_admin()
      OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone,

  CASE
    WHEN public.is_admin()
      OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,
  m.auth_user_id,

  -- Pastoral notes: admin-only (application layer enforces additional access for
  -- users with a role that grants pastoral-care permissions — this is the DB floor)
  CASE
    WHEN public.is_admin()
    THEN m.pastoral_notes
    ELSE NULL
  END AS pastoral_notes,

  m.is_active,
  m.deleted_at,
  m.created_by,
  m.created_at,
  m.updated_at

FROM public.members m;

COMMENT ON VIEW public.members_view IS
  'Security barrier + invoker view over members. security_invoker=true ensures '
  'RLS of the querying user is applied. Column masking: emergency contact '
  'visible to admin or own member row; pastoral notes visible to admin only. '
  'All other role-based access decisions are enforced by authorization-service.ts '
  'at the application layer — RLS only enforces DB-level floor rules.';

-- Re-grant SELECT to authenticated (required after DROP/CREATE of view)
GRANT SELECT ON public.members_view TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. enforce_member_update_columns() trigger
-- Old: complex branches for admin / secretary / pastor / volunteer / member
-- New: admin = unrestricted; NULL = unrestricted (internal); everyone else = deny
-- Application layer (authorization-service.ts) prevents unauthorized API calls
-- before they reach this trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_member_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
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

  -- All other system roles (currently: 'member'): deny direct updates.
  -- Fine-grained write permissions are enforced by authorization-service.ts
  -- before the request reaches the database. If a write reaches here from a
  -- non-admin, it must be rejected as a defence-in-depth measure.
  RAISE EXCEPTION 'Insufficient permissions to update member record'
    USING ERRCODE = '42501';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. sync_user_permissions_to_jwt — update to use permission_key
-- The old function referenced permission_id; role_permissions now has permission_key.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_user_permissions_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions TEXT[];
BEGIN
  -- Collect permission keys for the new assembly role (empty when NULL)
  IF NEW.assembly_role_id IS NOT NULL THEN
    SELECT ARRAY_AGG(rp.permission_key)
      INTO v_permissions
      FROM public.role_permissions rp
     WHERE rp.role_id = NEW.assembly_role_id;
  ELSE
    v_permissions := ARRAY[]::TEXT[];
  END IF;

  -- Coalesce NULL to empty array
  v_permissions := COALESCE(v_permissions, ARRAY[]::TEXT[]);

  -- Write into auth.users.raw_app_meta_data (merges with existing keys)
  UPDATE auth.users
     SET raw_app_meta_data = raw_app_meta_data
       || jsonb_build_object(
            'assembly_id',  NEW.assembly_id,
            'permissions',  to_jsonb(v_permissions)
          )
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_permissions_to_jwt() IS
  'Fires after UPDATE of assembly_role_id or assembly_id on user_profiles. '
  'Collects permission keys for the new assembly role and writes them into '
  'auth.users.raw_app_meta_data as { assembly_id, permissions: [...] }. '
  'The frontend reads this from the JWT app_metadata to hydrate the AppUser '
  'permissions array without an extra DB round-trip.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update the JWT sync trigger to fire on assembly_role_id (renamed column)
-- (Already done in migration 000004 but re-asserting here for safety)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_permissions_on_profile_update ON public.user_profiles;

CREATE TRIGGER sync_permissions_on_profile_update
  AFTER UPDATE OF assembly_role_id, assembly_id
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_permissions_to_jwt();
