import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ASSIGNABLE_ROLES = new Set([
  'admin',
  'pastor',
  'secretary',
  'volunteer',
  'member',
])

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabaseUser
      .from('user_profiles')
      .select('role, assembly_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminAssemblyId = profile.assembly_id as string

    let body: {
      memberId: string
      role: string
      path: 'invite' | 'default_password' | 'explicit'
      email?: string
      password?: string
    }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { memberId, role, path } = body

    if (!memberId || !role || !path) {
      return new Response(JSON.stringify({ error: 'memberId, role, and path are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ASSIGNABLE_ROLES.has(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role for provisioning' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: member, error: memErr } = await supabaseAdmin
      .from('members')
      .select('id, assembly_id, first_name, last_name, email, phone_number, is_active, deleted_at, auth_user_id')
      .eq('id', memberId)
      .single()

    if (memErr || !member) {
      return new Response(JSON.stringify({ error: memErr?.message ?? 'Member not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (member.assembly_id !== adminAssemblyId) {
      return new Response(JSON.stringify({ error: 'Member is not in your assembly' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!member.is_active || member.deleted_at != null) {
      return new Response(JSON.stringify({ error: 'Member record is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (member.auth_user_id != null) {
      return new Response(JSON.stringify({ error: 'This member already has a login account' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Member'
    let newUserId: string | null = null
    let responseData: any = null

    try {
      if (path === 'invite') {
        const email = body.email || member.email
        if (!email) {
          return new Response(JSON.stringify({ error: 'Email is required for invite path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: false,
        })
        if (createErr || !created?.user) throw createErr

        newUserId = created.user.id
        await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email })

        const { error: insErr } = await supabaseAdmin.from('user_profiles').insert({
          id: newUserId,
          assembly_id: adminAssemblyId,
          role,
          full_name: fullName,
          is_active: true,
          must_change_password: false,
        })
        if (insErr) throw insErr

        responseData = { userId: newUserId, email, fullName, role, path: 'invite' }
      } else if (path === 'default_password') {
        const { data: assembly, error: assErr } = await supabaseAdmin
          .from('assemblies')
          .select('default_member_password')
          .eq('id', adminAssemblyId)
          .single()
        
        if (assErr || !assembly?.default_member_password) {
          return new Response(JSON.stringify({ error: 'Assembly default password not configured. Set it in Assembly Settings.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const phone = member.phone_number
        if (!phone) {
          return new Response(JSON.stringify({ error: 'Phone number is required for default password path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          phone,
          password: assembly.default_member_password,
          phone_confirm: true,
        })
        if (createErr || !created?.user) throw createErr

        newUserId = created.user.id

        const { error: insErr } = await supabaseAdmin.from('user_profiles').insert({
          id: newUserId,
          assembly_id: adminAssemblyId,
          role,
          full_name: fullName,
          is_active: true,
          must_change_password: true,
        })
        if (insErr) throw insErr

        responseData = { userId: newUserId, phone, fullName, role, path: 'default_password' }
      } else if (path === 'explicit') {
        const { password, email: bodyEmail } = body
        if (!password || password.length < 8) {
          return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const email = bodyEmail || member.email
        if (!email) {
          return new Response(JSON.stringify({ error: 'Email is required for explicit path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (createErr || !created?.user) throw createErr

        newUserId = created.user.id

        const { error: insErr } = await supabaseAdmin.from('user_profiles').insert({
          id: newUserId,
          assembly_id: adminAssemblyId,
          role,
          full_name: fullName,
          is_active: true,
          must_change_password: true,
        })
        if (insErr) throw insErr

        responseData = { userId: newUserId, email, fullName, role, path: 'explicit' }
      }

      // Update member record with auth_user_id
      const { error: upErr } = await supabaseAdmin
        .from('members')
        .update({ auth_user_id: newUserId })
        .eq('id', memberId)
      
      if (upErr) throw upErr

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      if (newUserId) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {})
      }
      const message = e instanceof Error ? e.message : 'Provisioning failed'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
