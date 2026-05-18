-- =============================================================
-- setup_rls_test_users.sql
-- Creates 2 assemblies and 6 test users for RLS suite testing.
-- =============================================================

-- 1. Create Assemblies
INSERT INTO public.assemblies (id, name, assembly_code, address)
VALUES 
  ('a0000000-0000-0000-0000-00000000000a', 'Assembly A', 'GH-ASSAA', 'Location A, Ghana'),
  ('b0000000-0000-0000-0000-00000000000b', 'Assembly B', 'GH-ASSAB', 'Location B, Ghana')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Auth Users
-- Password for all: password123
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
VALUES
  ('a1111111-1111-1111-1111-11111111111a', 'admin_a@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', ''),
  ('a2222222-2222-2222-2222-22222222222a', 'pastor_a@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', ''),
  ('a3333333-3333-3333-3333-33333333333a', 'secretary_a@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', ''),
  ('a4444444-4444-4444-4444-44444444444a', 'volunteer_a@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', ''),
  ('a5555555-5555-5555-5555-55555555555a', 'member_a@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', ''),
  ('b1111111-1111-1111-1111-11111111111b', 'admin_b@caci.com', extensions.crypt('password123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated', '')
ON CONFLICT (id) DO NOTHING;

-- 3. Create User Profiles
INSERT INTO public.user_profiles (id, assembly_id, role, full_name, is_active)
VALUES
  ('a1111111-1111-1111-1111-11111111111a', 'a0000000-0000-0000-0000-00000000000a', 'admin', 'Admin A', true),
  ('a2222222-2222-2222-2222-22222222222a', 'a0000000-0000-0000-0000-00000000000a', 'pastor', 'Pastor A', true),
  ('a3333333-3333-3333-3333-33333333333a', 'a0000000-0000-0000-0000-00000000000a', 'secretary', 'Secretary A', true),
  ('a4444444-4444-4444-4444-44444444444a', 'a0000000-0000-0000-0000-00000000000a', 'volunteer', 'Volunteer A', true),
  ('a5555555-5555-5555-5555-55555555555a', 'a0000000-0000-0000-0000-00000000000a', 'member', 'Member A', true),
  ('b1111111-1111-1111-1111-11111111111b', 'b0000000-0000-0000-0000-00000000000b', 'admin', 'Admin B', true)
ON CONFLICT (id) DO NOTHING;
