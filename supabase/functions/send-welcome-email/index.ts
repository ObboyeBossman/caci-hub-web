import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Preload HTML template
const welcomeTemplate = await Deno.readTextFile(
  new URL('./templates/welcome.html', import.meta.url).pathname
)

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
      .select('first_name, email, membership_number')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!member.email) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!member.membership_number) {
      return new Response(JSON.stringify({ error: 'Member does not have a membership number yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Render HTML ───────────────────────────────────────────────────────
    const html = welcomeTemplate
      .replace('{first_name}', member.first_name)
      .replace('{membership_number}', member.membership_number)

    // ── 5. Call Resend API ───────────────────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev' // Fallback for dev testing
    
    if (!resendApiKey) {
      return new Response(JSON.stringify({ sent: false, reason: 'missing_email_config' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `CACI International <${resendFrom}>`,
        to: [member.email],
        subject: 'Welcome to CACI! Your Membership Details',
        html: html,
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      return new Response(JSON.stringify({ sent: false, status: resendRes.status, reason: errText }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ sent: true }), {
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
