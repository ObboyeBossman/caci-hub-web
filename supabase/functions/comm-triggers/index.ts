import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: birthdayRules } = await supabase
    .from('communication_trigger_rules')
    .select('*, communication_templates(*)')
    .eq('trigger_event', 'member.birthday')
    .eq('is_active', true)

  for (const rule of birthdayRules ?? []) {
    const targetDate = new Date(today)
    if (rule.offset_direction === 'before') targetDate.setDate(targetDate.getDate() + rule.days_offset)
    else targetDate.setDate(targetDate.getDate() - rule.days_offset)

    const targetMMDD = `${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`

    const { data: members } = await supabase
      .from('members')
      .select('id')
      .eq('assembly_id', rule.assembly_id)
      .eq('is_active', true)
      .filter('date_of_birth', 'like', `%-${targetMMDD}`)

    if (!members?.length) continue

    const { data: campaign } = await supabase
      .from('communication_campaigns')
      .insert({
        assembly_id:   rule.assembly_id,
        template_id:   rule.template_id,
        title:         `Birthday — ${targetMMDD}`,
        channel:       rule.channels[0],
        audience_type: 'member_list',
        audience_ids:  members.map((m: any) => m.id),
        trigger_type:  'birthday',
        status:        'sending'
      })
      .select()
      .single()

    if (campaign?.id) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/comm-fanout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ campaign_id: campaign.id })
      })
    }
  }

  return new Response(JSON.stringify({ ran_at: today.toISOString() }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
