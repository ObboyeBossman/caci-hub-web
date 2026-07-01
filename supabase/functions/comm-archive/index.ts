// supabase/functions/comm-archive/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand }
  from 'https://esm.sh/@aws-sdk/client-s3@3'
import { getR2Client } from '../_shared/r2.ts'

const WARM_DAYS  = 60
const COLD_DAYS  = 365

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // R2 client — S3-compatible
  // R2 client — S3-compatible (from shared)
  const r2 = getR2Client()

  const now = new Date()
  const warmCutoff = new Date(now.getTime() - WARM_DAYS * 86400000).toISOString()
  const coldCutoff = new Date(now.getTime() - COLD_DAYS * 86400000).toISOString()

  // 1. Hot → Warm: files older than 60 days still on Supabase
  const { data: toWarm } = await supabase
    .from('communication_attachments')
    .select('*')
    .eq('storage_tier', 'hot')
    .eq('storage_provider', 'supabase')
    .lt('created_at', warmCutoff)
    .is('deleted_at', null)
    .limit(100)

  let warmed = 0
  for (const attachment of toWarm ?? []) {
    try {
      // Download from Supabase
      const { data: fileData } = await supabase.storage
        .from(attachment.storage_bucket)
        .download(attachment.storage_path)

      if (!fileData) continue

      // Upload to R2 warm bucket
      const r2Key = `${attachment.assembly_id}/warm/${attachment.storage_path}`
      await r2.send(new PutObjectCommand({
        Bucket: Deno.env.get('R2_WARM_BUCKET')!,
        Key: r2Key,
        Body: new Uint8Array(await fileData.arrayBuffer()),
        ContentType: attachment.mime_type,
        Metadata: {
          assembly_id:   attachment.assembly_id,
          attachment_id: attachment.id,
          is_sensitive:  String(attachment.is_sensitive)
        }
      }))

      // Update DB record
      await supabase
        .from('communication_attachments')
        .update({
          storage_tier:     'warm',
          storage_provider: 'r2',
          storage_bucket:   Deno.env.get('R2_WARM_BUCKET')!,
          storage_path:     r2Key,
          archived_at:      now.toISOString()
        })
        .eq('id', attachment.id)

      // Delete from Supabase Storage
      await supabase.storage
        .from(attachment.storage_bucket)
        .remove([attachment.storage_path])

      warmed++
    } catch (err) {
      console.error(`Failed to archive ${attachment.id}:`, err)
    }
  }

  // 2. Warm → Cold: files older than 365 days on R2 warm (DEFERRED TO V2 with Google Drive)
  /*
  const { data: toCold } = await supabase
    .from('communication_attachments')
    ... (omitted to save space in thought block, I'll put the exact replacement in the field)
  */
  
  let colded = 0 // Disabled for v2
  
  return new Response(JSON.stringify({ warmed, colded }))
})