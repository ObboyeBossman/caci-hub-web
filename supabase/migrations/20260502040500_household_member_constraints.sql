-- Migration: Enforce Primary Contact Uniqueness and Auto-Linking Security
-- Description: 
-- 1. Makes primary_contact_id UNIQUE in households table.
-- 2. Updates enforce_member_update_columns to allow systemic updates (superuser/service_role).

BEGIN;

-- 0. Existing data may reference the same primary_contact_id from multiple households.
--    The unique index below requires at most one household per contact. Keep the
--    lexicographically smallest household id per contact; clear the rest.
ALTER TABLE public.households DISABLE ROW LEVEL SECURITY;

SET LOCAL session_replication_role = 'replica';

WITH keeper AS (
  SELECT DISTINCT ON (primary_contact_id) id AS keeper_id, primary_contact_id
  FROM public.households
  WHERE primary_contact_id IS NOT NULL
  ORDER BY primary_contact_id, id ASC
)
UPDATE public.households h
SET primary_contact_id = NULL
FROM keeper k
WHERE h.primary_contact_id = k.primary_contact_id
  AND h.id <> k.keeper_id;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- 1. Ensure primary_contact_id is UNIQUE (Rule #2: Member cannot be part of another/multiple as primary)
-- Dropping old non-unique index if it exists
DROP INDEX IF EXISTS public.idx_households_primary_contact_id;
CREATE UNIQUE INDEX idx_households_primary_contact_id ON public.households (primary_contact_id) WHERE (primary_contact_id IS NOT NULL);

-- 2. Refactor enforce_member_update_columns to allow internal system updates
CREATE OR REPLACE FUNCTION public.enforce_member_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := public.get_user_role();

  -- Allow superuser (v_role is null) and service_role to proceed
  -- This is critical for triggers like link_household_primary_contact to work
  IF v_role IS NULL OR v_role::text = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin: No restrictions in trigger
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Secretary: Block pastoral_notes
  IF v_role = 'secretary' THEN
    IF OLD.pastoral_notes IS DISTINCT FROM NEW.pastoral_notes THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Pastor: Only allow pastoral_notes
  IF v_role = 'pastor' THEN
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR
       OLD.last_name IS DISTINCT FROM NEW.last_name OR
       OLD.occupation IS DISTINCT FROM NEW.occupation OR
       OLD.gender IS DISTINCT FROM NEW.gender OR
       OLD.membership_status IS DISTINCT FROM NEW.membership_status OR
       OLD.assembly_id IS DISTINCT FROM NEW.assembly_id OR
       OLD.phone_number IS DISTINCT FROM NEW.phone_number
    THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Volunteer and Member: Block ALL updates to get 403
  IF v_role IN ('volunteer', 'member') THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
  END IF;

  -- Default deny (if any other role somehow calls it)
  RAISE EXCEPTION 'new row violates row-level security policy for table "members"' USING ERRCODE = '42501';
END;
$$;

COMMIT;
