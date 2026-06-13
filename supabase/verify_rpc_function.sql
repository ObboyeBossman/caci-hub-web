-- Verify that the admin_reset_user_password RPC function exists and is callable
-- by the service_role

-- 1. Check if function exists
SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'admin_reset_user_password'
  AND routine_schema = 'public';

-- 2. Check function privileges
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_routine_grants
WHERE specific_name LIKE '%admin_reset_user_password%'
ORDER BY grantee, privilege_type;

-- 3. Try to call the function with test data (will fail but shows if function is accessible)
-- DO $$
-- BEGIN
--   PERFORM public.admin_reset_user_password(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     'test_password'
--   );
--   RAISE NOTICE 'RPC function call succeeded';
-- EXCEPTION WHEN OTHERS THEN
--   RAISE NOTICE 'RPC function call failed: %', SQLERRM;
-- END $$;
