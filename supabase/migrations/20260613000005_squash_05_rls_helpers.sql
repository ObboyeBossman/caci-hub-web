-- =============================================================================
-- CACI Hub — Squashed Migration 05: RLS Helper Functions
-- Final state of all helper functions used by RLS policies and application
-- code, after all RBAC refactoring migrations.
--
-- Key changes from original:
--   - get_user_role() returns TEXT (not user_role enum — enum was dropped)
--   - is_admin_or_pastor(), is_admin_or_secretary(), can_read_directory() DROPPED
--   - is_member() added
--   - auth_assembly_id() added (SECURITY DEFINER — fixed in 20260612000004)
--   - auth_has_permission(), auth_member_id(), auth_is_thread_participant(),
--     auth_is_participant_of_thread() added for Communications module
-- =============================================================================


-- ── get_user_role() ───────────────────────────────────────────────────────────
-- Returns 'admin' | 'member' | NULL.
-- NULL means no active profile → user sees nothing.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS
  'Returns the system role (admin | member) of the authenticated user. '
  'Returns NULL if no active user_profiles row exists. '
  'SECURITY DEFINER prevents RLS recursion on user_profiles.';


-- ── get_user_assembly_id() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_assembly_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assembly_id
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_assembly_id() IS
  'Returns the assembly_id of the authenticated user. '
  'Returns NULL if no active profile → all assembly-scoped RLS clauses evaluate to false. '
  'SECURITY DEFINER prevents RLS recursion. Primary enforcement of IMR-04.';


-- ── is_admin() ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true iff the current user is an active admin. '
  'Returns false (not NULL) for unauthenticated or inactive users.';


-- ── is_member() ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'member'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_member() IS
  'Returns true iff the current user is an active member (non-admin system role). '
  'RLS uses only is_admin() and is_member() for assembly isolation. '
  'Fine-grained permission checks happen at the application layer.';


-- ── auth_assembly_id() ────────────────────────────────────────────────────────
-- Alias for get_user_assembly_id() — used by module RLS policies (groups,
-- pastoral, services, finance, communication). SECURITY DEFINER required
-- to prevent RLS recursion (fixed in 20260612000004).

CREATE OR REPLACE FUNCTION public.auth_assembly_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assembly_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_assembly_id() IS
  'Returns the assembly_id for the authenticated user. '
  'SECURITY DEFINER prevents RLS recursion when called from other table RLS policies. '
  'Used by module-level policies (groups, pastoral, services, finance, communication).';


-- ── auth_member_id() ──────────────────────────────────────────────────────────
-- Returns the members.id for the currently authenticated user.
-- Used by Communication module RLS to scope messages/threads to member records.

CREATE OR REPLACE FUNCTION public.auth_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.members
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_member_id() IS
  'Returns the members.id for the authenticated user via auth_user_id link. '
  'NULL if no active member record is linked. Used by Communication RLS policies.';


-- ── auth_has_permission() ─────────────────────────────────────────────────────
-- Checks whether the authenticated user holds a given permission key via their
-- assembly_role assignment.

CREATE OR REPLACE FUNCTION public.auth_has_permission(perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.assembly_roles ar   ON ar.id = up.assembly_role_id
    JOIN public.role_permissions rp ON rp.role_id = ar.id
    WHERE up.id = auth.uid()
      AND rp.permission_key = perm_key
      AND ar.is_active = true
      AND up.is_active = true
  );
$$;

COMMENT ON FUNCTION public.auth_has_permission(text) IS
  'Returns true if the authenticated user''s assembly role includes the given '
  'permission key. Used by module RLS policies for fine-grained access control.';


-- ── has_finance_permission() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_finance_permission(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.assembly_roles ar
      ON ar.id = (SELECT assembly_role_id FROM public.user_profiles WHERE id = auth.uid())
    JOIN public.system_permissions sp ON sp.id = rp.permission_key
    WHERE sp.key = perm
      AND ar.assembly_id = public.auth_assembly_id()
  );
$$;

COMMENT ON FUNCTION public.has_finance_permission(text) IS
  'Returns true if the current user''s assembly role includes the given finance permission. '
  'Used by Finance module RLS policies.';


-- ── has_pastoral_permission() ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_pastoral_permission(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.assembly_roles ar
      ON ar.id = (SELECT assembly_role_id FROM public.user_profiles WHERE id = auth.uid())
    JOIN public.system_permissions sp ON sp.id = rp.permission_key
    WHERE sp.key = perm
      AND ar.assembly_id = public.auth_assembly_id()
  );
$$;

COMMENT ON FUNCTION public.has_pastoral_permission(text) IS
  'Returns true if the current user''s assembly role includes the given pastoral permission. '
  'Used by Pastoral Care module RLS policies.';


-- ── auth_is_thread_participant() ──────────────────────────────────────────────
-- SECURITY DEFINER to break the recursive cycle between communication_threads
-- and communication_thread_participants RLS policies.

CREATE OR REPLACE FUNCTION public.auth_is_thread_participant(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_thread_participants
    WHERE thread_id = p_thread_id
      AND member_id = public.auth_member_id()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.auth_is_thread_participant(uuid) IS
  'Returns true if the current member is an active participant of the given thread. '
  'SECURITY DEFINER breaks the RLS recursion cycle between threads and participants.';


-- ── auth_is_participant_of_thread() ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_is_participant_of_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communication_thread_participants
    WHERE thread_id = p_thread_id
      AND member_id = public.auth_member_id()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.auth_is_participant_of_thread(uuid) IS
  'Used by communication_thread_participants SELECT policy. '
  'SECURITY DEFINER breaks the RLS recursion cycle.';
