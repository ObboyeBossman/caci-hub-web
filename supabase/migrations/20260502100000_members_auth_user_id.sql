-- Link members.managed login account (one per member when set).
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_auth_user_id_unique
  ON public.members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.members.auth_user_id IS
  'Supabase Auth user linked to this member (admin-provisioned login). '
  'NULL means no app login yet.';

-- Recreate members_view to expose auth_user_id (admin uses it to filter “no account yet”).
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
  m.auth_user_id
FROM public.members m;
