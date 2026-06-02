-- ─────────────────────────────────────────────────────────────────────────────
-- Pastoral Care Module — Full Schema
-- Migration: 20260602000001_create_pastoral_care_module.sql
-- Tables: pastoral_cases, pastoral_visits, prayer_requests
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE pastoral_case_type AS ENUM (
  'follow_up',       -- absent / missing member
  'bereavement',     -- death in family
  'illness',         -- sick member or family
  'counselling',     -- personal counselling
  'discipline',      -- church discipline matter
  'other'
);

CREATE TYPE pastoral_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE pastoral_case_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE visit_type AS ENUM (
  'home_visit',
  'hospital_visit',
  'phone_call',
  'video_call',
  'in_person'        -- at church premises
);

CREATE TYPE visit_outcome AS ENUM (
  'positive',
  'needs_follow_up',
  'no_response',
  'referred'         -- escalated to senior pastor
);

CREATE TYPE prayer_request_status AS ENUM (
  'active',
  'answered',
  'closed'
);


-- ── pastoral_cases ────────────────────────────────────────────────────────────
-- Private. Visible to assigned_to + admins only.
-- Can be opened by a pastor OR a group leader.

CREATE TABLE pastoral_cases (
  id           uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid                 NOT NULL REFERENCES assemblies(id),
  member_id    uuid                 NOT NULL REFERENCES members(id),
  case_type    pastoral_case_type   NOT NULL,
  title        text                 NOT NULL,
  description  text,
  priority     pastoral_priority    NOT NULL DEFAULT 'medium',
  status       pastoral_case_status NOT NULL DEFAULT 'open',
  assigned_to  uuid                 REFERENCES auth.users(id),  -- pastor or group leader
  is_private   boolean              NOT NULL DEFAULT true,       -- extra lock for sensitive cases
  created_by   uuid                 REFERENCES auth.users(id),
  created_at   timestamptz          NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  deleted_at   timestamptz,
  deleted_by   uuid                 REFERENCES auth.users(id),

  -- prevent duplicate open cases of same type for same member
  CONSTRAINT uq_open_case
    UNIQUE (assembly_id, member_id, case_type, status)
    DEFERRABLE INITIALLY DEFERRED
);


-- ── pastoral_visits ───────────────────────────────────────────────────────────
-- Child of pastoral_cases.
-- Each follow-up action is one row.

CREATE TABLE pastoral_visits (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid          NOT NULL REFERENCES pastoral_cases(id),
  member_id       uuid          NOT NULL REFERENCES members(id),
  visited_by      uuid          NOT NULL REFERENCES auth.users(id),
  visit_type      visit_type    NOT NULL,
  visit_date      date          NOT NULL,
  notes           text,                     -- private — not shown to member
  outcome         visit_outcome NOT NULL DEFAULT 'positive',
  next_visit_date date,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid          REFERENCES auth.users(id)
);


-- ── prayer_requests ───────────────────────────────────────────────────────────
-- Lighter and shared across pastoral staff.
-- Anonymous flag hides member_id in app layer.

CREATE TABLE prayer_requests (
  id           uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid                   NOT NULL REFERENCES assemblies(id),
  member_id    uuid                   REFERENCES members(id),  -- nullable for anonymous
  title        text                   NOT NULL,
  description  text,
  is_anonymous boolean                NOT NULL DEFAULT false,
  status       prayer_request_status  NOT NULL DEFAULT 'active',
  is_answered  boolean                NOT NULL DEFAULT false,
  answered_at  timestamptz,
  created_at   timestamptz            NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid                   REFERENCES auth.users(id),

  CONSTRAINT uq_prayer_request
    UNIQUE (assembly_id, member_id, title)
);


-- ── Indexes ───────────────────────────────────────────────────────────────────

-- pastoral_cases
CREATE INDEX idx_pc_assembly
  ON pastoral_cases (assembly_id);

CREATE INDEX idx_pc_member
  ON pastoral_cases (member_id);

