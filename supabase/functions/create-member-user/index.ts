import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/** Roles an assembly admin may assign when provisioning app login (Phase 1). */
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
      memberId?: string
      email?: string
      password?: string
      role?: string
    }
    try {
      const raw = await req.text()
      body = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const memberId = body.memberId?.trim()
    const password = body.password
    const roleRaw = body.role?.trim().toLowerCase()

    if (!memberId || typeof password !== 'string' || !roleRaw) {
      return new Response(
        JSON.stringify({ error: 'memberId, password, and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ASSIGNABLE_ROLES.has(roleRaw)) {
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
      .select(
        'id, assembly_id, first_name, last_name, email, is_active, deleted_at, auth_user_id',
      )
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

    const emailInput = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const fromMember = typeof member.email === 'string' ? member.email.trim().toLowerCase() : ''
    const emailFinal = emailInput || fromMember

    if (!emailFinal || !emailFinal.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email is required (member has none — enter one).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Member'

    let newUserId: string | null = null

    try {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: emailFinal,
        password,
        email_confirm: true,
      })

      if (createErr || !created?.user) {
        const msg = createErr?.message ?? 'Could not create auth user'
        const code = (createErr as any)?.code ?? 'auth_error'
        return new Response(JSON.stringify({ error: `${msg} (${code})` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      newUserId = created.user.id

      const { error: insErr } = await supabaseAdmin.from('user_profiles').insert({
        id: newUserId,
        assembly_id: adminAssemblyId,
        role: roleRaw,
        full_name: fullName,
        is_active: true,
      })

      if (insErr) {
        throw new Error(`${insErr.message} (Code: ${insErr.code})`)
      }

      const { error: upErr } = await supabaseAdmin
        .from('members')
        .update({
          auth_user_id: newUserId,
          email: emailFinal,
        })
        .eq('id', memberId)

      if (upErr) {
        throw new Error(`${upErr.message} (Code: ${upErr.code})`)
      }

      return new Response(
        JSON.stringify({
          userId: newUserId,
          email: emailFinal,
          fullName,
          role: roleRaw,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } catch (e) {
      if (newUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(newUserId)
        } catch {
          /* best-effort rollback */
        }
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
