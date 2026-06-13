-- =============================================================================
-- CACI Hub — Squashed Migration 03: Core Tables
-- Final state of: assemblies, user_profiles, households, members,
--                 member_audit_log
--
-- Incorporates all column additions/removals/renames from every patch
-- migration through 20260613.
-- =============================================================================


-- ── 1. assemblies ─────────────────────────────────────────────────────────────

CREATE TABLE public.assemblies (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  assembly_code           text        NOT NULL UNIQUE
                          CHECK (assembly_code ~ '^[A-Z]{2}-[A-Z]{3,6}$'),
  address                 text,
  digital_address         text,
  -- Added: 20260526000001
  default_member_password text,
  is_active               boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.assemblies IS
  'Assembly (church branch) registry. Pre-seeded — not user-managed via UI until the multi-assembly phase.';
COMMENT ON COLUMN public.assemblies.assembly_code IS
  'Short structured code for membership number generation. Format: [2-letter ISO]-[3–6 letter abbreviation]. e.g. GH-ASSAK.';
COMMENT ON COLUMN public.assemblies.default_member_password IS
  'Assembly-level temporary password for members provisioned without an email. Set by admin. NULL = not configured.';

CREATE INDEX idx_assemblies_is_active ON public.assemblies (is_active);

ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_assemblies_set_updated_at
  BEFORE UPDATE ON public.assemblies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 2. user_profiles ──────────────────────────────────────────────────────────
-- role was an enum (user_role) originally, then converted to TEXT with a CHECK
-- constraint in the RBAC refactor (20260530000005). Final state is TEXT.
-- role_id was renamed to assembly_role_id (20260530000004).
-- phone column was added then dropped (20260531081636) — not present.
-- must_change_password added (20260526000002).

CREATE TABLE public.user_profiles (
  id                  uuid        NOT NULL PRIMARY KEY
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  assembly_id         uuid        NOT NULL
                      REFERENCES public.assemblies(id),
  -- TEXT with CHECK — not an enum. Only 'admin' and 'member' are system roles.
  -- Fine-grained roles live in assembly_roles.
  role                text        NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member')),
  full_name           text        NOT NULL,
  is_active           boolean     NOT NULL DEFAULT true,
  must_change_password boolean    NOT NULL DEFAULT false,
  -- FK to assembly_roles(id); NULL = no custom role assigned.
  -- Renamed from role_id (20260530000004).
  assembly_role_id    uuid,       -- FK added after assembly_roles exists (see migration 05)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_profiles IS
  'Links a Supabase Auth user to their assembly and system role. '
  'Source of truth for is_admin() / get_user_assembly_id() helpers. '
  'Rows are Admin-created — not auto-created on sign-up. Never hard-deleted.';
COMMENT ON COLUMN public.user_profiles.role IS
  'System role: admin or member. All fine-grained permissions live in assembly_roles '
  'and role_permissions. Only admins may update this column (RLS-enforced).';
COMMENT ON COLUMN public.user_profiles.assembly_role_id IS
  'Optional FK to assembly_roles. Changing this triggers sync_user_permissions_to_jwt '
  'which writes permissions into the JWT app_metadata.';
COMMENT ON COLUMN public.user_profiles.must_change_password IS
  'True when the account was provisioned with a default/admin-set password. '
  'Forces a non-dismissable password change screen on first login.';

CREATE INDEX idx_user_profiles_assembly_id  ON public.user_profiles (assembly_id);
CREATE INDEX idx_user_profiles_role         ON public.user_profiles (role);
CREATE INDEX idx_user_profiles_is_active    ON public.user_profiles (is_active);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. households ─────────────────────────────────────────────────────────────
-- primary_contact_id FK is DEFERRABLE — added after members exists.

CREATE TABLE public.households (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id        uuid        NOT NULL REFERENCES public.assemblies(id),
  family_name        text        NOT NULL,
  address            text,
  -- Plain uuid now; deferrable FK to members.id added in migration 07.
  primary_contact_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.households IS
  'Groups member records into family units, scoped to one assembly. '
  'primary_contact_id FK is deferrable — see fk_households_primary_contact.';

CREATE INDEX idx_households_assembly_id ON public.households (assembly_id);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. members ────────────────────────────────────────────────────────────────
-- Final column set after all patches:
--   phone_number → primary_phone (20260527000001)
--   secondary_phone added (20260527000001)
--   other_names added (20260525064305)
--   title added (20260527000002)
--   auth_user_id added (20260502100000)
--   contact required constraint DROPPED (20260529000001)

CREATE TABLE public.members (

  -- ── Identity ────────────────────────────────────────────────────────────────
  id                 uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id        uuid                     NOT NULL REFERENCES public.assemblies(id),
  membership_number  text,   -- NULL at insert; assigned by assign_membership_number()

  -- ── Biographical ────────────────────────────────────────────────────────────
  title              text
                     CHECK (title IN (
                       'Mr.','Mrs.','Ms.','Miss',
                       'Dr.','Prof.',
                       'Rev.','Pastor','Elder','Deacon','Deaconess',
                       'Apostle','Bishop'
                     )),
  first_name         text    NOT NULL,
  last_name          text    NOT NULL,
  other_names        text,
  date_of_birth      date,
  gender             public.gender_type       NOT NULL,
  marital_status     public.marital_status_type,

  -- ── Contact ─────────────────────────────────────────────────────────────────
  -- Both nullable; constraint dropped in 20260529000001.
  primary_phone      text,
  secondary_phone    text,
  email              text,
  physical_address   text,
  occupation         text,

  -- ── Social ──────────────────────────────────────────────────────────────────
  facebook_url       text,
  whatsapp_number    text,
  instagram_url      text,

  -- ── Emergency contact ───────────────────────────────────────────────────────
  emergency_contact_name         text,
  emergency_contact_phone        text,
  emergency_contact_relationship text,

  -- ── Membership ──────────────────────────────────────────────────────────────
  membership_status  public.membership_status NOT NULL DEFAULT 'visitor',
  join_date          date,
  household_id       uuid REFERENCES public.households(id) ON DELETE SET NULL,

  -- ── Media ───────────────────────────────────────────────────────────────────
  profile_photo_url  text,

  -- ── Pastoral (restricted) ───────────────────────────────────────────────────
  pastoral_notes     text,

  -- ── Soft delete ─────────────────────────────────────────────────────────────
  is_active          boolean     NOT NULL DEFAULT true,
  deleted_at         timestamptz,

  -- ── Auth link ───────────────────────────────────────────────────────────────
  auth_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Record management ───────────────────────────────────────────────────────
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.members IS
  'Core member registry. Scoped to one assembly. Soft-deleted rows (deleted_at IS NOT NULL) '
  'are excluded from all active indexes and regular RLS policies.';
COMMENT ON COLUMN public.members.membership_number IS
  'Format: CACI-[assembly_code]-[5-digit-zero-padded]. NULL at insert; '
  'set by assign_membership_number(). Unique among non-deleted rows.';
COMMENT ON COLUMN public.members.auth_user_id IS
  'Supabase Auth user linked to this member (admin-provisioned login). NULL = no app login.';
COMMENT ON COLUMN public.members.pastoral_notes IS
  'Confidential notes. Masked for all roles except admin in members_view.';

-- Indexes
CREATE INDEX idx_members_assembly_id ON public.members (assembly_id);

CREATE INDEX idx_members_membership_status
  ON public.members (assembly_id, membership_status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_household_id
  ON public.members (household_id)
  WHERE household_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_membership_number_unique
  ON public.members (membership_number)
  WHERE membership_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_primary_phone_unique
  ON public.members (assembly_id, primary_phone)
  WHERE primary_phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_email_unique
  ON public.members (assembly_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_auth_user_id_unique
  ON public.members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX idx_members_last_name
  ON public.members (last_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_created_at
  ON public.members (assembly_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_deleted_at
  ON public.members (assembly_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_members_is_active
  ON public.members (assembly_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_fulltext
  ON public.members
  USING GIN (to_tsvector('english', first_name || ' ' || last_name));

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_members_set_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. member_audit_log ───────────────────────────────────────────────────────
-- changed_by FK points to auth.users (restored in 20260509000001 after
-- 20260501044607 incorrectly pointed it to user_profiles).

CREATE TABLE public.member_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  assembly_id   uuid        NOT NULL REFERENCES public.assemblies(id),
  changed_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  field_changed text        NOT NULL,
  old_value     text,
  new_value     text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.member_audit_log IS
  'Immutable audit trail of field-level changes to member records. '
  'Written only by the write_member_audit_log SECURITY DEFINER trigger. '
  'No application role may INSERT, UPDATE, or DELETE rows (IMR-02).';

CREATE INDEX idx_audit_log_member_id
  ON public.member_audit_log (member_id);

CREATE INDEX idx_audit_log_assembly_changed_at
  ON public.member_audit_log (assembly_id, changed_at DESC);

ALTER TABLE public.member_audit_log ENABLE ROW LEVEL SECURITY;


-- ── 6. Deferrable FK: households ↔ members ────────────────────────────────────
-- households.primary_contact_id → members.id
-- DEFERRABLE INITIALLY DEFERRED resolves the circular reference.

ALTER TABLE public.households
  ADD CONSTRAINT fk_households_primary_contact
  FOREIGN KEY (primary_contact_id)
  REFERENCES public.members(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Unique partial index on primary_contact_id (one primary contact per household).
CREATE UNIQUE INDEX idx_households_primary_contact_id
  ON public.households (primary_contact_id)
  WHERE primary_contact_id IS NOT NULL;