-- powers "my open cases" dashboard per pastor/leader
CREATE INDEX idx_pc_assigned_status
  ON pastoral_cases (assigned_to, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pc_priority
  ON pastoral_cases (assembly_id, priority)
  WHERE status != 'closed' AND deleted_at IS NULL;

-- pastoral_visits
CREATE INDEX idx_pv_case
  ON pastoral_visits (case_id);

CREATE INDEX idx_pv_member
  ON pastoral_visits (member_id);

CREATE INDEX idx_pv_visited_by
  ON pastoral_visits (visited_by);

-- powers "upcoming follow-ups" view
CREATE INDEX idx_pv_next_visit
  ON pastoral_visits (next_visit_date)
  WHERE next_visit_date IS NOT NULL
    AND deleted_at IS NULL;

-- prayer_requests
CREATE INDEX idx_pr_assembly
  ON prayer_requests (assembly_id);

CREATE INDEX idx_pr_member
  ON prayer_requests (member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX idx_pr_active
  ON prayer_requests (assembly_id, status)
  WHERE deleted_at IS NULL;


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE pastoral_cases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests  ENABLE ROW LEVEL SECURITY;


-- Helper: checks the current user has the given pastoral permission.
-- Mirrors has_finance_permission() pattern — hooks into system_permissions /
-- role_permissions tables.
CREATE OR REPLACE FUNCTION has_pastoral_permission(perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN assembly_roles ar
      ON ar.id = (
        SELECT assembly_role_id FROM user_profiles
        WHERE id = auth.uid()
      )
    JOIN system_permissions sp
      ON sp.id = rp.permission_key
    WHERE sp.key = perm
      AND ar.assembly_id = auth_assembly_id()
  )
$$;


-- ── pastoral_cases RLS ────────────────────────────────────────────────────────
-- Read: assigned pastor OR case creator OR non-private cases (all pastoral staff) OR admin
-- Write: assigned pastor OR case creator OR admin

CREATE POLICY "pc: read assigned or admin"
  ON pastoral_cases FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND (
      assigned_to = auth.uid()           -- assigned pastor/leader
      OR created_by = auth.uid()         -- whoever opened the case
      OR is_private = false              -- non-private visible to all pastoral staff
      OR EXISTS (                        -- assembly admin override
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
          AND assembly_id = auth_assembly_id()
          AND role = 'admin'
      )
    )
    AND has_pastoral_permission('pastoral.view')
  );

CREATE POLICY "pc: insert own assembly"
  ON pastoral_cases FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_pastoral_permission('pastoral.manage')
  );

CREATE POLICY "pc: update assigned or admin"
  ON pastoral_cases FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
          AND assembly_id = auth_assembly_id()
          AND role = 'admin'
      )
    )
    AND has_pastoral_permission('pastoral.manage')
  );


-- ── pastoral_visits RLS ───────────────────────────────────────────────────────
-- Scoped through parent pastoral_case.

CREATE POLICY "pv: read via case access"
  ON pastoral_visits FOR SELECT
  USING (
    deleted_at IS NULL
    AND has_pastoral_permission('pastoral.view')
    AND EXISTS (
      SELECT 1 FROM pastoral_cases pc
      WHERE pc.id = pastoral_visits.case_id
        AND pc.assembly_id = auth_assembly_id()
        AND pc.deleted_at IS NULL
        AND (
          pc.assigned_to = auth.uid()
          OR pc.created_by = auth.uid()
          OR pc.is_private = false
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
              AND assembly_id = auth_assembly_id()
              AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY "pv: insert via case access"
  ON pastoral_visits FOR INSERT
  WITH CHECK (
    has_pastoral_permission('pastoral.manage')
    AND EXISTS (
      SELECT 1 FROM pastoral_cases pc
      WHERE pc.id = case_id
        AND pc.assembly_id = auth_assembly_id()
        AND (
          pc.assigned_to = auth.uid()
          OR pc.created_by = auth.uid()
        )
    )
  );

CREATE POLICY "pv: update own visits"
  ON pastoral_visits FOR UPDATE
  USING (
    visited_by = auth.uid()
    AND deleted_at IS NULL
    AND has_pastoral_permission('pastoral.manage')
  );


-- ── prayer_requests RLS ───────────────────────────────────────────────────────
-- All pastoral staff can read non-anonymous.
-- Anonymous: member_id hidden at app layer —
-- DB still stores it for admin audit purposes.

CREATE POLICY "pr: read own assembly staff"
  ON prayer_requests FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_pastoral_permission('pastoral.view')
  );

CREATE POLICY "pr: insert own assembly"
  ON prayer_requests FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_pastoral_permission('pastoral.manage')
  );

CREATE POLICY "pr: update own or admin"
  ON prayer_requests FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_pastoral_permission('pastoral.manage')
    AND (
      member_id = (
        SELECT m.id FROM members m
        WHERE m.auth_user_id = auth.uid()
          AND m.assembly_id = auth_assembly_id()
        LIMIT 1
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
          AND assembly_id = auth_assembly_id()
          AND role = 'admin'
      )
    )
  );


-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON pastoral_cases   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pastoral_visits  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON prayer_requests  TO authenticated;
