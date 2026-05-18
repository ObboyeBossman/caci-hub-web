-- =============================================================================
-- CACI Hub — Migration 20260427000003
-- Table:   user_profiles
-- Author:  Abraham N. O. Bossman
-- Phase:   Phase 1 — Database Foundation
-- Day:     13
-- Date:    May 6, 2026
-- =============================================================================
-- Depends on:
--   20260427000001_create_enums.sql       (user_role enum must exist)
--   20260427000002_create_assemblies.sql  (assemblies table + set_updated_at() must exist)
-- Referenced by:
--   households, members, member_audit_log
--   (created_by / changed_by FKs all point to user_profiles.id)
-- =============================================================================
-- Decisions applied in this file:
--   Day 10 Decision 1  — admin must have a member record first (app-layer
--                         enforcement; member_id FK deferred to a later migration)
--   Day 11 Decision 2  — migration timestamp uses project start date (20260427)
--   Day 12 Decision 1  — set_updated_at() already defined in migration 2;
--                         referenced here via EXECUTE FUNCTION, not redefined
--   Day 12 Decision 2  — RLS enabled immediately with no data-access policies
--                         (secure default; policies applied in dedicated RLS migration)
-- =============================================================================
-- Naming note — helper function names:
--   Document 4 (ERD §4.2) lists current_user_role() / current_user_assembly().
--   Document 5 (RLS Policy Spec §3) supersedes those with get_user_role() /
--   get_user_assembly_id() — the names actually called by every RLS policy.
--   Document 5 also adds four additional helpers not in Document 4:
--   is_admin(), is_admin_or_pastor(), is_admin_or_secretary(), can_read_directory().
--   This migration uses Document 5 names throughout. Document 4 should be
--   updated to align in its next revision.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Create user_profiles table
-- -----------------------------------------------------------------------------
-- Links a Supabase Auth user (auth.users.id) to an assembly and a system role.
-- The Flutter app reads this table immediately after login to determine the
-- user's role and assembly, which drives all navigation and RLS policy results.
-- Rows are created by the Admin when provisioning a new staff/volunteer account.
-- They are NOT auto-created on Supabase Auth sign-up.
-- Reference: Document 4 §4.2
-- -----------------------------------------------------------------------------

CREATE TABLE public.user_profiles (

  -- PK mirrors auth.users.id — this is NOT a standalone generated UUID.
  -- ON DELETE CASCADE: removing the Auth user also removes the profile row.
  id           uuid                NOT NULL
               PRIMARY KEY
               REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Every user belongs to exactly one assembly.
  -- All RLS cross-assembly isolation (IMR-04) derives from this column.
  assembly_id  uuid                NOT NULL
               REFERENCES public.assemblies(id),

  -- System role. Phase 1 active: admin, pastor, secretary, volunteer, member.
  -- Future-phase roles pre-declared in the enum (Day 11 Decision 1).
  -- Only admin may change this column (RLS policy: user_profiles_update_admin).
  -- Default 'member' is a safe, low-privilege fallback.
  role         public.user_role    NOT NULL DEFAULT 'member',

  -- Display name surfaced in audit log entries and the Flutter UI header.
  -- Supplied by the Admin at account creation time.
  full_name    text                NOT NULL,

  -- Soft-disable flag. false = account deactivated; user may not log in.
  -- Set by Admin via SCR-16 (User Management). Profiles are never hard-deleted.
  -- Reference: Document 3 §4.10
  is_active    boolean             NOT NULL DEFAULT true,

  created_at   timestamptz         NOT NULL DEFAULT now(),
  updated_at   timestamptz         NOT NULL DEFAULT now()

);


-- -----------------------------------------------------------------------------
-- 2. Table and column comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.user_profiles IS
  'Links a Supabase Auth user to their assembly and system role. '
  'Source of truth for all RLS helper functions '
  '(get_user_role, get_user_assembly_id, is_admin, etc.). '
  'Rows are Admin-created — not auto-created on sign-up. '
  'Never hard-deleted; deactivation via is_active = false only.';

COMMENT ON COLUMN public.user_profiles.id IS
  'Primary key. Must equal auth.users.id for the corresponding Auth account. '
  'Not a standalone UUID — cascade-deleted when the Auth user is removed.';

COMMENT ON COLUMN public.user_profiles.assembly_id IS
  'The assembly this user account belongs to. '
  'Every RLS policy derives the requesting user''s assembly scope from this column. '
  'Enforces IMR-04 (no cross-assembly data access) at the database layer.';

COMMENT ON COLUMN public.user_profiles.role IS
  'System role. Controls which RLS policy branches apply and which Flutter UI '
  'features are visible. Phase 1 active: admin, pastor, secretary, volunteer, member. '
  'Only an admin may UPDATE this column (RLS-enforced). '
  'Default member is a safe fallback for any account not explicitly assigned a role.';

COMMENT ON COLUMN public.user_profiles.full_name IS
  'User display name. Written to member_audit_log.changed_by context on every '
  'audited member change. Does not need to match auth.users metadata.';

