// supabase/functions/comm-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const provider = new URL(req.url).searchParams.get('provider') ?? 'unknown'
  const payload = await req.json()

  // Always store raw payload first — replay safety net
  await supabase.from('webhook_events').insert({
    provider,
    event_type: payload.event ?? payload.status ?? 'unknown',
    payload,
    message_id: resolveMessageId(provider, payload)
  })

  // Map provider status to our enum
  const statusMap: Record<string, Record<string, string>> = {
    sendgrid: { delivered: 'delivered', open: 'read', bounce: 'failed', dropped: 'failed' },
    arkesel:  { delivered: 'delivered', failed: 'failed', sent: 'sent' },
    twilio:   { delivered: 'delivered', failed: 'failed', sent: 'sent', read: 'read' }
  }

  const ourStatus = statusMap[provider]?.[payload.event ?? payload.status]
  const externalRef = resolveExternalRef(provider, payload)

  if (ourStatus && externalRef) {
    await supabase
      .from('communication_messages')
      .update({
        status: ourStatus,
        provider_status: payload.event ?? payload.status,
        ...(ourStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(ourStatus === 'read'      && { read_at: new Date().toISOString() }),
        ...(ourStatus === 'failed'    && { failed_reason: payload.reason ?? payload.error_message })
      })
      .eq('external_ref', externalRef)

    // Mark webhook as processed
    await supabase
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('payload->>id', externalRef)
  }

  return new Response('OK')
})

function resolveMessageId(provider: string, payload: any): string | null {
  if (provider === 'sendgrid') return payload.sg_message_id ?? null
  if (provider === 'arkesel')  return payload.id ?? null
  if (provider === 'twilio')   return payload.SmsSid ?? null
  return null
}

function resolveExternalRef(provider: string, payload: any): string | null {
  return resolveMessageId(provider, payload)
}