-- =============================================================================
-- CACI Hub — Migration 20260427000013
-- Purpose:  RLS policies — assemblies, user_profiles, households, members
--           (SELECT + INSERT policies only — Days 22 and 23)
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Days:     22–23
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000011_create_helper_functions.sql  (all 6 helper functions)
--   20260427000012_enable_rls.sql               (RLS enabled on all tables)
-- Reference: Document 5, Sections 5–8
-- =============================================================================
-- Decisions applied in this file:
--   Day 22 — assemblies and user_profiles policies
--   Day 23 — households and members SELECT + INSERT policies
-- =============================================================================


-- =============================================================================
-- SECTION 1 — assemblies (Day 22)
-- Reference: Document 5, Section 5
-- =============================================================================
-- Authenticated users may read only the assembly to which they are assigned.
-- No INSERT / UPDATE / DELETE: assemblies are managed exclusively via migrations
-- or the Supabase dashboard using the service role key.
-- -----------------------------------------------------------------------------

CREATE POLICY assemblies_select_own
  ON public.assemblies
  FOR SELECT
  TO authenticated
  USING (
    id = public.get_user_assembly_id()
  );

-- No INSERT policy — no role may create assemblies via the API.
-- No UPDATE policy — no role may modify assemblies via the API.
-- No DELETE policy — no role may delete assemblies via the API.


-- =============================================================================
-- SECTION 2 — user_profiles (Day 22)
-- Reference: Document 5, Section 6
-- =============================================================================

-- Admin sees all active user profiles within their assembly.
CREATE POLICY user_profiles_select_admin
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- All authenticated users may read their own profile row.
-- Required for the app to load the user's role and assembly on login.
CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );

-- Only Admin may create user profile rows (i.e. create accounts) within their assembly.
CREATE POLICY user_profiles_insert_admin
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- Only Admin may update user profiles (role reassignment, deactivation).
CREATE POLICY user_profiles_update_admin
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  )
  WITH CHECK (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );

-- No DELETE policy: user profiles are deactivated via is_active = false, never hard-deleted.


-- =============================================================================
-- SECTION 3 — households (Day 23)
-- Reference: Document 5, Section 7
-- =============================================================================

-- Admin, Pastor, Secretary, and Volunteer may read household records in their assembly.
CREATE POLICY households_select_assembly
  ON public.households
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_directory()
    AND assembly_id = public.get_user_assembly_id()
  );

-- Admin and Secretary may create households within their assembly.
CREATE POLICY households_insert_admin_secretary
  ON public.households
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
  );

-- Admin and Secretary may update households within their assembly.
CREATE POLICY households_update_admin_secretary
  ON public.households
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
  )
  WITH CHECK (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
  );

-- Admin may delete household records (only succeeds if no members are linked
-- — the members.household_id FK will reject the delete otherwise).
CREATE POLICY households_delete_admin
  ON public.households
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND assembly_id = public.get_user_assembly_id()
  );


-- =============================================================================
-- SECTION 4 — members: SELECT and INSERT policies (Day 23)
-- Reference: Document 5, Section 8
-- UPDATE and remaining SELECT policies added in Migration 14 (Day 24).
-- =============================================================================

-- Admin, Pastor, Secretary, and Volunteer may read active (non-deleted) member records
-- within their assembly.
CREATE POLICY members_select_directory_roles
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_directory()
    AND assembly_id = public.get_user_assembly_id()
    AND is_active = true
  );

-- Member role may read only their own record.
-- Phase 1 limitation: created_by captures the Secretary's auth.uid() at insert time,
-- not the member's. A dedicated auth_user_id column (planned for Phase 4) will fix this.
-- Reference: Document 5, Section 8 design decision note.
CREATE POLICY members_select_own_member_role
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'member'
    AND created_by = auth.uid()
  );

-- Admin and Secretary may insert new member records within their assembly.
CREATE POLICY members_insert_admin_secretary
  ON public.members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_secretary()
    AND assembly_id = public.get_user_assembly_id()
  );


-- =============================================================================
-- END OF MIGRATION 20260427000013
-- =============================================================================