COMMENT ON COLUMN public.user_profiles.is_active IS
  'Soft-disable flag. Set to false by Admin to deactivate an account. '
  'The Supabase Auth session should also be revoked at the same time — '
  'RLS alone does not invalidate an existing JWT for an inactive user. '
  'All six RLS helper functions filter AND is_active = true, '
  'so an inactive user effectively has no role and no assembly access.';


-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
-- set_updated_at() was defined once in 20260427000002_create_assemblies.sql
-- and is shared across all Phase 1 tables. Do NOT redefine it here.
-- Reference: Day 12 Decision 1
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Enable Row Level Security
-- -----------------------------------------------------------------------------
-- Enabled immediately on table creation — the table is never left unprotected.
-- With RLS on and no policies defined, PostgreSQL denies all rows to all roles
-- (except the table owner). This is the correct secure default.
-- Reference: Day 12 Decision 2
--
-- Data-access policies for user_profiles are applied in the dedicated RLS
-- migration (Document 5 §6):
--   user_profiles_select_admin   — admin reads all profiles in their assembly
--   user_profiles_select_own     — any authenticated user reads their own row
--   user_profiles_insert_admin   — admin creates profiles within their assembly
--   user_profiles_update_admin   — admin updates profiles within their assembly
--   (No DELETE policy — deactivation via is_active = false only)
-- -----------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------

-- assembly_id FK — every RLS helper does a WHERE on this; essential for performance.
CREATE INDEX idx_user_profiles_assembly_id
  ON public.user_profiles (assembly_id);

-- role — used in RLS helper WHERE clauses and admin role-filter dashboard queries.
CREATE INDEX idx_user_profiles_role
  ON public.user_profiles (role);

-- is_active — all six RLS helpers filter AND is_active = true on every query.
CREATE INDEX idx_user_profiles_is_active
  ON public.user_profiles (is_active);


-- =============================================================================
-- 6. RLS Helper Functions
-- =============================================================================
-- All six helper functions required by Document 5 (RLS Policy Specification §3)
-- are defined here in full. These are not stubs — they are the complete,
-- production implementations that all subsequent RLS policies will call.
--
-- Why defined in this migration (not a separate one)?
--   These functions SELECT from user_profiles. They can only be defined after
--   user_profiles exists. Placing them here makes the dependency explicit:
--   table first, then the functions that read it.
--
-- Why SECURITY DEFINER?
--   RLS is enabled on user_profiles. If a policy on another table (e.g. members)
--   calls a helper that reads user_profiles, that inner read is itself subject
--   to user_profiles RLS — causing infinite recursion or an empty result.
--   SECURITY DEFINER elevates the function to run as its definer (the DB owner),
--   bypassing user_profiles RLS for that lookup only. This is the standard
--   Supabase pattern for role-based RLS helpers.
--   Reference: Document 5 §3 "Why SECURITY DEFINER?"
--
-- Why SET search_path = public?
--   Pins the function to the public schema, preventing search_path injection
--   attacks where an attacker creates a shadowing function in another schema.
--
-- Why STABLE?
--   Tells the query planner the function returns the same result within a
--   single query execution. The planner can cache and reuse the result across
--   all rows in a result set rather than re-executing the SELECT for every row.
--   Critical on large tables (members, member_audit_log).
--
-- Why AND is_active = true?
--   A deactivated user must be treated as if they have no role and no assembly.
--   Returning NULL from all helpers means every RLS USING clause evaluates to
--   false — the deactivated user sees zero rows and cannot write anything.
--
-- Why LIMIT 1?
--   id is the PK on user_profiles, so auth.uid() maps to at most one row.
--   LIMIT 1 is defensive — explicit intent, and future-safe against any schema
--   change that might inadvertently allow duplicate id values.
--
-- All functions use CREATE OR REPLACE — idempotent, safe to re-apply.
-- Reference: Document 5 §3.1–3.6
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 6.1  get_user_role()
-- ---------------------------------------------------------------------------
-- Returns the user_role enum of the currently authenticated user.
-- Returns NULL if the user has no active profile — all RLS policies then
-- evaluate to false, so the user can access nothing.
-- Usage in policies: public.get_user_role() = 'pastor'
-- Reference: Document 5 §3.1
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id        = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS
  'Returns the user_role of the currently authenticated Supabase user. '
  'Returns NULL if no active user_profiles row exists for auth.uid(). '
  'SECURITY DEFINER prevents infinite recursion when called from inside '
  'an RLS policy on a table that itself reads user_profiles. '
  'Used in every RLS policy that branches on the requesting user''s role.';


-- ---------------------------------------------------------------------------
-- 6.2  get_user_assembly_id()
-- ---------------------------------------------------------------------------
-- Returns the assembly_id UUID of the currently authenticated user.
-- Returns NULL if the user has no active profile — every assembly-scoped
-- RLS USING clause (assembly_id = get_user_assembly_id()) then evaluates
-- to false, so the user can read or write no assembly data.
-- Usage in policies: assembly_id = public.get_user_assembly_id()
-- Reference: Document 5 §3.2; enforces IMR-04
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_assembly_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assembly_id
  FROM public.user_profiles
  WHERE id        = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_assembly_id() IS
  'Returns the assembly_id of the currently authenticated Supabase user. '
  'Returns NULL if no active user_profiles row exists for auth.uid(). '
  'A NULL result causes every assembly_id = get_user_assembly_id() RLS '
  'clause to evaluate to false — inactive or unassigned users access nothing. '
  'SECURITY DEFINER to bypass user_profiles RLS during lookup. '
  'Primary enforcement mechanism for IMR-04 (no cross-assembly data access).';


