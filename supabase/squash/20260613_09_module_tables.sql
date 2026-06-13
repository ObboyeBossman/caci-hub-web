-- =============================================================================
-- CACI Hub — Squashed Migration 09: Module Tables
-- Final state of: groups, group_members, pastoral_cases, pastoral_visits,
--   prayer_requests, service_templates, services, service_attendance,
--   service_audit_log, finance_categories, finance_pledges,
--   finance_transactions, finance_budgets
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Groups Module
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.groups (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid             NOT NULL REFERENCES public.assemblies(id),
  name        text             NOT NULL,
  group_type  public.group_type NOT NULL,
  description text,
  is_active   boolean          NOT NULL DEFAULT true,
  leader_id   uuid             REFERENCES public.members(id),
  created_by  uuid             REFERENCES auth.users(id),
  created_at  timestamptz      NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  uuid             REFERENCES auth.users(id),
  CONSTRAINT uq_group_name UNIQUE (assembly_id, name, group_type)
);

CREATE TABLE public.group_members (
  id         uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid                    NOT NULL REFERENCES public.groups(id),
  member_id  uuid                    NOT NULL REFERENCES public.members(id),
  role       public.group_member_role NOT NULL DEFAULT 'member',
  joined_at  date                    NOT NULL DEFAULT current_date,
  left_at    date,
  is_active  boolean                 NOT NULL DEFAULT true,
  created_by uuid                    REFERENCES auth.users(id),
  created_at timestamptz             NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid                    REFERENCES auth.users(id),
  CONSTRAINT uq_active_membership UNIQUE (group_id, member_id)
);

-- Indexes
CREATE INDEX idx_groups_assembly  ON public.groups (assembly_id);
CREATE INDEX idx_groups_active    ON public.groups (assembly_id, group_type)
  WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_gm_group         ON public.group_members (group_id);
CREATE INDEX idx_gm_member        ON public.group_members (member_id);
CREATE INDEX idx_gm_active        ON public.group_members (group_id, is_active)
  WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_gm_member_active ON public.group_members (member_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- RLS
ALTER TABLE public.groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups: read own assembly"
  ON public.groups FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);

CREATE POLICY "groups: insert own assembly"
  ON public.groups FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id());

CREATE POLICY "groups: update own assembly"
  ON public.groups FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);

CREATE POLICY "gm: read own assembly"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = public.group_members.group_id
        AND g.assembly_id = public.auth_assembly_id()
        AND g.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "gm: insert own assembly"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND g.assembly_id = public.auth_assembly_id()
    )
  );

