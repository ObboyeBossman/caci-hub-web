import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const BATCH_SIZE = 50

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: messages } = await supabase
    .from('communication_messages')
    .select('*, members(primary_phone, email, whatsapp_number)')
    .eq('status', 'queued')
    .is('deleted_at', null)
    .limit(BATCH_SIZE)

  if (!messages?.length) {
    return new Response('Nothing to dispatch', { 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }

  const results = await Promise.allSettled(
    messages.map(msg => dispatch(msg))
  )

  // Update statuses
  const updates = results.map((result, i) => {
    const msg = messages[i]
    if (result.status === 'fulfilled') {
      return supabase.from('communication_messages').update({
        status: 'sent',
        external_ref: result.value.external_ref,
        provider_status: result.value.provider_status
      }).eq('id', msg.id)
    } else {
      return supabase.from('communication_messages').update({
        status: 'failed',
        failed_reason: result.reason?.message ?? 'Unknown error'
      }).eq('id', msg.id)
    }
  })

  await Promise.all(updates)

  return new Response(JSON.stringify({
    dispatched: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

async function dispatch(msg: any) {
  switch (msg.provider) {
    case 'arkesel': return dispatchSms(msg)
    case 'sendgrid': return dispatchEmail(msg)
    case 'internal': return dispatchInApp(msg)
    default: throw new Error(`Unknown provider: ${msg.provider}`)
  }
}

async function dispatchSms(msg: any) {
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('ARKESEL_API_KEY')!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: Deno.env.get('ARKESEL_SENDER_ID'),
      message: msg.body_resolved,
      recipients: [msg.members.primary_phone]
    })
  })
  const data = await res.json()
  return { external_ref: data.data?.[0]?.id, provider_status: data.status }
}

async function dispatchEmail(msg: any) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.members.email }] }],
      from: { email: Deno.env.get('FROM_EMAIL') },
      content: [{ type: 'text/plain', value: msg.body_resolved }]
    })
  })
  const messageId = res.headers.get('X-Message-Id')
  return { external_ref: messageId, provider_status: res.ok ? 'accepted' : 'rejected' }
}

async function dispatchInApp(msg: any) {
  // In-app just marks delivered immediately — no external call
  return { external_ref: msg.id, provider_status: 'delivered' }
}