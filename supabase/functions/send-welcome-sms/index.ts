import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // ── 2. Role check ────────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    if (!['admin', 'secretary'].includes(profile.role)) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    // ── 3. Parse request & fetch member ──────────────────────────────────────
    const { memberId } = await req.json()
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'memberId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('first_name, primary_phone')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!member.primary_phone) {
      return new Response(JSON.stringify({ delivered: false, reason: 'no_phone' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Call Arkesel API ──────────────────────────────────────────────────
    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY') ?? ''
    const arkeselSender = Deno.env.get('ARKESEL_SENDER_ID') ?? 'CACI API'
    
    // Safety check - if no key is configured in env, fail gracefully
    if (!arkeselApiKey) {
      return new Response(JSON.stringify({ delivered: false, reason: 'missing_sms_config' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const arkeselRes = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': arkeselApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: arkeselSender,
        message: `Dear ${member.first_name}, welcome to CACI International! Your membership is now active.`,
        recipients: [member.primary_phone],
      }),
    })

    // ── 5. Non-blocking failure — return 200 ─────────────────────────────────
    if (!arkeselRes.ok) {
      const errText = await arkeselRes.text()
      return new Response(JSON.stringify({ delivered: false, status: arkeselRes.status, reason: errText }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ delivered: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
