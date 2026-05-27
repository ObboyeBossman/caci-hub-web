import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY?.replace('anon', 'service_role') || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

// We'll use the service client to seed the user and read app_metadata cleanly
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testPermissions() {
  console.log('--- Starting Multi-Tenant Roles & Permissions Verification ---')
  
  // 1. Verify schema tables exist
  console.log('\\n1. Verifying permissions seeds...')
  const { data: perms, error: permErr } = await supabaseAdmin.from('permissions').select('*')
  if (permErr) throw permErr
  console.log(`✅ Loaded ${perms.length} system permissions`)
  
  // 2. Fetch the admin user auth ID and their assembly
  console.log('\\n2. Fetching Admin User profile...')
  const { data: adminProfile, error: prfErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, assembly_id')
    .eq('role', 'admin') 
    .limit(1)
    .single()
    
  if (prfErr) throw prfErr
  console.log(`✅ Found admin user ID: ${adminProfile.id}`)
  
  // 3. Create a custom role
  console.log('\\n3. Creating custom assembly role...')
  const { data: role, error: roleErr } = await supabaseAdmin
    .from('assembly_roles')
    .insert({
      assembly_id: adminProfile.assembly_id,
      name: 'Test Verification Role',
      description: 'Role for verifying JWT sync'
    })
    .select('id')
    .single()
    
  if (roleErr) throw roleErr
  const roleId = role.id
  console.log(`✅ Created role with ID: ${roleId}`)

  // 4. Assign permissions to the custom role
  console.log('\\n4. Assigning perms to custom role...')
  const { error: assignErr } = await supabaseAdmin
    .from('role_permissions')
    .insert([
      { role_id: roleId, permission_id: 'member:view_all' },
      { role_id: roleId, permission_id: 'financials:view' }
    ])
    
  if (assignErr) throw assignErr
  console.log('✅ Assigned member:view_all and financials:view')

  // 5. Update the admin user profile to have the custom role (Triggers the Sync)
  console.log('\\n5. Assigning role to user_profile (Should trigger JWT sync)...')
  const { error: userRoleErr } = await supabaseAdmin
    .from('user_profiles')
    .update({ role_id: roleId })
    .eq('id', adminProfile.id)
    
  if (userRoleErr) throw userRoleErr
  console.log('✅ Trigger update executed on user_profiles')

  // 6. Verify Auth app_metadata directly
  console.log('\\n6. Verifying JWT app_metadata via auth.users...')
  const { data: { user }, error: userFetchErr } = await supabaseAdmin.auth.admin.getUserById(adminProfile.id)
  
  if (userFetchErr) throw userFetchErr
  
  const appMeta = user?.app_metadata
  console.log('App Meta:', JSON.stringify(appMeta, null, 2))
  
  if (
    appMeta?.permissions?.includes('member:view_all') && 
    appMeta?.permissions?.includes('financials:view') &&
    appMeta?.assembly_id === adminProfile.assembly_id
  ) {
    console.log('✅ JWT Sync Trigger WORKED! app_metadata correctly contains permissions & assembly_id.')
  } else {
    throw new Error('❌ JWT Sync Trigger failed. app_metadata does not match expected output.')
  }
  
  console.log('\\n--- Verification Complete Successfully ---')
}

testPermissions().catch(err => {
  console.error('\\n❌ Verification Failed:', err)
  process.exit(1)
})
