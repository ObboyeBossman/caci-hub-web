-- =============================================================
-- CACI Hub — seed.sql
-- Run automatically after migrations by `supabase db reset`.
-- Migration 20260428000001 already seeds the assembly, member,
-- and user_profile rows. This file only adds what the migration
-- cannot: the auth.users row and the auth_user_id link.
-- Last updated: 2026-06-11
-- =============================================================

DO $$
DECLARE
  v_auth_id   uuid := 'deed0df7-d6de-404a-853d-0428c4196c9a';
  v_member_id uuid := '8cf54258-0050-423d-b9a3-7f344ead04df';
  v_email     TEXT := 'obboyebossman@gmail.com';
BEGIN

  -- ── 0. Base Instance (Required after DB Reset truncates this) ───────────────
  INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '',
    now(),
    now()
  ) ON CONFLICT DO NOTHING;

  -- ── 0a. Auth user (must exist before user_profiles FK) ─────────────────────
  -- Uses DO UPDATE to ensure instance_id/aud are always correct even when
  -- migration 20260427999999 already inserted the row.
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    phone, phone_confirmed_at,
    confirmation_token, recovery_token, 
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    v_email,
    extensions.crypt('Boss1520..', extensions.gen_salt('bf')),
    now(), now(), now(),
    '233593529509', now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (id) DO UPDATE SET
    instance_id        = EXCLUDED.instance_id,
    encrypted_password = EXCLUDED.encrypted_password,
    phone              = EXCLUDED.phone,
    phone_confirmed_at = EXCLUDED.phone_confirmed_at,
    confirmation_token = EXCLUDED.confirmation_token,
    recovery_token     = EXCLUDED.recovery_token,
    email_change_token_new = EXCLUDED.email_change_token_new,
    email_change       = EXCLUDED.email_change,
    raw_app_meta_data  = EXCLUDED.raw_app_meta_data,
    aud                = EXCLUDED.aud,
    role               = EXCLUDED.role;

  -- ── 0b. Auth identity (Required for user to appear in the dashboard) ───────
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-deed0df7d6de',   -- stable UUID for idempotency
    v_auth_id,
    v_auth_id::text,
    format('{"sub":"%s","email":"%s","email_verified":false,"phone_verified":false}', v_auth_id, v_email)::jsonb,
    'email',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 1. Link auth_user_id on the admin member row ──────────────────────────
  -- Migration 20260428000001 created the member row with created_by = NULL.
  -- Now that the auth user exists, we can backfill auth_user_id.
  UPDATE public.members
  SET auth_user_id = v_auth_id
  WHERE id = v_member_id
    AND auth_user_id IS NULL;

  -- ── 2. Sample members (additional dev data not in any migration) ──────────
  INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email)
  SELECT
    m.id, a.id, m.membership_number, m.first_name, m.last_name, m.gender::public.gender_type, m.membership_status::public.membership_status, v_auth_id, m.email
  FROM (VALUES
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'CACI-GH-ASSAK-00002', 'Kwame',  'Mensah',  'male',   'active',  'kwame@example.com'),
    ('c0000000-0000-0000-0000-000000000002'::uuid, 'CACI-GH-ASSAK-00003', 'Abena',  'Osei',    'female', 'active',  'abena@example.com'),
    ('c0000000-0000-0000-0000-000000000003'::uuid, 'CACI-GH-ASSAK-00004', 'Kojo',   'Ansah',   'male',   'active',  'kojo@example.com'),
    ('c0000000-0000-0000-0000-000000000004'::uuid, 'CACI-GH-ASSAK-00005', 'Akua',   'Danso',   'female', 'active',  'akua@example.com'),
    ('c0000000-0000-0000-0000-000000000005'::uuid, 'CACI-GH-ASSAK-00006', 'Yaw',    'Boakye',  'male',   'visitor', 'yaw@example.com')
  ) AS m(id, membership_number, first_name, last_name, gender, membership_status, email)
  CROSS JOIN public.assemblies a
  WHERE a.assembly_code = 'GH-ASSAK'
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ── 3. Application Mock Data for Testing ──────────────────────────────────────
DO $$
DECLARE
  v_auth_id   uuid := 'deed0df7-d6de-404a-853d-0428c4196c9a';
  v_assembly_id uuid;
  v_member_ids uuid[];
  v_household_ids uuid[];
  v_group_ids uuid[];
  v_service_ids uuid[];
  v_finance_category_ids uuid[];
  v_campaign_ids uuid[];
  v_template_ids uuid[];
  
  -- Static pool of Ghanaian names
  v_first_names text[] := ARRAY['Kwame', 'Kofi', 'Kwesi', 'Kojo', 'Yaw', 'Kwabena', 'Kwaku', 'Ama', 'Abena', 'Akua', 'Yaa', 'Afia', 'Amma', 'Esi', 'Akosua'];
  v_last_names text[] := ARRAY['Osei', 'Mensah', 'Appiah', 'Owusu', 'Boateng', 'Asante', 'Agyeman', 'Boakye', 'Amoah', 'Ansah', 'Oppong', 'Agyapong', 'Nkrumah', 'Ofori'];
  v_fn text;
  v_ln text;
  v_gender text;
  
  -- Loop variables
  v_member_id uuid;
  v_household_id uuid;
  v_group_id uuid;
  v_service_id uuid;
  v_cat_id uuid;
  v_template_id uuid;
  v_campaign_id uuid;
  i int;
  j int;
