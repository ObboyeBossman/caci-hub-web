#!/bin/bash
# setup_rls_api.sh

API_URL="http://127.0.0.1:54321/auth/v1"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo "1. Recreating assemblies..."
supabase db query "INSERT INTO public.assemblies (id, name, assembly_code, address) VALUES ('a0000000-0000-0000-0000-00000000000a', 'Assembly A', 'GH-ASSAA', 'Location A, Ghana'), ('b0000000-0000-0000-0000-00000000000b', 'Assembly B', 'GH-ASSAB', 'Location B, Ghana') ON CONFLICT (id) DO NOTHING;"

echo "2. Signing up test users..."
EMAILS=("admin_a@caci.com" "pastor_a@caci.com" "secretary_a@caci.com" "volunteer_a@caci.com" "member_a@caci.com" "admin_b@caci.com")
PASSWORD="password123"

for EMAIL in "${EMAILS[@]}"; do
  curl -s -X POST "$API_URL/signup" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{ \"email\": \"$EMAIL\", \"password\": \"$PASSWORD\" }" > /dev/null
  echo "Signed up $EMAIL"
done

# We need a small delay to ensure Auth hook finishes creating rows (if any) or DB persists
sleep 2

echo "3. Creating user profiles..."
supabase db query "
INSERT INTO public.user_profiles (id, assembly_id, role, full_name, is_active)
SELECT u.id, a.assembly_id, a.role::user_role, a.full_name, true
FROM auth.users u
JOIN (
  VALUES 
    ('admin_a@caci.com', 'a0000000-0000-0000-0000-00000000000a'::uuid, 'admin', 'Admin A'),
    ('pastor_a@caci.com', 'a0000000-0000-0000-0000-00000000000a'::uuid, 'pastor', 'Pastor A'),
    ('secretary_a@caci.com', 'a0000000-0000-0000-0000-00000000000a'::uuid, 'secretary', 'Secretary A'),
    ('volunteer_a@caci.com', 'a0000000-0000-0000-0000-00000000000a'::uuid, 'volunteer', 'Volunteer A'),
    ('member_a@caci.com', 'a0000000-0000-0000-0000-00000000000a'::uuid, 'member', 'Member A'),
    ('admin_b@caci.com', 'b0000000-0000-0000-0000-00000000000b'::uuid, 'admin', 'Admin B')
) AS a(email, assembly_id, role, full_name) ON u.email = a.email
ON CONFLICT (id) DO NOTHING;
"

echo "Done!"
