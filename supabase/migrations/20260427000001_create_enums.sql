-- =============================================================
-- Migration: 20260427000001_create_enums.sql
-- Purpose:   Define all PostgreSQL enum types for Phase 1.
--            These must exist before any table that references them.
--            Enum values include Phase 1 active roles and future-phase
--            placeholders so later phases can activate them without
--            ALTER TYPE (which locks the table in PostgreSQL).
-- Author:    Abraham N. O. Bossman
-- Date:      April 27, 2026
-- =============================================================

-- ------------------------------------------------------------
-- 1. user_role
--    Phase 1 active: admin, pastor, secretary, volunteer, member
--    Future placeholders grouped by planned phase
-- ------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM (
  -- Phase 1 active
  'admin',
  'pastor',
  'secretary',
  'volunteer',
  'member',

  -- Phase 3 — Finance module
  'finance_officer',

  -- Phase 5 — Pastoral Care & Groups
  'welfare_officer',      -- benevolence/needs tracking
  'cell_leader',          -- home cell / small group leader
  'elder',                -- senior oversight, assembly-scoped

  -- Phase 6 — Children's Ministry
  'children_worker',

  -- Phase 6 — Media & Communications
  'media_officer',        -- announcements, bulletin, broadcast access

  -- Phase 7 — Multi-assembly
  'district_overseer',
  'national_admin'
);

-- ------------------------------------------------------------
-- 2. membership_status
-- ------------------------------------------------------------
CREATE TYPE public.membership_status AS ENUM (
  'active',
  'inactive',
  'visitor',
  'prospect',
  'transfer',
  'deceased'
);

-- ------------------------------------------------------------
-- 3. gender_type
-- ------------------------------------------------------------
CREATE TYPE public.gender_type AS ENUM (
  'male',
  'female'
);

-- ------------------------------------------------------------
-- 4. marital_status_type
-- ------------------------------------------------------------
CREATE TYPE public.marital_status_type AS ENUM (
  'single',
  'married',
  'widowed',
  'divorced',
  'separated'
);