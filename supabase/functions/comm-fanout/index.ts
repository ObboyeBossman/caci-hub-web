// supabase/functions/comm-fanout/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { campaign_id } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: campaign } = await supabase
    .from('communication_campaigns')
    .select('*, communication_templates(*)')
    .eq('id', campaign_id)
    .single()

  if (!campaign) return new Response('Campaign not found', { status: 404 })

  // Resolve recipient list
  let memberIds: string[] = []
  if (campaign.audience_type === 'assembly') {
    const { data } = await supabase
      .from('members')
      .select('id')
      .eq('assembly_id', campaign.assembly_id)
      .eq('is_active', true)
    memberIds = data?.map(m => m.id) ?? []
  } else if (campaign.audience_type === 'group') {
    const { data } = await supabase
      .from('group_members')
      .select('member_id')
      .in('group_id', campaign.audience_ids)
      .eq('is_active', true)
    memberIds = data?.map(m => m.member_id) ?? []
  } else {
    memberIds = campaign.audience_ids
  }

  // Fetch member data for template resolution
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, primary_phone, whatsapp_number')
    .in('id', memberIds)

  // Check preferences — skip opted-out members
  const { data: optOuts } = await supabase
    .from('communication_preferences')
    .select('member_id')
    .eq('assembly_id', campaign.assembly_id)
    .eq('channel', campaign.channel)
    .eq('opted_in', false)

  const optOutSet = new Set(optOuts?.map(o => o.member_id) ?? [])

  // Build message rows
  const messages = members
    ?.filter(m => !optOutSet.has(m.id))
    .map(m => ({
      campaign_id: campaign.id,
      assembly_id: campaign.assembly_id,
      member_id: m.id,
      channel: campaign.channel,
      body_resolved: resolveTemplate(
        campaign.communication_templates.body,
        { first_name: m.first_name, last_name: m.last_name }
      ),
      status: 'queued',
      provider: resolveProvider(campaign.channel)
    })) ?? []

  // Batch insert
  const BATCH = 500
  for (let i = 0; i < messages.length; i += BATCH) {
    await supabase
      .from('communication_messages')
      .insert(messages.slice(i, i + BATCH))
  }

  // Update campaign status + recipient count
  await supabase
    .from('communication_campaigns')
    .update({ status: 'sending', total_recipients: messages.length })
    .eq('id', campaign_id)

  return new Response(JSON.stringify({ queued: messages.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

function resolveTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function resolveProvider(channel: string): string {
  const map: Record<string, string> = {
    email: 'sendgrid', sms: 'arkesel',
    whatsapp: 'twilio', push: 'fcm', in_app: 'internal'
  }
  return map[channel] ?? 'internal'
}