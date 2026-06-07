-- ─────────────────────────────────────────────────────────────────────────────
-- Finance Module — Full Schema
-- Migration: 20260601000001_create_finance_module.sql
-- Tables: finance_categories, finance_transactions, finance_pledges,
--         finance_budgets
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE finance_transaction_type AS ENUM (
  'tithe',
  'offering',
  'special_offering',
  'pledge_payment',
  'donation',
  'expense'
);

CREATE TYPE finance_payment_method AS ENUM (
  'cash',
  'momo',
  'bank_transfer',
  'cheque',
  'other'
);

CREATE TYPE finance_pledge_status AS ENUM (
  'active',
  'completed',
  'defaulted',
  'cancelled'
);

CREATE TYPE finance_budget_period AS ENUM (
  'monthly',
  'quarterly',
  'annual'
);

CREATE TYPE finance_category_type AS ENUM (
  'income',
  'expense'
);


-- ── finance_categories ────────────────────────────────────────────────────────
-- Chart of accounts for the assembly. Separates income from expense lines.

CREATE TABLE finance_categories (
  id            uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id   uuid                   NOT NULL REFERENCES assemblies(id),
  name          text                   NOT NULL,
  category_type finance_category_type  NOT NULL,
  description   text,
  is_active     boolean                NOT NULL DEFAULT true,
  created_by    uuid                   REFERENCES auth.users(id),
  created_at    timestamptz            NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    uuid                   REFERENCES auth.users(id),

  CONSTRAINT uq_category_name
    UNIQUE (assembly_id, name, category_type)
);


-- ── finance_pledges ───────────────────────────────────────────────────────────
-- Defined BEFORE finance_transactions because transactions have a FK to pledges.

CREATE TABLE finance_pledges (
  id            uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id   uuid                  NOT NULL REFERENCES assemblies(id),
  member_id     uuid                  NOT NULL REFERENCES members(id),
  pledge_name   text                  NOT NULL,
  total_amount  numeric(12, 2)        NOT NULL CHECK (total_amount > 0),
  amount_paid   numeric(12, 2)        NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency      text                  NOT NULL DEFAULT 'GHS',
  start_date    date                  NOT NULL DEFAULT current_date,
  end_date      date,
  status        finance_pledge_status NOT NULL DEFAULT 'active',
  notes         text,
  created_by    uuid                  REFERENCES auth.users(id),
  created_at    timestamptz           NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    uuid                  REFERENCES auth.users(id),

  CONSTRAINT chk_pledge_amount
    CHECK (amount_paid <= total_amount),

  CONSTRAINT uq_pledge
    UNIQUE (assembly_id, member_id, pledge_name)
);


-- ── finance_transactions ──────────────────────────────────────────────────────
-- Main ledger. Every income or expense entry.

CREATE TABLE finance_transactions (
  id               uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid                      NOT NULL REFERENCES assemblies(id),
  category_id      uuid                      NOT NULL REFERENCES finance_categories(id),
  member_id        uuid                      REFERENCES members(id),
  transaction_type finance_transaction_type  NOT NULL,
  amount           numeric(12, 2)            NOT NULL CHECK (amount > 0),
  currency         text                      NOT NULL DEFAULT 'GHS',
  payment_method   finance_payment_method    NOT NULL,
  reference_number text,
  transaction_date date                      NOT NULL DEFAULT current_date,
  description      text,
  service_id       uuid                      REFERENCES services(id),
  group_id         uuid                      REFERENCES groups(id),
  pledge_id        uuid                      REFERENCES finance_pledges(id),
  recorded_by      uuid                      REFERENCES auth.users(id),
  created_at       timestamptz               NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid                      REFERENCES auth.users(id),

  CONSTRAINT uq_transaction_reference
    UNIQUE (assembly_id, reference_number)
    DEFERRABLE INITIALLY DEFERRED
);


-- ── finance_budgets ───────────────────────────────────────────────────────────
-- Planned vs actual per category per period.