BEGIN
  -- We assume assembly 'GH-ASSAK' exists from migration 20260428000001
  SELECT id INTO v_assembly_id FROM public.assemblies WHERE assembly_code = 'GH-ASSAK' LIMIT 1;
  IF v_assembly_id IS NULL THEN RETURN; END IF;

  -- fetch existing mocked members
  SELECT array_agg(id) INTO v_member_ids FROM public.members WHERE assembly_id = v_assembly_id;

  -- 1. Create 25 additional random members
  FOR i IN 1..25 LOOP
    v_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
    v_ln := v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
    v_gender := CASE WHEN random() > 0.5 THEN 'male' ELSE 'female' END;
    v_member_id := gen_random_uuid();
    
    INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email)
    VALUES (v_member_id, v_assembly_id, 'MOCK-' || lpad(floor(random() * 999999)::text, 6, '0'), v_fn, v_ln, v_gender::public.gender_type, 'active', v_auth_id, lower(v_fn || '.' || v_ln || floor(random() * 9999) || '@example.com'))
    ON CONFLICT DO NOTHING;
    
    v_member_ids := array_append(v_member_ids, v_member_id);
  END LOOP;

  -- 2. Create 5 Households
  FOR i IN 1..5 LOOP
    v_ln := v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
    v_household_id := gen_random_uuid();
    
    INSERT INTO public.households (id, assembly_id, family_name, address)
    VALUES (v_household_id, v_assembly_id, v_ln || ' Family', 'House No. ' || i || ', Accra Layout')
    ON CONFLICT DO NOTHING;
    
    v_household_ids := array_append(v_household_ids, v_household_id);
    
    -- CREATE a new dedicated primary contact for this household immediately.
    v_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
    v_member_id := gen_random_uuid();
    v_gender := CASE WHEN random() > 0.5 THEN 'male' ELSE 'female' END;
    INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email, household_id)
    VALUES (v_member_id, v_assembly_id, 'MOCK-' || lpad(floor(random() * 999999)::text, 6, '0'), v_fn, v_ln, v_gender::public.gender_type, 'active', v_auth_id, lower(v_fn || '.' || v_ln || floor(random() * 9999) || '@example.com'), v_household_id)
    ON CONFLICT DO NOTHING;
    v_member_ids := array_append(v_member_ids, v_member_id);

    UPDATE public.households SET primary_contact_id = v_member_id WHERE id = v_household_id;
    
    -- Add a couple more people to the same household
    FOR j IN 1..(1 + floor(random() * 3)::int) LOOP
      v_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
      v_member_id := gen_random_uuid();
      v_gender := CASE WHEN random() > 0.5 THEN 'male' ELSE 'female' END;
      INSERT INTO public.members (id, assembly_id, membership_number, first_name, last_name, gender, membership_status, created_by, email, household_id)
      VALUES (v_member_id, v_assembly_id, 'MOCK-' || lpad(floor(random() * 999999)::text, 6, '0'), v_fn, v_ln, v_gender::public.gender_type, 'active', v_auth_id, lower(v_fn || '.' || v_ln || floor(random() * 9999) || '@example.com'), v_household_id)
      ON CONFLICT DO NOTHING;
      v_member_ids := array_append(v_member_ids, v_member_id);
    END LOOP;
  END LOOP;

  -- 3. Create 3 Groups
  INSERT INTO public.groups (id, assembly_id, name, group_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'Youth Ministry', 'age_group', v_auth_id) 
    ON CONFLICT (assembly_id, name, group_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_group_id;
  v_group_ids := array_append(v_group_ids, v_group_id);

  INSERT INTO public.groups (id, assembly_id, name, group_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'Choir', 'department', v_auth_id) 
    ON CONFLICT (assembly_id, name, group_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_group_id;
  v_group_ids := array_append(v_group_ids, v_group_id);

  INSERT INTO public.groups (id, assembly_id, name, group_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'Men''s Movement', 'age_group', v_auth_id) 
    ON CONFLICT (assembly_id, name, group_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_group_id;
  v_group_ids := array_append(v_group_ids, v_group_id);

  -- Assign 8 random members to each group
  FOR i IN 1..array_length(v_group_ids, 1) LOOP
    FOR j IN 1..8 LOOP
      v_member_id := v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))];
      INSERT INTO public.group_members (group_id, member_id, role, created_by)
      VALUES (v_group_ids[i], v_member_id, CASE WHEN j = 1 THEN 'leader'::public.group_member_role ELSE 'member'::public.group_member_role END, v_auth_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 4. Create Services
  FOR i IN 1..5 LOOP
    v_service_id := gen_random_uuid();
    INSERT INTO public.services (id, assembly_id, title, service_type, service_date, headcount, status, created_by)
    VALUES (v_service_id, v_assembly_id, 'Sunday Service Wk ' || i, 'Sunday Service', current_date - (i * 7), 50 + floor(random() * 50)::int, 'completed', v_auth_id)
    ON CONFLICT DO NOTHING;
    v_service_ids := array_append(v_service_ids, v_service_id);

    -- Assign attendance to 10 random members
    FOR j IN 1..10 LOOP
      v_member_id := v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))];
      INSERT INTO public.service_attendance (service_id, member_id, status, marked_by)
      VALUES (v_service_id, v_member_id, CASE WHEN random() > 0.1 THEN 'present' ELSE 'absent' END::public.attendance_status, v_auth_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 5. Create Finance Categories & Transactions
  INSERT INTO public.finance_categories (id, assembly_id, name, category_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'Tithes Mock', 'income', v_auth_id) 
    ON CONFLICT (assembly_id, name, category_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_id;
  v_finance_category_ids := array_append(v_finance_category_ids, v_cat_id);

  INSERT INTO public.finance_categories (id, assembly_id, name, category_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'General Offering Mock', 'income', v_auth_id) 
    ON CONFLICT (assembly_id, name, category_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_id;
  v_finance_category_ids := array_append(v_finance_category_ids, v_cat_id);

  INSERT INTO public.finance_categories (id, assembly_id, name, category_type, created_by) VALUES
    (gen_random_uuid(), v_assembly_id, 'Utility Bills Mock', 'expense', v_auth_id) 
    ON CONFLICT (assembly_id, name, category_type) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_id;
  v_finance_category_ids := array_append(v_finance_category_ids, v_cat_id);

  -- Insert Pledges
  FOR i IN 1..5 LOOP
    INSERT INTO public.finance_pledges (assembly_id, member_id, pledge_name, total_amount, amount_paid, currency, start_date, status, created_by)
    VALUES (
      v_assembly_id,
      v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))],
      'Building Fund ' || lpad(floor(random() * 99999)::text, 5, '0'),
      1000 + floor(random() * 5000),
      floor(random() * 500),
      'GHS',
      current_date - floor(random() * 60)::int,
      'active',
      v_auth_id
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Insert Budgets
  FOR i IN 1..3 LOOP
    INSERT INTO public.finance_budgets (assembly_id, category_id, period, year, month, budgeted_amount, actual_amount, created_by)
    VALUES (
      v_assembly_id,
      v_finance_category_ids[i],
      'monthly',
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      5000 + floor(random() * 5000),
      floor(random() * 2000),
      v_auth_id
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Insert 150 transactions
  FOR i IN 1..150 LOOP
    v_cat_id := v_finance_category_ids[1 + floor(random() * array_length(v_finance_category_ids, 1))];
    INSERT INTO public.finance_transactions (assembly_id, category_id, member_id, transaction_type, amount, payment_method, reference_number, transaction_date, recorded_by)
    VALUES (
      v_assembly_id,
      v_cat_id,
      CASE WHEN random() > 0.5 THEN v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))] ELSE NULL END,
      CASE WHEN random() > 0.5 THEN 'tithe'::public.finance_transaction_type ELSE 'expense'::public.finance_transaction_type END,
      50 + floor(random() * 500),
      CASE WHEN random() > 0.5 THEN 'cash' ELSE 'momo' END::public.finance_payment_method,
      'REF-' || lpad(floor(random() * 9999999)::text, 7, '0'),
      current_date - floor(random() * 60)::int,
      v_auth_id
    );
  END LOOP;

  -- 6. Communication Campaigns
  INSERT INTO public.communication_templates (id, assembly_id, title, body, channel, category, created_by)
  VALUES (gen_random_uuid(), v_assembly_id, 'Welcome SMS Mock', 'Welcome to CACI Hub Mock!', 'sms', 'broadcast', (SELECT id FROM user_profiles WHERE role = 'authenticated' LIMIT 1))
  RETURNING id INTO v_template_id;

  INSERT INTO public.communication_campaigns (id, assembly_id, template_id, title, channel, audience_type, status, created_by)
  VALUES (gen_random_uuid(), v_assembly_id, v_template_id, 'New Member Welcome Mock', 'sms', 'assembly', 'sent', (SELECT id FROM user_profiles WHERE role = 'authenticated' LIMIT 1))
  RETURNING id INTO v_campaign_id;

  FOR i IN 1..8 LOOP
    v_member_id := v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))];
    INSERT INTO public.communication_messages (campaign_id, assembly_id, member_id, channel, body_resolved, status)
    VALUES (v_campaign_id, v_assembly_id, v_member_id, 'sms', 'Welcome to CACI Hub Mock!', 'delivered');
  END LOOP;

END $$;

-- =============================================================
-- Verify after seeding:
--
-- SELECT id, email, email_confirmed_at FROM auth.users
--   WHERE id = 'deed0df7-d6de-404a-853d-0428c4196c9a';
-- SELECT first_name, last_name, membership_number, primary_phone, auth_user_id
--   FROM public.members ORDER BY membership_number;
-- SELECT full_name, role, is_active FROM public.user_profiles;
-- =============================================================