-- ---------------------------------------------------------------------------
-- 6.3  is_admin()
-- ---------------------------------------------------------------------------
-- Convenience predicate: true iff the current user is an active admin.
-- Returns false (not NULL) for unauthenticated or inactive users.
-- Usage in policies: public.is_admin()
-- Reference: Document 5 §3.3
-- ---------------------------------------------------------------------------

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
    WHERE id        = auth.uid()
      AND role      = 'admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true iff the current user is an active admin. '
  'Returns false (not NULL) for unauthenticated or inactive users — '
  'EXISTS always returns a boolean, never NULL. '
  'Used as a shorthand predicate in admin-only RLS policies.';


-- ---------------------------------------------------------------------------
-- 6.4  is_admin_or_pastor()
-- ---------------------------------------------------------------------------
-- True iff the current user is an active admin or pastor.
-- Used in policies granting elevated read access (e.g. pastoral_notes
-- visibility, soft-deleted record access).
-- Reference: Document 5 §3.4
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_pastor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id        = auth.uid()
      AND role      IN ('admin', 'pastor')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_pastor() IS
  'Returns true iff the current user is an active admin or pastor. '
  'Used in RLS policies that grant elevated read access, '
  'including pastoral_notes visibility (IMR-03).';


-- ---------------------------------------------------------------------------
-- 6.5  is_admin_or_secretary()
-- ---------------------------------------------------------------------------
-- True iff the current user is an active admin or secretary.
-- Used in INSERT and UPDATE policies on members and households —
-- the two roles permitted to create and edit records.
-- Reference: Document 5 §3.5
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_or_secretary()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id        = auth.uid()
      AND role      IN ('admin', 'secretary')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_secretary() IS
  'Returns true iff the current user is an active admin or secretary. '
  'Used in INSERT and UPDATE RLS policies on members and households — '
  'the two roles authorised to create and modify records.';


-- ---------------------------------------------------------------------------
-- 6.6  can_read_directory()
-- ---------------------------------------------------------------------------
-- True iff the current user holds a role permitted to read the member
-- directory: admin, pastor, secretary, volunteer.
-- The 'member' role is deliberately excluded — members use a separate
-- own-record-only SELECT policy (members_select_own_member_role in Doc 5 §8).
-- Reference: Document 5 §3.6
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id        = auth.uid()
      AND role      IN ('admin', 'pastor', 'secretary', 'volunteer')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.can_read_directory() IS
  'Returns true iff the current user may read the member directory. '
  'Permitted roles: admin, pastor, secretary, volunteer. '
  'The member role is excluded — members use a separate own-record-only SELECT policy. '
  'Used in SELECT policies on members and households.';


-- =============================================================================
-- END OF MIGRATION 20260427000003
-- =============================================================================
--
-- Post-apply verification (run in Supabase SQL Editor after supabase db push):
--
-- 1. Confirm table columns:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'user_profiles'
--    ORDER BY ordinal_position;
--    -- Expected: 7 columns — id, assembly_id, role, full_name, is_active,
--    --           created_at, updated_at
--
-- 2. Confirm RLS is enabled:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'user_profiles';
--    -- Expected: rowsecurity = true
--
-- 3. Confirm all six helper functions are present and SECURITY DEFINER:
--    SELECT proname, prosecdef
--    FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN (
--        'get_user_role',
--        'get_user_assembly_id',
--        'is_admin',
--        'is_admin_or_pastor',
--        'is_admin_or_secretary',
--        'can_read_directory'
--      )
--    ORDER BY proname;
--    -- Expected: 6 rows, all with prosecdef = true
--
-- 4. Confirm updated_at trigger is attached:
--    SELECT trigger_name, event_manipulation, action_timing
--    FROM information_schema.triggers
--    WHERE event_object_schema = 'public'
--      AND event_object_table  = 'user_profiles';
--    -- Expected: trg_user_profiles_set_updated_at | UPDATE | BEFORE
--
-- 5. Confirm indexes:
--    SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'user_profiles';
--    -- Expected: user_profiles_pkey, idx_user_profiles_assembly_id,
--    --           idx_user_profiles_role, idx_user_profiles_is_active
--
-- Day 13 commit:
--   git add . && git commit -m "Day 13 — Migration 3: user_profiles table + RLS helper functions"
--
-- Day 14 task: 20260427000004_create_households.sql
--   Remember: households.primary_contact_id FK to members.id must be added
--   AFTER the members table exists (circular reference — deferrable FK).
--   Remember: set_updated_at() trigger — do not redefine, just call.
-- =============================================================================
