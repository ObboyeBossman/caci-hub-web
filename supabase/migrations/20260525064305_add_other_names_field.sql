-- =============================================================================
-- CACI Hub — Migration 20260525064305
-- Purpose:  Add other_names field to the members table and view
-- Date:     May 25, 2026
-- =============================================================================

-- Add other_names column to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS other_names text;

COMMENT ON COLUMN public.members.other_names IS
  'Optional middle names or other given names.';

-- Recreate members_view to include other_names.
-- CREATE OR REPLACE VIEW cannot insert a column in the middle of the list
-- (PostgreSQL 42P16), so we DROP and recreate instead.
-- IMPORTANT: auth_user_id MUST be included — it is used by the RLS policy
-- members_select_own_member_role (auth_user_id = auth.uid()).
DROP VIEW IF EXISTS public.members_view;

CREATE VIEW public.members_view
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.other_names,
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

  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor', 'secretary', 'member')
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,

  -- Pastoral notes: visible to admin and pastor only (IMR-03)
  CASE
    WHEN public.get_user_role() IN ('admin', 'pastor')
    THEN m.pastoral_notes
    ELSE NULL
  END AS pastoral_notes,

  m.is_active,
  m.deleted_at,
  m.created_by,
  m.created_at,
  m.updated_at,
  m.auth_user_id   -- Required by members_select_own_member_role RLS policy

FROM public.members m;

COMMENT ON VIEW public.members_view IS
  'Security barrier view over members. Handles column-level masking of '
  'emergency_contact_* (hidden from volunteer) and pastoral_notes (hidden '
  'from secretary, volunteer, member). Row-level filtering is handled by '
  'the RLS policies on the underlying members table. '
  'All application queries must use this view, not the table directly. '
  'Reference: Document 5, Section 4.2; IMR-03.';

-- Re-grant after view recreation (CREATE OR REPLACE can reset grants
-- in some Postgres/Supabase versions).
GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;
