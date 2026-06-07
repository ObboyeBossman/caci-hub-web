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

    const { data: profile, error: profileError } = await supabaseAdmin.from('user_profiles').select('system_role, assembly_id').eq('id', user.id).single()
    if (profileError || !profile) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const isAdmin = profile.system_role === 'admin'
    if (!hasAdminPerm && !isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })

    const { memberId } = await req.json()
    if (!memberId) return new Response(JSON.stringify({ error: 'memberId is required' }), { status: 400, headers: corsHeaders })

    // supabaseAdmin already initialized above

    const { data: member, error: memErr } = await supabaseAdmin.from('members').select('assembly_id, auth_user_id').eq('id', memberId).single()
    if (memErr || !member) return new Response(JSON.stringify({ error: 'Member not found' }), { status: 404, headers: corsHeaders })
    if (member.assembly_id !== profile.assembly_id) return new Response(JSON.stringify({ error: 'Member is not in your assembly' }), { status: 403, headers: corsHeaders })
    if (!member.auth_user_id) return new Response(JSON.stringify({ error: 'Member does not have an auth account' }), { status: 400, headers: corsHeaders })

    const authUserId = member.auth_user_id

    const { error: membUpdateErr } = await supabaseAdmin.from('members').update({ auth_user_id: null }).eq('id', memberId)
    if (membUpdateErr) throw membUpdateErr

    const { error: profDelErr } = await supabaseAdmin.from('user_profiles').delete().eq('id', authUserId)
    if (profDelErr) throw profDelErr

    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
    if (authDelErr) throw authDelErr

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
