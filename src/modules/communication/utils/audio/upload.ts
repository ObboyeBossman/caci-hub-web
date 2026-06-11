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

  const session = (await supabase.auth.getSession()).data.session
  const response = await fetch('/api/communications/attachments/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      assembly_id: assemblyId,
      campaign_id: params.campaignId ?? null,
      thread_message_id: params.threadMessageId ?? null,
      storage_bucket: 'messages-media-private',
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: blob.size,
      checksum,
      duration_seconds: durationSeconds,
      waveform_data: waveformData,
      is_sensitive: false,
      is_public_broadcast: params.isPublicBroadcast
    })
  })

  if (!response.ok) {
    await supabase.storage
      .from('messages-media-private')
      .remove([storagePath])

    const err = await response.json()
    return { success: false, error: err.message ?? 'Registration failed' }
  }

  const { attachmentId } = await response.json()
  return { success: true, attachmentId, storagePath }
}