CREATE POLICY "gm: update own assembly"
  ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = public.group_members.group_id
        AND g.assembly_id = public.auth_assembly_id()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "gm: members read own"
  ON public.group_members FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM public.members
      WHERE assembly_id = public.auth_assembly_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.groups        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.group_members TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Pastoral Care Module
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.pastoral_cases (
  id          uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid                      NOT NULL REFERENCES public.assemblies(id),
  member_id   uuid                      NOT NULL REFERENCES public.members(id),
  case_type   public.pastoral_case_type  NOT NULL,
  title       text                      NOT NULL,
  description text,
  priority    public.pastoral_priority   NOT NULL DEFAULT 'medium',
  status      public.pastoral_case_status NOT NULL DEFAULT 'open',
  assigned_to uuid                      REFERENCES auth.users(id),
  is_private  boolean                   NOT NULL DEFAULT true,
  created_by  uuid                      REFERENCES auth.users(id),
  created_at  timestamptz               NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  deleted_at  timestamptz,
  deleted_by  uuid                      REFERENCES auth.users(id),
  CONSTRAINT uq_open_case
    UNIQUE (assembly_id, member_id, case_type, status)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.pastoral_visits (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid               NOT NULL REFERENCES public.pastoral_cases(id),
  member_id       uuid               NOT NULL REFERENCES public.members(id),
  visited_by      uuid               NOT NULL REFERENCES auth.users(id),
  visit_type      public.visit_type   NOT NULL,
  visit_date      date               NOT NULL,
  notes           text,
  outcome         public.visit_outcome NOT NULL DEFAULT 'positive',
  next_visit_date date,
  created_at      timestamptz        NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid               REFERENCES auth.users(id)
);

CREATE TABLE public.prayer_requests (
  id           uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid                        NOT NULL REFERENCES public.assemblies(id),
  member_id    uuid                        REFERENCES public.members(id),
  title        text                        NOT NULL,
  description  text,
  is_anonymous boolean                     NOT NULL DEFAULT false,
  status       public.prayer_request_status NOT NULL DEFAULT 'active',
  is_answered  boolean                     NOT NULL DEFAULT false,
  answered_at  timestamptz,
  created_at   timestamptz                 NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid                        REFERENCES auth.users(id),
  CONSTRAINT uq_prayer_request UNIQUE (assembly_id, member_id, title)
);

-- Indexes
CREATE INDEX idx_pc_assembly        ON public.pastoral_cases (assembly_id);
CREATE INDEX idx_pc_member          ON public.pastoral_cases (member_id);
CREATE INDEX idx_pc_assigned_status ON public.pastoral_cases (assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_priority        ON public.pastoral_cases (assembly_id, priority) WHERE status != 'closed' AND deleted_at IS NULL;
CREATE INDEX idx_pv_case            ON public.pastoral_visits (case_id);
CREATE INDEX idx_pv_member          ON public.pastoral_visits (member_id);
CREATE INDEX idx_pv_visited_by      ON public.pastoral_visits (visited_by);
CREATE INDEX idx_pv_next_visit      ON public.pastoral_visits (next_visit_date) WHERE next_visit_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_pr_assembly        ON public.prayer_requests (assembly_id);
CREATE INDEX idx_pr_member          ON public.prayer_requests (member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_pr_active          ON public.prayer_requests (assembly_id, status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.pastoral_cases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastoral_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc: read assigned or admin"
  ON public.pastoral_cases FOR SELECT
  USING (
    assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (
      assigned_to = auth.uid() OR created_by = auth.uid() OR is_private = false
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND assembly_id = public.auth_assembly_id() AND role = 'admin')
    )
    AND public.has_pastoral_permission('pastoral.view')
  );

CREATE POLICY "pc: insert own assembly"
  ON public.pastoral_cases FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_pastoral_permission('pastoral.manage'));

CREATE POLICY "pc: update assigned or admin"
  ON public.pastoral_cases FOR UPDATE
  USING (
    assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (
      assigned_to = auth.uid() OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND assembly_id = public.auth_assembly_id() AND role = 'admin')
    )
    AND public.has_pastoral_permission('pastoral.manage')
  );

CREATE POLICY "pv: read via case access"
  ON public.pastoral_visits FOR SELECT
  USING (
    deleted_at IS NULL AND public.has_pastoral_permission('pastoral.view')
    AND EXISTS (
      SELECT 1 FROM public.pastoral_cases pc
      WHERE pc.id = public.pastoral_visits.case_id
        AND pc.assembly_id = public.auth_assembly_id() AND pc.deleted_at IS NULL
        AND (pc.assigned_to = auth.uid() OR pc.created_by = auth.uid() OR pc.is_private = false
             OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND assembly_id = public.auth_assembly_id() AND role = 'admin'))
    )
  );

CREATE POLICY "pv: insert via case access"
  ON public.pastoral_visits FOR INSERT
  WITH CHECK (
    public.has_pastoral_permission('pastoral.manage')
    AND EXISTS (
      SELECT 1 FROM public.pastoral_cases pc
      WHERE pc.id = case_id AND pc.assembly_id = public.auth_assembly_id()
        AND (pc.assigned_to = auth.uid() OR pc.created_by = auth.uid())
    )
  );

CREATE POLICY "pv: update own visits"
  ON public.pastoral_visits FOR UPDATE
  USING (visited_by = auth.uid() AND deleted_at IS NULL AND public.has_pastoral_permission('pastoral.manage'));

