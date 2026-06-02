-- 20260602000000_auth_assembly_id.sql
-- Extracts the auth_assembly_id() helper so it is available to 
-- pastoral care, groups, services, and finance.

CREATE OR REPLACE FUNCTION auth_assembly_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT assembly_id FROM user_profiles
  WHERE id = auth.uid()
$$;
