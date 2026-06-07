-- ─────────────────────────────────────────────────────────────────────────────
-- Services Module — Full Schema
-- Migration: 20260602000003_create_services_module.sql
-- Tables: service_templates, services, service_attendance, service_audit_log
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE service_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled'
);

CREATE TYPE attendance_status AS ENUM (
  'present',
  'absent',
  'excused'
);

CREATE TYPE recurrence_type AS ENUM (
  'none',
  'daily',
  'weekly',
  'biweekly',
  'monthly'
);


-- ── service_templates ─────────────────────────────────────────────────────────
-- Recurring service blueprints. group_id = NULL means open to all members.

CREATE TABLE service_templates (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id         uuid            NOT NULL REFERENCES assemblies(id),
  group_id            uuid            REFERENCES groups(id),      -- NULL = open to all
  title               text            NOT NULL,
  service_type        text            NOT NULL,
  recurrence          recurrence_type NOT NULL DEFAULT 'weekly',
  day_of_week         text,
  start_time          time,
  venue               text,
  recurrence_end_date date,
  is_active           boolean         NOT NULL DEFAULT true,
  created_by          uuid            REFERENCES auth.users(id),
  created_at          timestamptz     NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  deleted_by          uuid            REFERENCES auth.users(id),

  CONSTRAINT uq_template_assembly_title
    UNIQUE (assembly_id, title, recurrence, day_of_week)
);


-- ── services ──────────────────────────────────────────────────────────────────
-- Individual service instances. Can optionally be linked to a template.

CREATE TABLE services (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid           NOT NULL REFERENCES assemblies(id),
  template_id  uuid           REFERENCES service_templates(id),
  group_id     uuid           REFERENCES groups(id),      -- NULL = open to all
  title        text           NOT NULL,
  service_type text           NOT NULL,
  service_date date           NOT NULL,
  start_time   time,
  venue        text,
  headcount    integer        CHECK (headcount >= 0),
  notes        text,
  status       service_status NOT NULL DEFAULT 'scheduled',
  created_by   uuid           REFERENCES auth.users(id),
  created_at   timestamptz    NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid           REFERENCES auth.users(id),

  CONSTRAINT uq_service_per_day
    UNIQUE (assembly_id, group_id, service_date, service_type)
);


-- ── service_attendance ────────────────────────────────────────────────────────
-- One row per member per service. Soft-deletable.

CREATE TABLE service_attendance (
  id         uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid              NOT NULL REFERENCES services(id),
  member_id  uuid              NOT NULL REFERENCES members(id),
  status     attendance_status NOT NULL DEFAULT 'present',
  notes      text,
  marked_by  uuid              REFERENCES auth.users(id),
  marked_at  timestamptz       NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid              REFERENCES auth.users(id),

  -- one record per member per service
  CONSTRAINT uq_attendance_per_service
    UNIQUE (service_id, member_id)
);


-- ── service_audit_log ─────────────────────────────────────────────────────────
-- Append-only. Never updated or deleted.
-- Populated by the log_service_changes() trigger.

CREATE TABLE service_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid        NOT NULL REFERENCES services(id),
  changed_by    uuid        REFERENCES auth.users(id),
  field_changed text        NOT NULL,
  old_value     text,
  new_value     text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);


-- ── Indexes ───────────────────────────────────────────────────────────────────

-- service_templates
CREATE INDEX idx_tmpl_assembly
  ON service_templates (assembly_id);

CREATE INDEX idx_tmpl_group
  ON service_templates (group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX idx_tmpl_active
  ON service_templates (assembly_id, is_active)
  WHERE deleted_at IS NULL;

-- services
CREATE INDEX idx_svc_assembly
  ON services (assembly_id);

CREATE INDEX idx_svc_template
  ON services (template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX idx_svc_group
  ON services (group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX idx_svc_date
  ON services (service_date);

CREATE INDEX idx_svc_active
  ON services (assembly_id, service_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_svc_status
  ON services (status)
  WHERE deleted_at IS NULL;

-- service_attendance
CREATE INDEX idx_att_service
  ON service_attendance (service_id);

CREATE INDEX idx_att_member
  ON service_attendance (member_id);

CREATE INDEX idx_att_active
  ON service_attendance (service_id)
  WHERE deleted_at IS NULL;

-- powers "absent 3+ weeks" query
CREATE INDEX idx_att_status
  ON service_attendance (member_id, status)
  WHERE deleted_at IS NULL;

-- service_audit_log
CREATE INDEX idx_audit_service
  ON service_audit_log (service_id);

CREATE INDEX idx_audit_changed_at
  ON service_audit_log (changed_at);


-- ── Row Level Security ────────────────────────────────────────────────────────
-- auth_assembly_id() is already defined — no need to redefine it.

ALTER TABLE service_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_audit_log   ENABLE ROW LEVEL SECURITY;


-- service_templates
CREATE POLICY "tmpl: read own assembly"
  ON service_templates FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "tmpl: insert own assembly"
  ON service_templates FOR INSERT
  WITH CHECK (assembly_id = auth_assembly_id());

CREATE POLICY "tmpl: update own assembly"
  ON service_templates FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );


-- services
CREATE POLICY "svc: read own assembly"
  ON services FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "svc: insert own assembly"
  ON services FOR INSERT
  WITH CHECK (assembly_id = auth_assembly_id());

CREATE POLICY "svc: update own assembly"
  ON services FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
  );


-- service_attendance — scoped through parent services table
CREATE POLICY "att: read own assembly"
  ON service_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_attendance.service_id
        AND s.assembly_id = auth_assembly_id()
        AND s.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "att: insert own assembly"
  ON service_attendance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id
        AND s.assembly_id = auth_assembly_id()
    )
  );

CREATE POLICY "att: update own assembly"
  ON service_attendance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_attendance.service_id
        AND s.assembly_id = auth_assembly_id()
    )
    AND deleted_at IS NULL
  );


-- service_audit_log — read + insert only; no UPDATE or DELETE (immutable)
CREATE POLICY "audit: read own assembly"
  ON service_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_audit_log.service_id
        AND s.assembly_id = auth_assembly_id()
    )
  );

CREATE POLICY "audit: insert only"
  ON service_audit_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id
        AND s.assembly_id = auth_assembly_id()
    )
  );


-- ── Audit Trigger ─────────────────────────────────────────────────────────────
-- Fires after every UPDATE on services.
-- Compares old vs new for each tracked field and inserts one row per change.

CREATE OR REPLACE FUNCTION log_service_changes()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  col     text;
  old_val text;
  new_val text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'title', 'status', 'service_date',
    'start_time', 'venue', 'headcount',
    'notes', 'group_id', 'deleted_at'
  ] LOOP
    EXECUTE format('SELECT ($1).%I::text', col)
      INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', col)
      INTO new_val USING NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO service_audit_log (
        service_id, changed_by,
        field_changed, old_value, new_value
      ) VALUES (
        NEW.id, auth.uid(),
        col, old_val, new_val
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_audit
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION log_service_changes();


-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON service_templates   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON services            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON service_attendance  TO authenticated;
GRANT SELECT, INSERT         ON service_audit_log   TO authenticated;
