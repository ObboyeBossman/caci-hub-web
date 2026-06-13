-- =============================================================================
-- CACI Hub — Squashed Migration 01: Enums
-- Represents the FINAL state of all enum types after all migrations.
--
-- NOTE: public.user_role was intentionally DROPPED in the RBAC refactor
-- (20260530000005). user_profiles.role is now a TEXT column with a CHECK
-- constraint ('admin' | 'member'). It is NOT recreated here.
-- =============================================================================

-- ── membership_status ─────────────────────────────────────────────────────────
CREATE TYPE public.membership_status AS ENUM (
  'active',
  'inactive',
  'visitor',
  'prospect',
  'transfer',
  'deceased'
);

-- ── gender_type ───────────────────────────────────────────────────────────────
CREATE TYPE public.gender_type AS ENUM (
  'male',
  'female'
);

-- ── marital_status_type ───────────────────────────────────────────────────────
CREATE TYPE public.marital_status_type AS ENUM (
  'single',
  'married',
  'widowed',
  'divorced',
  'separated'
);

-- ── group_type ────────────────────────────────────────────────────────────────
CREATE TYPE public.group_type AS ENUM (
  'department',
  'age_group'
);

-- ── group_member_role ─────────────────────────────────────────────────────────
CREATE TYPE public.group_member_role AS ENUM (
  'leader',
  'assistant_leader',
  'member'
);

-- ── pastoral_case_type ────────────────────────────────────────────────────────
CREATE TYPE public.pastoral_case_type AS ENUM (
  'follow_up',
  'bereavement',
  'illness',
  'counselling',
  'discipline',
  'other'
);

-- ── pastoral_priority ─────────────────────────────────────────────────────────
CREATE TYPE public.pastoral_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- ── pastoral_case_status ──────────────────────────────────────────────────────
CREATE TYPE public.pastoral_case_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

-- ── visit_type ────────────────────────────────────────────────────────────────
CREATE TYPE public.visit_type AS ENUM (
  'home_visit',
  'hospital_visit',
  'phone_call',
  'video_call',
  'in_person'
);

-- ── visit_outcome ─────────────────────────────────────────────────────────────
CREATE TYPE public.visit_outcome AS ENUM (
  'positive',
  'needs_follow_up',
  'no_response',
  'referred'
);

-- ── prayer_request_status ─────────────────────────────────────────────────────
CREATE TYPE public.prayer_request_status AS ENUM (
  'active',
  'answered',
  'closed'
);

-- ── service_status ────────────────────────────────────────────────────────────
CREATE TYPE public.service_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled'
);

-- ── attendance_status ─────────────────────────────────────────────────────────
CREATE TYPE public.attendance_status AS ENUM (
  'present',
  'absent',
  'excused'
);

-- ── recurrence_type ───────────────────────────────────────────────────────────
CREATE TYPE public.recurrence_type AS ENUM (
  'none',
  'daily',
  'weekly',
  'biweekly',
  'monthly'
);

-- ── finance_transaction_type ──────────────────────────────────────────────────
CREATE TYPE public.finance_transaction_type AS ENUM (
  'tithe',
  'offering',
  'special_offering',
  'pledge_payment',
  'donation',
  'expense'
);

-- ── finance_payment_method ────────────────────────────────────────────────────
CREATE TYPE public.finance_payment_method AS ENUM (
  'cash',
  'momo',
  'bank_transfer',
  'cheque',
  'other'
);

-- ── finance_pledge_status ─────────────────────────────────────────────────────
CREATE TYPE public.finance_pledge_status AS ENUM (
  'active',
  'completed',
  'defaulted',
  'cancelled'
);

-- ── finance_budget_period ─────────────────────────────────────────────────────
CREATE TYPE public.finance_budget_period AS ENUM (
  'monthly',
  'quarterly',
  'annual'
);

-- ── finance_category_type ─────────────────────────────────────────────────────
CREATE TYPE public.finance_category_type AS ENUM (
  'income',
  'expense'
);
