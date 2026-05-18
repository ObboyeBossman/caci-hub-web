-- =============================================================================
-- CACI Hub — Migration 20260502000000
-- Purpose:  Ensure the seeded admin member row has `email` set so
--           `myMemberProfileProvider` can resolve the directory row when the
--           user signs in with email/password (Auth has email; phone may be empty).
--
--   Migration sessions have no JWT — RLS blocks UPDATEs. The BEFORE UPDATE
--   trigger `enforce_member_update_columns` also denies NULL role until
--   `20260502040500`. Use one transaction: disable RLS, replica role (skip
--   triggers), UPDATE, re-enable RLS.
-- =============================================================================

BEGIN;

ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;

SET LOCAL session_replication_role = 'replica';

UPDATE public.members
SET email = 'obboyebossman@gmail.com'
WHERE id = '8cf54258-0050-423d-b9a3-7f344ead04df'
  AND (email IS NULL OR btrim(email) = '');

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

COMMIT;
