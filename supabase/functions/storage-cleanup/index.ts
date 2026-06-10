import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, DeleteObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!
    }
  })

  const now = new Date().toISOString()

  const { data: attachments } = await supabase
    .from('communication_attachments')
    .select('*')
    .not('deleted_at', 'is', null)
    .lte('purge_after', now)
    .limit(100)

  let purged = 0

  for (const attachment of attachments ?? []) {
    try {
      if (attachment.storage_provider === 'supabase') {
        await supabase.storage
          .from(attachment.storage_bucket)
          .remove([attachment.storage_path])
      } else {
        await r2.send(new DeleteObjectCommand({
          Bucket: attachment.storage_bucket,
          Key: attachment.storage_path
        }))
      }
      purged++
    } catch (err) {
      console.error(`Failed to purge attachment ${attachment.id}:`, err)
    }
  }

  return new Response(JSON.stringify({ purged }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
