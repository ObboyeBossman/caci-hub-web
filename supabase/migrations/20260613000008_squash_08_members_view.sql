-- =============================================================================
-- CACI Hub — Squashed Migration 08: members_view
-- Final state after all view recreations.
--
-- security_barrier = true  — prevents predicate pushdown.
-- security_invoker = true  — enforces RLS of the QUERYING user, not view owner.
--
-- Column masking (post-RBAC — no hardcoded role names):
--   emergency_contact_* → admin OR own row (auth_user_id = auth.uid())
--   pastoral_notes       → admin only (DB floor; app layer may grant more)
--
-- Column list includes all fields up to 20260527000002 (title added).
-- =============================================================================

CREATE VIEW public.members_view
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  m.id,
  m.assembly_id,
  m.membership_number,
  m.title,
  m.first_name,
  m.last_name,
  m.other_names,
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

  -- Emergency contact: visible to admin or the member's own row
  CASE
    WHEN public.is_admin() OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_name
    ELSE NULL
  END AS emergency_contact_name,

  CASE
    WHEN public.is_admin() OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_phone
    ELSE NULL
  END AS emergency_contact_phone,

  CASE
    WHEN public.is_admin() OR m.auth_user_id = (SELECT auth.uid())
    THEN m.emergency_contact_relationship
    ELSE NULL
  END AS emergency_contact_relationship,

  m.membership_status,
  m.join_date,
  m.household_id,
  m.profile_photo_url,
  m.auth_user_id,

  -- Pastoral notes: admin only at DB layer
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
  'Security barrier + invoker view over members. security_invoker = true ensures '
  'RLS of the querying user is enforced. Column masking: emergency_contact_* '
  'visible to admin or own member row; pastoral_notes visible to admin only (DB floor). '
  'All other role-based access enforced by authorization-service.ts at the application layer. '
  'Reference: Document 5 §4.2; IMR-03.';

GRANT SELECT ON public.members_view TO authenticated;
GRANT SELECT ON public.members_view TO service_role;