CREATE TABLE finance_budgets (
  id               uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid                  NOT NULL REFERENCES assemblies(id),
  category_id      uuid                  NOT NULL REFERENCES finance_categories(id),
  period           finance_budget_period NOT NULL,
  year             integer               NOT NULL CHECK (year >= 2000),
  month            integer               CHECK (month BETWEEN 1 AND 12),
  quarter          integer               CHECK (quarter BETWEEN 1 AND 4),
  budgeted_amount  numeric(12, 2)        NOT NULL CHECK (budgeted_amount >= 0),
  actual_amount    numeric(12, 2)        NOT NULL DEFAULT 0,
  notes            text,
  created_by       uuid                  REFERENCES auth.users(id),
  created_at       timestamptz           NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid                  REFERENCES auth.users(id),

  CONSTRAINT uq_budget_period
    UNIQUE (assembly_id, category_id, period, year, month, quarter)
);


-- ── Indexes ───────────────────────────────────────────────────────────────────

-- finance_categories
CREATE INDEX idx_fcat_assembly
  ON finance_categories (assembly_id);

CREATE INDEX idx_fcat_active
  ON finance_categories (assembly_id, category_type)
  WHERE is_active = true AND deleted_at IS NULL;

-- finance_transactions
CREATE INDEX idx_ftx_assembly
  ON finance_transactions (assembly_id);

CREATE INDEX idx_ftx_date
  ON finance_transactions (assembly_id, transaction_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ftx_member
  ON finance_transactions (member_id)
  WHERE member_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_ftx_category
  ON finance_transactions (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ftx_service
  ON finance_transactions (service_id)
  WHERE service_id IS NOT NULL;

CREATE INDEX idx_ftx_pledge
  ON finance_transactions (pledge_id)
  WHERE pledge_id IS NOT NULL;

-- finance_pledges
CREATE INDEX idx_fpl_assembly
  ON finance_pledges (assembly_id);

CREATE INDEX idx_fpl_member
  ON finance_pledges (member_id);

CREATE INDEX idx_fpl_active
  ON finance_pledges (assembly_id, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- finance_budgets
CREATE INDEX idx_fbg_assembly
  ON finance_budgets (assembly_id);

CREATE INDEX idx_fbg_category_period
  ON finance_budgets (assembly_id, category_id, year)
  WHERE deleted_at IS NULL;


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE finance_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_pledges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets       ENABLE ROW LEVEL SECURITY;


-- Helper: checks that the current user has the given finance permission
-- Hooks into the existing system_permissions / role_permissions tables.
CREATE OR REPLACE FUNCTION has_finance_permission(perm text)
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


-- finance_categories RLS
CREATE POLICY "fcat: read with finance.view"
  ON finance_categories FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.view')
  );

CREATE POLICY "fcat: write with finance.manage"
  ON finance_categories FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_finance_permission('finance.manage')
  );

CREATE POLICY "fcat: update with finance.manage"
  ON finance_categories FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.manage')
  );

-- finance_transactions RLS
CREATE POLICY "ftx: read with finance.view"
  ON finance_transactions FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.view')
  );

CREATE POLICY "ftx: insert with finance.manage"
  ON finance_transactions FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_finance_permission('finance.manage')
  );

CREATE POLICY "ftx: update with finance.manage"
  ON finance_transactions FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.manage')
  );

-- finance_pledges RLS
CREATE POLICY "fpl: read with finance.view"
  ON finance_pledges FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.view')
  );

CREATE POLICY "fpl: insert with finance.manage"
  ON finance_pledges FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_finance_permission('finance.manage')
  );

CREATE POLICY "fpl: update with finance.manage"
  ON finance_pledges FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.manage')
  );

-- finance_budgets RLS
CREATE POLICY "fbg: read with finance.view"
  ON finance_budgets FOR SELECT
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.view')
  );

CREATE POLICY "fbg: insert with finance.manage"
  ON finance_budgets FOR INSERT
  WITH CHECK (
    assembly_id = auth_assembly_id()
    AND has_finance_permission('finance.manage')
  );

CREATE POLICY "fbg: update with finance.manage"
  ON finance_budgets FOR UPDATE
  USING (
    assembly_id = auth_assembly_id()
    AND deleted_at IS NULL
    AND has_finance_permission('finance.manage')
  );


-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON finance_categories   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON finance_transactions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON finance_pledges       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON finance_budgets       TO authenticated;
