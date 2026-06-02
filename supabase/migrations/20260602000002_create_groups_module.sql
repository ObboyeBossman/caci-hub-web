-- ─────────────────────────────────────────────────────────────────────────────
-- Groups Module — Full Schema
-- Migration: 20260602000002_create_groups_module.sql
-- Tables: groups, group_members
-- Note: auth_assembly_id() is already defined in an earlier migration.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE group_type AS ENUM (
  'department',   -- choir, ushers, media, etc.
  'age_group'     -- youth, children, men, women
);

CREATE TYPE group_member_role AS ENUM (
  'leader',
  'assistant_leader',
  'member'
);


-- ── groups ────────────────────────────────────────────────────────────────────
-- Flat structure — no nesting. group_type enum locks to department | age_group.

CREATE TABLE groups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid        NOT NULL REFERENCES assemblies(id),
  name         text        NOT NULL,
  group_type   group_type  NOT NULL,
  description  text,
  is_active    boolean     NOT NULL DEFAULT true,
  leader_id    uuid        REFERENCES members(id),
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid        REFERENCES auth.users(id),

  -- no two groups with the same name and type in an assembly
  CONSTRAINT uq_group_name
    UNIQUE (assembly_id, name, group_type)
);


-- ── group_members ─────────────────────────────────────────────────────────────
-- Links a member to a group with a role and active window.
-- One member can belong to multiple groups.

CREATE TABLE group_members (
  id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid              NOT NULL REFERENCES groups(id),
  member_id   uuid              NOT NULL REFERENCES members(id),
  role        group_member_role NOT NULL DEFAULT 'member',
  joined_at   date              NOT NULL DEFAULT current_date,
  left_at     date,
  is_active   boolean           NOT NULL DEFAULT true,
  created_by  uuid              REFERENCES auth.users(id),
  created_at  timestamptz       NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  uuid              REFERENCES auth.users(id),

  -- one active membership per member per group at a time
  CONSTRAINT uq_active_membership
    UNIQUE (group_id, member_id)
);


-- ── Indexes ───────────────────────────────────────────────────────────────────

-- groups
CREATE INDEX idx_groups_assembly
  ON groups (assembly_id);

CREATE INDEX idx_groups_active
  ON groups (assembly_id, group_type)
  WHERE is_active = true AND deleted_at IS NULL;

-- group_members
CREATE INDEX idx_gm_group
  ON group_members (group_id);

CREATE INDEX idx_gm_member
  ON group_members (member_id);

-- powers "list active members of a group"
CREATE INDEX idx_gm_active
  ON group_members (group_id, is_active)
  WHERE is_active = true AND deleted_at IS NULL;

-- powers "list all groups a member belongs to"
CREATE INDEX idx_gm_member_active
  ON group_members (member_id)
  WHERE is_active = true AND deleted_at IS NULL;


-- ── Row Level Security ────────────────────────────────────────────────────────
-- auth_assembly_id() is already defined — no need to redefine it.

ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;


-- groups RLS
CREATE POLICY "groups: read own assembly"
  ON groups FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "groups: insert own assembly"
  ON groups FOR INSERT
  WITH CHECK (assembly_id = auth_assembly_id());

CREATE POLICY "groups: update own assembly"
  ON groups FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );


-- group_members RLS
-- Scoped through parent groups table.

CREATE POLICY "gm: read own assembly"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND g.assembly_id = auth_assembly_id()
        AND g.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "gm: insert own assembly"
  ON group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND g.assembly_id = auth_assembly_id()
    )
  );

CREATE POLICY "gm: update own assembly"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND g.assembly_id = auth_assembly_id()
    )
    AND deleted_at IS NULL
  );

-- members can read their own group memberships
CREATE POLICY "gm: members read own"
  ON group_members FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assembly_id = auth_assembly_id()
    )
  );


-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON groups        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON group_members TO authenticated;
