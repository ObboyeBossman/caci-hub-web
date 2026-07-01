import { supabase } from '@core/supabase'
import { sha256 } from './checksum'
import { validateAudioUpload } from './validation'

export type UploadAudioParams = {
  blob: Blob
  durationSeconds: number
  mimeType: string
  waveformData: number[]
  assemblyId: string
  campaignId?: string
  threadMessageId?: string
  isPublicBroadcast: boolean
}

export type UploadAudioResult =
  | { success: true; attachmentId: string; storagePath: string }
  | { success: false; error: string }

export async function uploadAudio(
  params: UploadAudioParams
): Promise<UploadAudioResult> {
  const { blob, durationSeconds, mimeType, waveformData, assemblyId } = params

  const validation = validateAudioUpload(blob, durationSeconds)
  if (!validation.valid) return { success: false, error: validation.reason }

  const checksum = await sha256(blob)

  const ext = mimeType.includes('ogg')
    ? 'ogg'
    : mimeType.includes('mp4')
    ? 'm4a'
    : 'webm'
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const fileId = crypto.randomUUID()
  const storagePath = `${assemblyId}/audio/${year}/${month}/${fileId}.${ext}`

  // 1. Upload the blob to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('messages-media-private')
    .upload(storagePath, blob, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  // 2. Register the attachment directly in the DB (no /api route needed)
  const { data: attachment, error: dbError } = await supabase
    .from('communication_attachments')
    .insert({
      assembly_id:       assemblyId,
      campaign_id:       params.campaignId ?? null,
      thread_message_id: params.threadMessageId ?? null,
      storage_bucket:    'messages-media-private',
      storage_path:      storagePath,
      storage_provider:  'supabase',
      storage_tier:      'hot',
      mime_type:         mimeType,
      file_size_bytes:   blob.size,
      checksum,
      duration_seconds:  durationSeconds,
      waveform_data:     waveformData,
      is_sensitive:      false,
      uploaded_by:       (await supabase.auth.getUser()).data.user?.id,
    })
    .select('id')
    .single()

  if (dbError) {
    // Roll back the storage upload if DB insert fails
    await supabase.storage
      .from('messages-media-private')
      .remove([storagePath])
    return { success: false, error: dbError.message }
  }

  return { success: true, attachmentId: attachment.id, storagePath }
}
