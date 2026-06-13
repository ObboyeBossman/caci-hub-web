import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const permissions: string[] = user.app_metadata?.permissions ?? []
    const hasAdminPerm = permissions.includes('admin.users.manage')

    const { data: profile, error: profileError } = await supabaseAdmin.from('user_profiles').select('role, assembly_id').eq('id', user.id).single()
    if (profileError || !profile) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const isAdmin = profile.role === 'admin'
    if (!hasAdminPerm && !isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })

    const { memberId, password: customPassword } = await req.json()
    if (!memberId) return new Response(JSON.stringify({ error: 'memberId is required' }), { status: 400, headers: corsHeaders })

    // supabaseAdmin already initialized above

    const { data: member, error: memErr } = await supabaseAdmin.from('members').select('assembly_id, auth_user_id').eq('id', memberId).single()
    if (memErr || !member) return new Response(JSON.stringify({ error: 'Member not found' }), { status: 404, headers: corsHeaders })
    if (member.assembly_id !== profile.assembly_id) return new Response(JSON.stringify({ error: 'Member is not in your assembly' }), { status: 403, headers: corsHeaders })
    if (!member.auth_user_id) return new Response(JSON.stringify({ error: 'Member does not have an auth account' }), { status: 400, headers: corsHeaders })

    let passwordToUse = customPassword
    if (!passwordToUse) {
      const { data: assembly, error: assErr } = await supabaseAdmin.from('assemblies').select('default_member_password').eq('id', profile.assembly_id).single()
      if (assErr || !assembly?.default_member_password) return new Response(JSON.stringify({ error: 'Assembly default password is not configured.' }), { status: 400, headers: corsHeaders })
      passwordToUse = assembly.default_member_password
    }

    // Verify the auth user exists before attempting password update
    // Note: We try to get the user to ensure the ID is valid, but don't fail if this returns
    // "Database error loading user" — that's the very error we're trying to bypass with the RPC.
    const { data: targetUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(member.auth_user_id)
    if (getUserErr && !getUserErr.message?.includes('Database error')) {
      // If it's a real error (not the "Database error" we're trying to fix), fail
      if (getUserErr.message?.includes('User not found')) {
        return new Response(JSON.stringify({ error: 'Auth account not found. The member\'s auth link may be stale — try re-provisioning.' }), { status: 400, headers: corsHeaders })
      }
    }

    // Use direct DB bcrypt update to bypass gotrue Admin API bug affecting
    // phone-provisioned accounts (no email identity → "Database error loading user").
    const { error: rpcErr } = await supabaseAdmin.rpc('admin_reset_user_password', {
      p_user_id:  member.auth_user_id,
      p_password: passwordToUse,
    })
    
    if (rpcErr) {
      // RPC failed — try to log the error and fall back to Admin API if appropriate
      console.error('RPC admin_reset_user_password failed:', rpcErr)
      
      // Check if RPC doesn't exist (which might mean the migration hasn't been applied)
      if (rpcErr.message?.includes('does not exist')) {
        console.warn('RPC function not found — attempting Admin API fallback')
      }
      
      // Attempt Admin API as fallback
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(member.auth_user_id, { password: passwordToUse })
      if (resetErr) {
        // If we get "Database error loading user", it's likely a phone-only account without email
        if (resetErr.message?.includes('Database error')) {
          throw new Error('Cannot reset password for this account. The member may be provisioned with phone-only access. Please delete and re-provision the account.')
        }
        throw resetErr
      }
    }

    const { error: profErr } = await supabaseAdmin.from('user_profiles').update({ must_change_password: true }).eq('id', member.auth_user_id)
    if (profErr) throw profErr

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
