import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Supabase Admin API strips the leading '+' when it persists phone numbers in
// auth.users. Normalise here so the stored value matches what the login page
// sends after the authService.signIn normalisation.
function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '')
}

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
      path: 'invite' | 'default_password' | 'custom_password'
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
      .select('id, assembly_id, first_name, last_name, email, primary_phone, secondary_phone, is_active, deleted_at, auth_user_id')
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
      return new Response(JSON.stringify({ error: 'This member already has a login account. Use Reset Account to clear it first.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Member'
    let newUserId: string | null = null
    let responseData: any = null

    try {
      if (path === 'invite') {
        const emailFinal = (body.email ?? member.email)?.trim().toLowerCase()
        if (!emailFinal) {
          return new Response(JSON.stringify({ error: 'Member has no email address. Enter one or choose a different provisioning method.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailFinal,
          email_confirm: false,
        })
        if (createErr || !created?.user) throw createErr

        newUserId = created.user.id
        await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email: emailFinal })

        const { error: insErr } = await supabaseAdmin.from('user_profiles').insert({
          id: newUserId,
          assembly_id: adminAssemblyId,
          role,
          full_name: fullName,
          is_active: true,
          must_change_password: false,
        })
        if (insErr) throw insErr

        await supabaseAdmin.from('members')
          .update({ auth_user_id: newUserId, email: emailFinal })
          .eq('id', memberId)

        responseData = { userId: newUserId, email: emailFinal, fullName, role, path: 'invite' }
      } else if (path === 'default_password') {
        if (!member.primary_phone) {
          return new Response(JSON.stringify({ error: 'Member has no phone number. A phone number is required for this provisioning method.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: assembly, error: assErr } = await supabaseAdmin
          .from('assemblies')
          .select('default_member_password')
          .eq('id', adminAssemblyId)
          .single()
        
        if (assErr || !assembly?.default_member_password) {
          return new Response(JSON.stringify({ error: 'Assembly default password is not configured. Set it in Assembly Settings before using this option.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const normalizedPhone = normalizePhone(member.primary_phone)
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          phone: normalizedPhone,
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
          phone: normalizedPhone,
          is_active: true,
          must_change_password: true,
        })
        if (insErr) throw insErr

        await supabaseAdmin.from('members')
          .update({ auth_user_id: newUserId })
          .eq('id', memberId)

        responseData = { userId: newUserId, phone: member.primary_phone, fullName, role, path: 'default_password' }
      } else if (path === 'custom_password') {
        const emailFinal = (body.email ?? member.email)?.trim().toLowerCase()
        if (!emailFinal) {
          return new Response(JSON.stringify({ error: 'Email is required for custom_password path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { password } = body
        if (!password || password.length < 8) {
          return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailFinal,
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

        await supabaseAdmin.from('members')
          .update({ auth_user_id: newUserId, email: emailFinal })
          .eq('id', memberId)

        responseData = { userId: newUserId, email: emailFinal, fullName, role, path: 'custom_password' }
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      if (newUserId) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {})
      }
      const message = e instanceof Error ? e.message : 'Provisioning failed'
      return new Response(JSON.stringify({ error: `Provisioning failed and was rolled back: ${message}` }), {
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
