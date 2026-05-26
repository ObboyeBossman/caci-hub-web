import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile, error: profileError } = await supabaseUser.from('user_profiles').select('role, assembly_id').eq('id', user.id).single()
    if (profileError || !profile || profile.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })

    const { memberId } = await req.json()
    if (!memberId) return new Response(JSON.stringify({ error: 'memberId is required' }), { status: 400, headers: corsHeaders })

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: member, error: memErr } = await supabaseAdmin.from('members').select('assembly_id, auth_user_id').eq('id', memberId).single()
    if (memErr || !member) return new Response(JSON.stringify({ error: 'Member not found' }), { status: 404, headers: corsHeaders })
    if (member.assembly_id !== profile.assembly_id) return new Response(JSON.stringify({ error: 'Member is not in your assembly' }), { status: 403, headers: corsHeaders })
    if (!member.auth_user_id) return new Response(JSON.stringify({ error: 'Member does not have an auth account' }), { status: 400, headers: corsHeaders })

    const { data: assembly, error: assErr } = await supabaseAdmin.from('assemblies').select('default_member_password').eq('id', profile.assembly_id).single()
    if (assErr || !assembly?.default_member_password) return new Response(JSON.stringify({ error: 'Assembly default password is not configured.' }), { status: 400, headers: corsHeaders })

    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(member.auth_user_id, { password: assembly.default_member_password })
    if (resetErr) throw resetErr

    const { error: profErr } = await supabaseAdmin.from('user_profiles').update({ must_change_password: true }).eq('id', member.auth_user_id)
    if (profErr) throw profErr

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
