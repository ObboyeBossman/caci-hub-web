BEGIN;
REVOKE INSERT, UPDATE, DELETE ON public.member_audit_log FROM authenticated, anon;
COMMIT;
