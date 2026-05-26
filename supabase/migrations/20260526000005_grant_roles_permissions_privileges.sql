-- Migration: 20260526000005_grant_roles_permissions_privileges
-- Grants table-level privileges to the authenticated role for the new permissions tables.
-- (RLS policies already restrict row-level access, but table-level is required first).

GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembly_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;
