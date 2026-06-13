-- =============================================================================
-- CACI Hub — Squashed Migration 06: RLS Policies (Core Tables)
-- Final state of all RLS policies for:
--   assemblies, user_profiles, households, members, member_audit_log
--
-- Incorporates all policy drops/recreates through 20260530000008.
-- Key simplifications from the RBAC refactor:
--   - members: 3 old SELECT policies merged into 1 (members_select)
--   - user_profiles: 2 old SELECT policies merged into 1 (user_profiles_select)
--   - members UPDATE: only admin policy remains (trigger handles column-level guard)
--   - members INSERT: only admin policy remains
--   - Removed: members_update_pastoral_notes, members_update_admin_secretary,
--               members_insert_admin_secretary, members_update_member_role_trigger_allow,
--               members_update_volunteer_role_trigger_allow
-- =============================================================================


-- ── assemblies ────────────────────────────────────────────────────────────────
-- Authenticated users read only their own assembly.
-- Anon users may read active assemblies (required for assembly selection screen).
-- No INSERT / UPDATE / DELETE via API — managed via migrations/service role only.

CREATE POLICY assemblies_select_own
  ON public.assemblies FOR SELECT TO authenticated
  USING (id = public.get_user_assembly_id());

CREATE POLICY assemblies_select_public
  ON public.assemblies FOR SELECT TO anon
  USING (is_active = true);


-- ── user_profiles ─────────────────────────────────────────────────────────────
-- Merged: user_profiles_select_admin + user_profiles_select_own → one policy.

CREATE POLICY user_profiles_select
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      public.is_admin()
      AND assembly_id = public.get_user_assembly_id()
    )
  );

CREATE POLICY user_profiles_insert_admin
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

CREATE POLICY user_profiles_update_admin
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  )
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );
-- No DELETE policy — deactivation via is_active = false only.


-- ── households ────────────────────────────────────────────────────────────────

CREATE POLICY households_select_assembly
  ON public.households FOR SELECT TO authenticated
  USING (
    assembly_id = public.get_user_assembly_id()
  );

CREATE POLICY households_insert_admin
  ON public.households FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

CREATE POLICY households_update_admin
  ON public.households FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  )
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

CREATE POLICY households_delete_admin
  ON public.households FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );


-- ── members ───────────────────────────────────────────────────────────────────
-- Single SELECT policy with three OR branches (replaces three separate policies).
-- Fine-grained column visibility: members_view. Route-level access: app layer.

CREATE POLICY members_select
  ON public.members FOR SELECT TO authenticated
  USING (
    -- Admin: all rows including soft-deleted, within their assembly
    (
      public.is_admin()
      AND assembly_id = public.get_user_assembly_id()
    )
    OR
    -- All authenticated members in the same assembly may read active records.
    (
      assembly_id = public.get_user_assembly_id()
      AND is_active = true
    )
    OR
    -- Own row via linked auth account (catches member role).
    (
      auth_user_id = (SELECT auth.uid())
    )
  );

-- INSERT: admin only (secretary access handled at app/edge function layer).
CREATE POLICY members_insert_admin
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- UPDATE: admin only (enforce_member_update_columns trigger is defence-in-depth).
CREATE POLICY members_update_admin
  ON public.members FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  )
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- NO DELETE POLICY (IMR-01) — hard deletion blocked for all roles.
-- Soft delete: UPDATE members SET is_active = false, deleted_at = now().


-- ── member_audit_log ──────────────────────────────────────────────────────────
-- Admin may read audit entries within their assembly.
-- No INSERT / UPDATE / DELETE policies (IMR-02) — trigger writes only.

CREATE POLICY audit_log_select_admin
  ON public.member_audit_log FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );
