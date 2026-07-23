-- =============================================================================
-- CACI HUB — Squashed Migration v1
-- Single-assembly deployment. No multi-tenancy.
--
-- Execution order:
--   1.  Extensions
--   2.  Enums
--   3.  Helper functions
--   4.  Core: user_profiles
--   5.  Membership: members, groups, group_members, member_permissions
--   6.  Communication: broadcasts, broadcast_recipients, notifications
--   7.  RLS policies
--   8.  Triggers
--
-- Table count: 7
--   Auth (1):        user_profiles
--   Membership (4):  members, groups, group_members, member_permissions
--   Communication (3): broadcasts, broadcast_recipients, notifications
-- =============================================================================


-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- SECTION 2: ENUMS
-- =============================================================================

CREATE TYPE public.gender_type AS ENUM (
  'male',
  'female'
);

CREATE TYPE public.marital_status_type AS ENUM (
  'single',
  'married',
  'divorced',
  'widowed',
  'other'
);

CREATE TYPE public.membership_status AS ENUM (
  'visitor',
  'active',
  'inactive'
);


-- =============================================================================
-- SECTION 3: HELPER FUNCTIONS
-- =============================================================================

-- ── set_updated_at ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;



-- ── member_counter ─────────────────────────────────────────────────────────────
-- Single-row counter for membership number generation.

CREATE TABLE public.member_counter (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- only one row ever
  last_number integer NOT NULL DEFAULT 0
);

INSERT INTO public.member_counter (id, last_number) VALUES (1, 0);

COMMENT ON TABLE public.member_counter IS
  'Single-row counter for membership number generation. '
  'Never decremented. A number once issued is permanent.';


-- ── assign_membership_number ──────────────────────────────────────────────────
-- BEFORE INSERT on members.
-- Format: CACI-[5-digit-zero-padded]
-- e.g.    CACI-00001

CREATE OR REPLACE FUNCTION public.assign_membership_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_number integer;
BEGIN
  UPDATE public.member_counter
  SET    last_number = last_number + 1
  WHERE  id = 1
  RETURNING last_number INTO v_next_number;

  NEW.membership_number := 'CACI-' || LPAD(v_next_number::text, 5, '0');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_membership_number IS
  'Generates a sequential membership number on INSERT. '
  'Format: CACI-00001. Counter never resets.';


-- =============================================================================
-- SECTION 4: AUTH
-- =============================================================================

-- ── user_profiles ─────────────────────────────────────────────────────────────

CREATE TABLE public.user_profiles (
  id                   uuid        NOT NULL PRIMARY KEY
                       REFERENCES auth.users(id) ON DELETE CASCADE,
  role                 text        NOT NULL DEFAULT 'member'
                       CHECK (role IN ('admin', 'member')),
  full_name            text        NOT NULL,
  is_active            boolean     NOT NULL DEFAULT true,
  must_change_password boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_profiles IS
  'Links a Supabase Auth user to their role in CACI. '
  'Two roles only: admin (full control) or member (self + permitted scope). '
  'Rows are admin-created — not auto-created on sign-up.';
COMMENT ON COLUMN public.user_profiles.role IS
  'admin: full control of all data. '
  'member: own profile + permissions granted by admin.';

CREATE INDEX idx_user_profiles_role      ON public.user_profiles (role);
CREATE INDEX idx_user_profiles_is_active ON public.user_profiles (is_active);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 5: MEMBERSHIP TABLES
-- =============================================================================

-- ── members ───────────────────────────────────────────────────────────────────

CREATE TABLE public.members (
  id                              uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_number               text,                      -- set by assign_membership_number trigger
  title                           text,
  full_name                       text                       NOT NULL,
  date_of_birth                   date,
  gender                          public.gender_type,
  marital_status                  public.marital_status_type,
  occupation                      text,
  location                        text,
  phone_number                    text,
  whatsapp_number                 text,
  membership_status               public.membership_status   NOT NULL DEFAULT 'visitor',
  join_date                       date,
  profile_photo_url               text,
  emergency_contact_name          text,
  emergency_contact_phone         text,
  emergency_contact_relationship  text,
  is_active                       boolean                    NOT NULL DEFAULT true,
  deleted_at                      timestamptz,
  auth_user_id                    uuid                       REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by                      uuid                       REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                      timestamptz                NOT NULL DEFAULT now(),
  updated_at                      timestamptz                NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.members IS
  'Core member registry for CACI. '
  'HARD DELETES ARE BLOCKED BY RLS — no DELETE policy exists for authenticated users. '
  'Admin "delete" always performs a soft delete (deleted_at = now(), is_active = false).';
COMMENT ON COLUMN public.members.membership_number IS
  'Format: CACI-00001. NULL at insert; set by assign_membership_number trigger.';
COMMENT ON COLUMN public.members.auth_user_id IS
  'Supabase Auth user linked to this member. NULL = no app login provisioned yet.';

CREATE INDEX idx_members_active
  ON public.members (membership_status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_deleted_at
  ON public.members (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE UNIQUE INDEX idx_members_membership_number
  ON public.members (membership_number)
  WHERE membership_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_phone_number
  ON public.members (phone_number)
  WHERE phone_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_members_auth_user_id
  ON public.members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX idx_members_fulltext
  ON public.members
  USING GIN (to_tsvector('english', full_name))
  WHERE deleted_at IS NULL;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_members_set_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_assign_membership_number
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.assign_membership_number();


-- ── member_permissions ────────────────────────────────────────────────────────

CREATE TABLE public.member_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  permission  text        NOT NULL
              CHECK (permission IN (
                'members.read',
                'members.write',
                'groups.read',
                'groups.write',
                'broadcasts.read',
                'broadcasts.write',
                'notifications.read'
              )),
  granted_by  uuid        NOT NULL REFERENCES auth.users(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (member_id, permission)
);

COMMENT ON TABLE public.member_permissions IS
  'Named permission grants from admin to individual members. '
  'Members have no access beyond their own profile by default.';

CREATE INDEX idx_member_permissions_member_id ON public.member_permissions (member_id);

ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;


-- ── groups ────────────────────────────────────────────────────────────────────

CREATE TABLE public.groups (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,
  description     text,
  leader_id       uuid        REFERENCES public.members(id) ON DELETE SET NULL,
  messaging_mode  text        NOT NULL DEFAULT 'open'
                  CHECK (messaging_mode IN ('open', 'restricted')),
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.groups IS
  'Departments and groups within CACI. e.g. Choir, Ushers, Youth. No nesting.';
COMMENT ON COLUMN public.groups.messaging_mode IS
  'open: any group member can send messages. '
  'restricted: only the group leader and admin can send.';

CREATE INDEX idx_groups_active
  ON public.groups (is_active)
  WHERE is_active = true;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_groups_set_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── group_members ─────────────────────────────────────────────────────────────

CREATE TABLE public.group_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid        NOT NULL REFERENCES public.groups(id)  ON DELETE CASCADE,
  member_id uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (group_id, member_id)
);

COMMENT ON TABLE public.group_members IS
  'Junction: which members belong to which group. '
  'A member may belong to multiple groups simultaneously.';

CREATE INDEX idx_group_members_group_id  ON public.group_members (group_id);
CREATE INDEX idx_group_members_member_id ON public.group_members (member_id);

-- Supports membership subquery in RLS policies
CREATE INDEX idx_group_members_lookup
  ON public.group_members (group_id, member_id);

-- Fast lookup from auth_user_id → member_id for RLS
CREATE INDEX idx_members_auth_user_lookup
  ON public.members (auth_user_id, id)
  WHERE auth_user_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 6: COMMUNICATION TABLES
-- =============================================================================

-- ── broadcasts ────────────────────────────────────────────────────────────────

CREATE TABLE public.broadcasts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by         uuid        NOT NULL REFERENCES auth.users(id),
  title           text        NOT NULL,
  body            text        NOT NULL,
  target_group_id uuid        REFERENCES public.groups(id) ON DELETE SET NULL,
  targeting_mode  text        NOT NULL DEFAULT 'assembly'
                  CHECK (targeting_mode IN ('assembly', 'group', 'members')),
  attachment_url  text,
  sent_at         timestamptz NOT NULL DEFAULT now(),

  -- targeting_mode and target_group_id must be consistent
  CONSTRAINT broadcasts_targeting_consistency
    CHECK (
      (targeting_mode = 'assembly' AND target_group_id IS NULL)
      OR (targeting_mode = 'group'   AND target_group_id IS NOT NULL)
      OR (targeting_mode = 'members')
    )
);

COMMENT ON TABLE  public.broadcasts IS
  'One-way admin-to-assembly announcements. In-app only for v1. No replies.';
COMMENT ON COLUMN public.broadcasts.targeting_mode IS
  'assembly: whole church (target_group_id must be NULL). '
  'group: one specific group (target_group_id must be set). '
  'members: specific individuals (rows in broadcast_recipients).';
COMMENT ON COLUMN public.broadcasts.attachment_url IS
  'Optional image or PDF attached to this broadcast. Stored in Cloudflare R2.';

CREATE INDEX idx_broadcasts_sent_at      ON public.broadcasts (sent_at DESC);
CREATE INDEX idx_broadcasts_targeting    ON public.broadcasts (targeting_mode, sent_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;


-- ── broadcast_recipients ──────────────────────────────────────────────────────
-- Only populated when targeting_mode = 'members'.

CREATE TABLE public.broadcast_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES public.members(id)    ON DELETE CASCADE,

  UNIQUE (broadcast_id, member_id)
);

COMMENT ON TABLE public.broadcast_recipients IS
  'Junction: individual members targeted by a broadcast. '
  'Only populated when broadcasts.targeting_mode = ''members''. '
  'For assembly and group targeting, fan-out is at query time.';

CREATE INDEX idx_broadcast_recipients_broadcast_id ON public.broadcast_recipients (broadcast_id);
CREATE INDEX idx_broadcast_recipients_member_id    ON public.broadcast_recipients (member_id);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;


-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  broadcast_id uuid        REFERENCES public.broadcasts(id) ON DELETE SET NULL,
  title        text        NOT NULL,
  body         text        NOT NULL,
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'Per-member notification inbox. Written by admin or system only. '
  'Members may only mark their own notifications as read.';

CREATE INDEX idx_notifications_member_unread
  ON public.notifications (member_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_member_all
  ON public.notifications (member_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ── RLS helpers ───────────────────────────────────────────────────────────────
-- Simple role check from user_profiles. No JWT hook needed —
-- role is read directly from the table on each policy evaluation.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.user_profiles
    WHERE  id        = auth.uid()
    AND    role      = 'admin'
    AND    is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.member_permissions mp
    JOIN   public.members m ON m.id = mp.member_id
    WHERE  m.auth_user_id = auth.uid()
    AND    mp.permission  = $1
  )
$$;

COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the calling user has role = admin in user_profiles. '
  'Used in RLS policies across all tables.';

COMMENT ON FUNCTION public.has_permission IS
  'Returns true if the calling member has the given named permission. '
  'Used in RLS policies to grant elevated access to specific members.';


-- =============================================================================
-- SECTION 7: RLS POLICIES
-- =============================================================================

-- ── user_profiles ─────────────────────────────────────────────────────────────

CREATE POLICY "user_profiles_select"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR id = auth.uid()
);

CREATE POLICY "user_profiles_insert"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "user_profiles_update"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR id = auth.uid()
);


-- ── members ───────────────────────────────────────────────────────────────────
-- No DELETE policy — hard deletes blocked at database level.
-- Soft delete via UPDATE (deleted_at = now(), is_active = false).

CREATE POLICY "members_select"
ON public.members FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_admin()
    OR public.has_permission('members.read')
    OR auth_user_id = auth.uid()
  )
);

CREATE POLICY "members_insert"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_permission('members.write')
);

CREATE POLICY "members_update"
ON public.members FOR UPDATE
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_admin()
    OR public.has_permission('members.write')
    OR auth_user_id = auth.uid()
  )
);


-- ── member_permissions ────────────────────────────────────────────────────────

CREATE POLICY "member_permissions_select"
ON public.member_permissions FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "member_permissions_insert"
ON public.member_permissions FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "member_permissions_delete"
ON public.member_permissions FOR DELETE
TO authenticated
USING (public.is_admin());


-- ── groups ────────────────────────────────────────────────────────────────────

CREATE POLICY "groups_select"
ON public.groups FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    public.is_admin()
    OR public.has_permission('groups.read')
  )
);

CREATE POLICY "groups_insert"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_permission('groups.write')
);

CREATE POLICY "groups_update"
ON public.groups FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('groups.write')
);


-- ── group_members ─────────────────────────────────────────────────────────────

CREATE POLICY "group_members_select"
ON public.group_members FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('groups.read')
);

CREATE POLICY "group_members_insert"
ON public.group_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_permission('groups.write')
);

CREATE POLICY "group_members_delete"
ON public.group_members FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('groups.write')
);


-- ── broadcasts ────────────────────────────────────────────────────────────────

CREATE POLICY "broadcasts_select"
ON public.broadcasts FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('broadcasts.read')
);

CREATE POLICY "broadcasts_insert"
ON public.broadcasts FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_permission('broadcasts.write')
);


-- ── broadcast_recipients ──────────────────────────────────────────────────────

CREATE POLICY "broadcast_recipients_select"
ON public.broadcast_recipients FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE  m.id           = broadcast_recipients.member_id
    AND    m.auth_user_id = auth.uid()
  )
);

CREATE POLICY "broadcast_recipients_insert"
ON public.broadcast_recipients FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_permission('broadcasts.write')
);

CREATE POLICY "broadcast_recipients_delete"
ON public.broadcast_recipients FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission('broadcasts.write')
);


-- ── notifications ─────────────────────────────────────────────────────────────

CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE  m.id           = notifications.member_id
    AND    m.auth_user_id = auth.uid()
  )
);

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE  m.id           = notifications.member_id
    AND    m.auth_user_id = auth.uid()
  )
);


-- =============================================================================
-- SECTION 8: TRIGGERS
-- =============================================================================

-- ── Member audit log ──────────────────────────────────────────────────────────

CREATE TABLE public.member_audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  changed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  field_changed text       NOT NULL,
  old_value    text,
  new_value    text,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_audit_log IS
  'Immutable audit trail of field-level changes to member records. '
  'Written only by SECURITY DEFINER triggers.';

CREATE INDEX idx_audit_log_member_id  ON public.member_audit_log (member_id);
CREATE INDEX idx_audit_log_changed_at ON public.member_audit_log (changed_at DESC);

ALTER TABLE public.member_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select"
ON public.member_audit_log FOR SELECT
TO authenticated
USING (public.is_admin());


CREATE OR REPLACE FUNCTION public.write_member_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_field   text;
  v_old_val text;
  v_new_val text;
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'full_name',
    'title',
    'date_of_birth',
    'gender',
    'marital_status',
    'occupation',
    'location',
    'phone_number',
    'whatsapp_number',
    'membership_status',
    'join_date',
    'is_active',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_relationship'
  ]
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_old_val, v_new_val
      USING OLD, NEW;

    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO public.member_audit_log (
        member_id, changed_by, field_changed, old_value, new_value
      ) VALUES (
        NEW.id, auth.uid(), v_field, v_old_val, v_new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_write_member_audit_log
  AFTER UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.write_member_audit_log();


-- ── Soft delete audit ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_member_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.member_audit_log (
      member_id, changed_by, field_changed, old_value, new_value
    ) VALUES (
      NEW.id, auth.uid(),
      'MEMBER_DELETED',
      'active',
      'soft_deleted'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_member_soft_delete
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.log_member_soft_delete();


-- =============================================================================
-- POST-MIGRATION CHECKLIST
-- =============================================================================
-- ☐ Run this migration on a fresh Supabase project
-- ☐ Create first admin user in Supabase Auth
-- ☐ Insert user_profiles row: role = 'admin', is_active = true
-- ☐ Create a member row linked to that admin (auth_user_id = admin uuid)
-- ☐ Log in and verify RLS: admin can see all members
-- ☐ Test: create a member → confirm membership number CACI-00001
-- ☐ Test: soft delete a member → confirm deleted_at is set, member disappears
-- ☐ Test: member can only see own profile without permissions
-- ☐ Configure Supabase Storage bucket: 'media' (public read, auth write)
-- ☐ Set up Cloudflare R2 bucket for broadcast attachments (larger files)
-- ☐ Write Edge Function: get-upload-url (signs R2 URL for broadcast attachments)
-- =============================================================================