CREATE POLICY "pr: read own assembly staff"
  ON public.prayer_requests FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.has_pastoral_permission('pastoral.view'));

CREATE POLICY "pr: insert own assembly"
  ON public.prayer_requests FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_pastoral_permission('pastoral.manage'));

CREATE POLICY "pr: update own or admin"
  ON public.prayer_requests FOR UPDATE
  USING (
    assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND public.has_pastoral_permission('pastoral.manage')
    AND (
      member_id = (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid() AND m.assembly_id = public.auth_assembly_id() LIMIT 1)
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND assembly_id = public.auth_assembly_id() AND role = 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.pastoral_cases   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pastoral_visits  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prayer_requests  TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Services Module
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.service_templates (
  id                  uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id         uuid                   NOT NULL REFERENCES public.assemblies(id),
  group_id            uuid                   REFERENCES public.groups(id),
  title               text                   NOT NULL,
  service_type        text                   NOT NULL,
  recurrence          public.recurrence_type  NOT NULL DEFAULT 'weekly',
  day_of_week         text,
  start_time          time,
  venue               text,
  recurrence_end_date date,
  is_active           boolean                NOT NULL DEFAULT true,
  created_by          uuid                   REFERENCES auth.users(id),
  created_at          timestamptz            NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  deleted_by          uuid                   REFERENCES auth.users(id),
  CONSTRAINT uq_template_assembly_title UNIQUE (assembly_id, title, recurrence, day_of_week)
);

CREATE TABLE public.services (
  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid                  NOT NULL REFERENCES public.assemblies(id),
  template_id  uuid                  REFERENCES public.service_templates(id),
  group_id     uuid                  REFERENCES public.groups(id),
  title        text                  NOT NULL,
  service_type text                  NOT NULL,
  service_date date                  NOT NULL,
  start_time   time,
  venue        text,
  headcount    integer               CHECK (headcount >= 0),
  notes        text,
  status       public.service_status  NOT NULL DEFAULT 'scheduled',
  created_by   uuid                  REFERENCES auth.users(id),
  created_at   timestamptz           NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid                  REFERENCES auth.users(id),
  CONSTRAINT uq_service_per_day UNIQUE (assembly_id, group_id, service_date, service_type)
);

CREATE TABLE public.service_attendance (
  id         uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid                     NOT NULL REFERENCES public.services(id),
  member_id  uuid                     NOT NULL REFERENCES public.members(id),
  status     public.attendance_status  NOT NULL DEFAULT 'present',
  notes      text,
  marked_by  uuid                     REFERENCES auth.users(id),
  marked_at  timestamptz              NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid                     REFERENCES auth.users(id),
  CONSTRAINT uq_attendance_per_service UNIQUE (service_id, member_id)
);

CREATE TABLE public.service_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid        NOT NULL REFERENCES public.services(id),
  changed_by    uuid        REFERENCES auth.users(id),
  field_changed text        NOT NULL,
  old_value     text,
  new_value     text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tmpl_assembly  ON public.service_templates (assembly_id);
CREATE INDEX idx_tmpl_group     ON public.service_templates (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_tmpl_active    ON public.service_templates (assembly_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_svc_assembly   ON public.services (assembly_id);
CREATE INDEX idx_svc_template   ON public.services (template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_svc_group      ON public.services (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_svc_date       ON public.services (service_date);
CREATE INDEX idx_svc_active     ON public.services (assembly_id, service_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_svc_status     ON public.services (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_att_service    ON public.service_attendance (service_id);
CREATE INDEX idx_att_member     ON public.service_attendance (member_id);
CREATE INDEX idx_att_active     ON public.service_attendance (service_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_att_status     ON public.service_attendance (member_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_service  ON public.service_audit_log (service_id);
CREATE INDEX idx_audit_changed_at ON public.service_audit_log (changed_at);

-- RLS
ALTER TABLE public.service_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_audit_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmpl: read own assembly" ON public.service_templates FOR SELECT USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);
CREATE POLICY "tmpl: insert own assembly" ON public.service_templates FOR INSERT WITH CHECK (assembly_id = public.auth_assembly_id());
CREATE POLICY "tmpl: update own assembly" ON public.service_templates FOR UPDATE USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);

CREATE POLICY "svc: read own assembly" ON public.services FOR SELECT USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);
CREATE POLICY "svc: insert own assembly" ON public.services FOR INSERT WITH CHECK (assembly_id = public.auth_assembly_id());
CREATE POLICY "svc: update own assembly" ON public.services FOR UPDATE USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);

CREATE POLICY "att: read own assembly" ON public.service_attendance FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.services s WHERE s.id = public.service_attendance.service_id AND s.assembly_id = public.auth_assembly_id() AND s.deleted_at IS NULL) AND deleted_at IS NULL);
CREATE POLICY "att: insert own assembly" ON public.service_attendance FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.assembly_id = public.auth_assembly_id()));
CREATE POLICY "att: update own assembly" ON public.service_attendance FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.services s WHERE s.id = public.service_attendance.service_id AND s.assembly_id = public.auth_assembly_id()) AND deleted_at IS NULL);

CREATE POLICY "audit: read own assembly" ON public.service_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.services s WHERE s.id = public.service_audit_log.service_id AND s.assembly_id = public.auth_assembly_id()));
CREATE POLICY "audit: insert only" ON public.service_audit_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.assembly_id = public.auth_assembly_id()));

