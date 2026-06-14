import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3'
import { getR2Client } from '../_shared/r2.ts'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { attachment_id, requester_id } = await req.json()
  const EXPIRY_SECONDS = 3600

  const { data: attachment } = await supabase
    .from('communication_attachments')
    .select('*')
    .eq('id', attachment_id)
    .is('deleted_at', null)
    .single()

  if (!attachment) {
    return new Response(JSON.stringify({ error: 'Not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })
  }

  const { data: profile } = await supabase
    .from('members_view')
    .select('assembly_id')
    .eq('auth_user_id', requester_id)
    .single()

  if (profile?.assembly_id !== attachment.assembly_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
  }

  if (attachment.is_sensitive) {
    const { data: hasPerm } = await supabase.rpc('check_permission', {
      user_id: requester_id,
      perm_key: 'communications.attachments.view_pastoral'
    })
    if (!hasPerm) return new Response('Forbidden', { status: 403 })
  }

  let signedUrl: string

  if (attachment.storage_provider === 'supabase') {
    const { data } = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(attachment.storage_path, EXPIRY_SECONDS)
    signedUrl = data!.signedUrl
  } else {
    const r2 = getR2Client()
    signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: attachment.storage_bucket,
        Key: attachment.storage_path
      }),
      { expiresIn: EXPIRY_SECONDS }
    )
  }

  await supabase.from('storage_signed_url_log').insert({
    attachment_id,
    requested_by: requester_id,
    ip_address: req.headers.get('x-forwarded-for'),
    expires_at: new Date(Date.now() + EXPIRY_SECONDS * 1000).toISOString()
  })

  return new Response(JSON.stringify({ url: signedUrl, expires_in: EXPIRY_SECONDS }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
