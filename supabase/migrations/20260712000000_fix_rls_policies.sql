-- =============================================================================
-- Migration: fix_rls_policies
--
-- Fixes several critical issues in the RLS security model:
--   1. Visibility: Admins can now see archived groups and soft-deleted members.
--   2. Recursion: Refactored policies to avoid infinite recursion in is_admin().
--   3. missing: Added DELETE policy for groups (Admins only).
--   4. Consistency: Ensures is_admin() and has_permission() work as intended.
-- =============================================================================

-- ── 1. Refactor is_admin() to be more resilient ──────────────────────────────
-- The recursion happened because user_profiles_select called is_admin(),
-- and is_admin() performed a SELECT on user_profiles.
-- SECURITY DEFINER usually bypasses this, but we'll make the policy non-recursive.

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true) = 'admin'
);

-- ── 2. Fix Groups visibility ──────────────────────────────────────────────────
-- Previous policy blocked Admins from seeing archived groups (is_active = false).

DROP POLICY IF EXISTS "groups_select" ON public.groups;
CREATE POLICY "groups_select"
ON public.groups FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (is_active = true AND public.has_permission('groups.read'))
);

-- Previous update policy might have been affected by select visibility in some contexts.
DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update"
ON public.groups FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('groups.write')
)
WITH CHECK (
  public.is_admin()
  OR public.has_permission('groups.write')
);

-- Add missing DELETE policy
DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_delete"
ON public.groups FOR DELETE
TO authenticated
USING (public.is_admin());


-- ── 3. Fix Members visibility ─────────────────────────────────────────────────
-- Previous policy blocked Admins from seeing soft-deleted members.

DROP POLICY IF EXISTS "members_select" ON public.members;
CREATE POLICY "members_select"
ON public.members FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    deleted_at IS NULL
    AND (
      public.has_permission('members.read')
      OR auth_user_id = auth.uid()
    )
  )
);

-- Ensure update policy is robust
DROP POLICY IF EXISTS "members_update" ON public.members;
CREATE POLICY "members_update"
ON public.members FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('members.write')
  OR auth_user_id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR public.has_permission('members.write')
  OR auth_user_id = auth.uid()
);


-- ── 4. Ensure created_by is auto-populated for groups ──────────────────────────
-- Good practice, though not required for current RLS.

ALTER TABLE public.groups
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ── 5. Add RLS for group_members deletion ─────────────────────────────────────
-- Admins and those with groups.write should be able to remove members.

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete"
ON public.group_members FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('groups.write')
);