GRANT SELECT, INSERT, UPDATE ON public.service_templates  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.services           TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_attendance TO authenticated;
GRANT SELECT, INSERT         ON public.service_audit_log  TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Finance Module
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.finance_categories (
  id            uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id   uuid                        NOT NULL REFERENCES public.assemblies(id),
  name          text                        NOT NULL,
  category_type public.finance_category_type NOT NULL,
  description   text,
  is_active     boolean                     NOT NULL DEFAULT true,
  created_by    uuid                        REFERENCES auth.users(id),
  created_at    timestamptz                 NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    uuid                        REFERENCES auth.users(id),
  CONSTRAINT uq_category_name UNIQUE (assembly_id, name, category_type)
);

CREATE TABLE public.finance_pledges (
  id           uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid                       NOT NULL REFERENCES public.assemblies(id),
  member_id    uuid                       NOT NULL REFERENCES public.members(id),
  pledge_name  text                       NOT NULL,
  total_amount numeric(12,2)              NOT NULL CHECK (total_amount > 0),
  amount_paid  numeric(12,2)              NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency     text                       NOT NULL DEFAULT 'GHS',
  start_date   date                       NOT NULL DEFAULT current_date,
  end_date     date,
  status       public.finance_pledge_status NOT NULL DEFAULT 'active',
  notes        text,
  created_by   uuid                       REFERENCES auth.users(id),
  created_at   timestamptz                NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid                       REFERENCES auth.users(id),
  CONSTRAINT chk_pledge_amount CHECK (amount_paid <= total_amount),
  CONSTRAINT uq_pledge UNIQUE (assembly_id, member_id, pledge_name)
);

