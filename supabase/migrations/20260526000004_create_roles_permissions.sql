-- Migration: 20260526000004_create_roles_permissions
-- Adds the multi-tenant custom roles & permissions layer.
--
-- What this does NOT touch:
--   - user_profiles.role (the existing user_role enum) — still powers all RLS helpers
--   - Any existing RLS policy
--
-- New tables: permissions, assembly_roles, role_permissions
-- New column:  user_profiles.role_id (nullable FK → assembly_roles)
-- New trigger: sync_user_permissions_to_jwt — fires on user_profiles UPDATE

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: System permissions catalogue
-- Only the developer inserts rows; no API writes allowed (enforced by RLS).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id          TEXT PRIMARY KEY,        -- e.g. 'member:invite'
  description TEXT
);

-- Seed the initial permission set
INSERT INTO public.permissions (id, description) VALUES
  ('member:invite',     'Provision new user accounts'),
  ('member:view_all',   'View full member directory'),
  ('member:edit',       'Create and update member records'),
  ('financials:view',   'View tithing and financial history'),
  ('financials:write',  'Log tithes, offerings, and expenses'),
  ('attendance:mark',   'Record service and event attendance'),
  ('sermon:edit',       'Create, edit, or delete sermons')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Assembly-scoped custom roles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assembly_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  UUID NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assembly_id, name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Role ↔ Permission junction
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.assembly_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id)    ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Add role_id FK to user_profiles
-- Sits alongside the existing `role` enum column — no existing policies break.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role_id UUID
    REFERENCES public.assembly_roles(id)
    ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: JWT sync
--
-- When a user's role_id or assembly_id changes, collect all permission_ids
-- for that role and write them (plus assembly_id) into auth.users.raw_app_meta_data.
--
-- Result inside the JWT app_metadata:
--   { "assembly_id": "<uuid>", "permissions": ["member:invite", "financials:view"] }
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function (SECURITY DEFINER so it can write auth.users)
CREATE OR REPLACE FUNCTION public.sync_user_permissions_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions TEXT[];
BEGIN
  -- Collect permission IDs for the new role (empty array when role_id IS NULL)
  IF NEW.role_id IS NOT NULL THEN
    SELECT ARRAY_AGG(rp.permission_id)
      INTO v_permissions
      FROM public.role_permissions rp
     WHERE rp.role_id = NEW.role_id;
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

-- Drop old trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS sync_permissions_on_profile_update ON public.user_profiles;

-- Fire after UPDATE of role_id or assembly_id
CREATE TRIGGER sync_permissions_on_profile_update
  AFTER UPDATE OF role_id, assembly_id
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_permissions_to_jwt();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- permissions: anyone authenticated can SELECT; no API write access
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

-- assembly_roles: scoped to the user's own assembly; mutations restricted to admin
ALTER TABLE public.assembly_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assembly_roles_select"
  ON public.assembly_roles FOR SELECT
  TO authenticated
  USING (assembly_id = public.get_user_assembly_id());

CREATE POLICY "assembly_roles_insert"
  ON public.assembly_roles FOR INSERT
  TO authenticated
  WITH CHECK (assembly_id = public.get_user_assembly_id() AND public.is_admin());

CREATE POLICY "assembly_roles_update"
  ON public.assembly_roles FOR UPDATE
  TO authenticated
  USING (assembly_id = public.get_user_assembly_id() AND public.is_admin());

CREATE POLICY "assembly_roles_delete"
  ON public.assembly_roles FOR DELETE
  TO authenticated
  USING (assembly_id = public.get_user_assembly_id() AND public.is_admin());

-- role_permissions: scoped via join to assembly_roles; mutations restricted to admin
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
       WHERE ar.id = role_id
         AND ar.assembly_id = public.get_user_assembly_id()
    )
  );

CREATE POLICY "role_permissions_insert"
  ON public.role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
       WHERE ar.id = role_id
         AND ar.assembly_id = public.get_user_assembly_id()
    )
  );

CREATE POLICY "role_permissions_delete"
  ON public.role_permissions FOR DELETE
  TO authenticated
  USING (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.assembly_roles ar
       WHERE ar.id = role_id
         AND ar.assembly_id = public.get_user_assembly_id()
    )
  );
