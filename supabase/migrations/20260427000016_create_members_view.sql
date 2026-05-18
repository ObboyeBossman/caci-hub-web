-- =============================================================================
-- CACI Hub — Migration 20260427000016
-- Purpose:  members_view — security barrier view with column-level masking
-- Author:   Abraham N. O. Bossman
-- Phase:    Phase 1 — Database Foundation
-- Day:      25
-- Date:     April 27, 2026
-- =============================================================================
-- Depends on:
--   20260427000005_create_members.sql         (members table)
--   20260427000011_create_helper_functions.sql (get_user_role())
--   20260427000013_create_rls_policies.sql    (members RLS policies)
--   20260427000014_rls_members_remaining.sql  (members RLS policies continued)
-- Reference: Document 5, Section 4.2
-- =============================================================================
-- Purpose:
--   RLS handles ROW-level filtering — which rows a user can see.
--   This view handles COLUMN-level masking — which fields are visible per role.
--
--   Two column groups require masking:
--     1. emergency_contact_* — hidden from 'volunteer' role (but visible to
--        'member' so they can view their own emergency contact data).
--     2. pastoral_notes — hidden from 'secretary', 'volunteer', 'member'.
--        Visible only to 'admin' and 'pastor'.
--
--   security_barrier = true prevents predicate pushdown — a malicious function
--   in a WHERE clause cannot be used to extract data before the CASE expressions
--   are evaluated. Required whenever the view applies security restrictions.
--
--   ALL application queries must use public.members_view, not public.members
--   directly. The exception is the write_member_audit_log() trigger, which
--   operates on the underlying table.
-- =============================================================================
-- Day 25 Decision 1: emergency_contact_* includes 'member' role
--   Task spec allows ('admin', 'pastor', 'secretary').
--   Document 5 Section 4.2 allows ('admin', 'pastor', 'secretary', 'member').
--   Document 5 is the authoritative source — 'member' is included so a member
--   can view their own emergency contact data on their own profile screen.
-- =============================================================================
-- Day 25 Decision 2: column name is emergency_contact_relationship
--   Document 5's view definition uses 'emergency_contact_relation' (no -ship).
--   Our actual schema column (Migration 5) is 'emergency_contact_relationship'.
--   The view references the live column name — the Document 5 spec has a typo.
-- =============================================================================
-- Day 25 Decision 3: file sequence is 000016, not 000015
--   Migration 000015 is already taken by the Day 17–24 audit correction file.
--   This view is assigned the next available sequence number.
-- =============================================================================


CREATE OR REPLACE VIEW public.members_view
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.date_of_birth,
  m.gender,
  m.marital_status,
  m.phone_number,
  m.email,
  m.physical_address,
  m.occupation,
  m.facebook_url,
  m.whatsapp_number,
  m.instagram_url,

  -- Emergency contact fields
  -- Visible to: admin, pastor, secretary, member (own record via RLS)
  -- Hidden from: volunteer
  -- Reference: Document 5, Section 4.2 + Day 25 Decision 1
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone,

  -- Note: column is emergency_contact_relationship in members table.
  -- Document 5 section 4.2 shows emergency_contact_relation — that is a typo
  -- in the spec. The live column name governs here. See Day 25 Decision 2.
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,

  -- Pastoral notes
  -- Visible to: admin, pastor only (IMR-03)
  -- Hidden from: secretary, volunteer, member
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor')
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
  'Security barrier view over members. Handles column-level masking of '
  'emergency_contact_* (hidden from volunteer) and pastoral_notes (hidden '
  'from secretary, volunteer, member). Row-level filtering is handled by '
  'the RLS policies on the underlying members table. '
  'All application queries must use this view, not the table directly. '
  'Reference: Document 5, Section 4.2; IMR-03.';


-- =============================================================================
-- END OF MIGRATION 20260427000016 — Phase 1 database layer complete
-- =============================================================================
--
-- Post-apply verification:
--
-- 1. Confirm view exists with security_barrier:
--    SELECT viewname, definition
--    FROM pg_views
--    WHERE schemaname = 'public' AND viewname = 'members_view';
--
-- 2. Confirm all 5 tables have RLS enabled:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'assemblies', 'user_profiles', 'households',
--        'members', 'member_audit_log'
--      );
--    -- Expected: all 5 rows show rowsecurity = true
--
-- 3. Confirm column count via view (expect all members columns, 24 total):
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'members_view'
--    ORDER BY ordinal_position;
--
-- Phase 1 checkpoint (run before Day 26):
--   [ ] All migration files pushed without errors
--   [ ] 5 tables present with correct columns
--   [ ] 4 enum types present
--   [ ] All indexes present (10 on members + 3 on user_profiles + 2 on audit_log)
--   [ ] set_updated_at trigger fires on UPDATE (confirmed Day 19)
--   [ ] write_member_audit_log trigger confirmed (confirmed Day 20)
--   [ ] All 6 helper functions present
--   [ ] RLS enabled on all 5 tables
--   [ ] members_view present with security_barrier = true
--   [ ] Deferrable FK on households.primary_contact_id present
-- =============================================================================