CREATE TABLE public.finance_transactions (
  id               uuid                           PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid                           NOT NULL REFERENCES public.assemblies(id),
  category_id      uuid                           NOT NULL REFERENCES public.finance_categories(id),
  member_id        uuid                           REFERENCES public.members(id),
  transaction_type public.finance_transaction_type NOT NULL,
  amount           numeric(12,2)                  NOT NULL CHECK (amount > 0),
  currency         text                           NOT NULL DEFAULT 'GHS',
  payment_method   public.finance_payment_method   NOT NULL,
  reference_number text,
  transaction_date date                           NOT NULL DEFAULT current_date,
  description      text,
  service_id       uuid                           REFERENCES public.services(id),
  group_id         uuid                           REFERENCES public.groups(id),
  pledge_id        uuid                           REFERENCES public.finance_pledges(id),
  recorded_by      uuid                           REFERENCES auth.users(id),
  created_at       timestamptz                    NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid                           REFERENCES auth.users(id),
  CONSTRAINT uq_transaction_reference UNIQUE (assembly_id, reference_number) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.finance_budgets (
  id              uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id     uuid                       NOT NULL REFERENCES public.assemblies(id),
  category_id     uuid                       NOT NULL REFERENCES public.finance_categories(id),
  period          public.finance_budget_period NOT NULL,
  year            integer                    NOT NULL CHECK (year >= 2000),
  month           integer                    CHECK (month BETWEEN 1 AND 12),
  quarter         integer                    CHECK (quarter BETWEEN 1 AND 4),
  budgeted_amount numeric(12,2)              NOT NULL CHECK (budgeted_amount >= 0),
  actual_amount   numeric(12,2)              NOT NULL DEFAULT 0,
  notes           text,
  created_by      uuid                       REFERENCES auth.users(id),
  created_at      timestamptz                NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid                       REFERENCES auth.users(id),
  CONSTRAINT uq_budget_period UNIQUE (assembly_id, category_id, period, year, month, quarter)
);

-- Indexes
CREATE INDEX idx_fcat_assembly    ON public.finance_categories (assembly_id);
CREATE INDEX idx_fcat_active      ON public.finance_categories (assembly_id, category_type) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_ftx_assembly     ON public.finance_transactions (assembly_id);
CREATE INDEX idx_ftx_date         ON public.finance_transactions (assembly_id, transaction_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_ftx_member       ON public.finance_transactions (member_id) WHERE member_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_ftx_category     ON public.finance_transactions (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ftx_service      ON public.finance_transactions (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX idx_ftx_pledge       ON public.finance_transactions (pledge_id) WHERE pledge_id IS NOT NULL;
CREATE INDEX idx_fpl_assembly     ON public.finance_pledges (assembly_id);
CREATE INDEX idx_fpl_member       ON public.finance_pledges (member_id);
CREATE INDEX idx_fpl_active       ON public.finance_pledges (assembly_id, status) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_fbg_assembly     ON public.finance_budgets (assembly_id);
CREATE INDEX idx_fbg_category_period ON public.finance_budgets (assembly_id, category_id, year) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.finance_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_pledges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets       ENABLE ROW LEVEL SECURITY;

-- Finance SELECT: admin bypass OR permission check (20260612000003 fix)
CREATE POLICY "fcat: read with finance.view" ON public.finance_categories FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND (public.is_admin() OR public.has_finance_permission('finance.view')));
CREATE POLICY "fcat: write with finance.manage" ON public.finance_categories FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_finance_permission('finance.manage'));
CREATE POLICY "fcat: update with finance.manage" ON public.finance_categories FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.has_finance_permission('finance.manage'));

CREATE POLICY "ftx: read with finance.view" ON public.finance_transactions FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND (public.is_admin() OR public.has_finance_permission('finance.view')));
CREATE POLICY "ftx: insert with finance.manage" ON public.finance_transactions FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_finance_permission('finance.manage'));
CREATE POLICY "ftx: update with finance.manage" ON public.finance_transactions FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.has_finance_permission('finance.manage'));

CREATE POLICY "fpl: read with finance.view" ON public.finance_pledges FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND (public.is_admin() OR public.has_finance_permission('finance.view')));
CREATE POLICY "fpl: insert with finance.manage" ON public.finance_pledges FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_finance_permission('finance.manage'));
CREATE POLICY "fpl: update with finance.manage" ON public.finance_pledges FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.has_finance_permission('finance.manage'));

CREATE POLICY "fbg: read with finance.view" ON public.finance_budgets FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND (public.is_admin() OR public.has_finance_permission('finance.view')));
CREATE POLICY "fbg: insert with finance.manage" ON public.finance_budgets FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.has_finance_permission('finance.manage'));
CREATE POLICY "fbg: update with finance.manage" ON public.finance_budgets FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.has_finance_permission('finance.manage'));

GRANT SELECT, INSERT, UPDATE ON public.finance_categories   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_transactions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_pledges       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_budgets       TO authenticated;
